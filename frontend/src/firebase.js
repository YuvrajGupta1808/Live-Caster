import { initializeApp } from 'firebase/app';
import {
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBGRCS0tno70p5HeZWuRlQu2HNrG-WytSE',
  authDomain: 'live-caster-75895.firebaseapp.com',
  projectId: 'live-caster-75895',
  storageBucket: 'live-caster-75895.firebasestorage.app',
  messagingSenderId: '165409365963',
  appId: '1:165409365963:web:acacfbaf49e2976e53a04e',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const EMAIL_STORAGE_KEY = 'lc-auth-email';

export function requestSignInLink(email) {
  const actionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true,
  };
  return sendSignInLinkToEmail(auth, email, actionCodeSettings).then(() => {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  });
}

// Call once on app load. If the current URL is a sign-in link, completes
// sign-in and strips the link params from the address bar.
export async function completeSignInFromLink() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return false;

  let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  if (!email) {
    email = window.prompt('Confirm your email to finish signing in:');
  }
  if (!email) return false;

  await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  window.history.replaceState(null, '', window.location.pathname);
  return true;
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function signOutUser() {
  return signOut(auth);
}

export async function getIdToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}
