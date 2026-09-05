# Deployment Decisions Log

Tracks what was set up in Google Cloud for Live-Caster, and why, so future
changes don't have to rediscover this context.

## GCP project

- **Project ID**: `live-caster-75895`
- **Billing account**: "Yuvraj Billing" (`019DEB-E3F605-5ED880`)
- Created fresh rather than reusing an existing project, to keep this
  app's spend and IAM isolated.

## Services deployed (Cloud Run, region `us-central1`)

| Service | URL | Purpose |
|---|---|---|
| `live-caster-backend` | https://live-caster-backend-165409365963.us-central1.run.app | FastAPI + WebSocket bridge to Gemini Live |
| `live-caster-frontend` | https://live-caster-frontend-165409365963.us-central1.run.app | Static Vite build, served by nginx |

Both built via `gcloud run deploy --source .` (backend) and a
`cloudbuild.yaml` + `gcloud builds submit` → `gcloud run deploy --image`
(frontend, since Vite needs `VITE_*` build args baked in — see
`frontend/cloudbuild.yaml`).

## Decisions made

1. **Vertex AI over Gemini Developer API key.**
   No API key/secret to manage or rotate. The Cloud Run backend's default
   compute service account (`165409365963-compute@developer.gserviceaccount.com`)
   was granted `roles/aiplatform.user`. Billing for Gemini calls goes to
   this project via `LIVECASTER_VERTEX_PROJECT=live-caster-75895`.

2. **`max-instances=1` on the backend.**
   Session history is still ephemeral-ish under concurrent instances in
   spirit, though Firestore (see below) actually fixes the underlying
   problem. Kept at 1 for now to keep the Gemini Live WebSocket bridge's
   in-memory state simple; revisit if concurrent users are expected.

3. **Firestore over local JSON files for session storage.**
   Cloud Run's filesystem is ephemeral and scales to 0/N instances, so the
   original `backend/sessions/*.json` file store didn't survive restarts.
   Firestore Native mode, `us-central1`, free tier (50K reads/20K writes/day)
   comfortably covers personal use. Firestore security rules deny **all**
   direct client access (`allow read, write: if false`) — the backend talks
   to it exclusively via the Admin SDK / service account, which bypasses
   rules. Service account was granted `roles/datastore.user`.

4. **Auth: Firebase Authentication, Email Link (passwordless) sign-in.**
   Chosen so no one can use the app (and burn Gemini/Vertex credits)
   without your explicit go-ahead via a clicked email link — no passwords
   to manage, no separate email-sending service to wire up (Firebase sends
   the email itself).
   - **Open sign-up**: any email can request a link and sign in — this was
     a deliberate call (not restricted to a single allowlisted email).
     The billing budget alert below is the safety net for that choice.
   - Frontend: `firebase/auth` JS SDK (`frontend/src/firebase.js`,
     `frontend/src/components/AuthGate.jsx`). ID token attached as
     `Authorization: Bearer <token>` on REST calls and as `token` in the
     WebSocket `start` message.
   - Backend: `firebase-admin`, verifies the ID token on every REST
     request and the WebSocket handshake (`backend/auth.py`). Sessions in
     Firestore are scoped by `uid` so users only ever see their own
     history.
   - Firebase Auth authorized domains includes the Cloud Run frontend URL
     (`live-caster-frontend-165409365963.us-central1.run.app`) in addition
     to the default `firebaseapp.com`/`web.app`/`localhost`.

5. **Billing budget alert: $50/month.**
   Email alerts at 50%/90%/100% of $50/month, scoped to this project only.
   This does **not** stop spending or disable the app automatically — it's
   an early-warning tripwire, chosen specifically because auth is
   open-signup rather than allowlisted.

## Known gaps / things to revisit

- No automatic spend cap — the budget alert only emails you. If unwanted
  usage shows up, the fastest kill switch is disabling the Cloud Run
  service or revoking `roles/aiplatform.user` from the backend's service
  account.
- `max-instances=1` means the backend can't serve more than one concurrent
  Live session well (Cloud Run will queue/reject extra traffic past that
  instance's concurrency). Fine for personal use; raise it (and confirm
  the WebSocket bridge handles concurrent sessions cleanly) if you expect
  more than one simultaneous user.
- No custom domain — using the default `*.run.app` URLs.
