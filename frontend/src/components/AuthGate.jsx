import { useState } from 'react';
import { requestSignInLink } from '../firebase';

export default function AuthGate({ theme }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await requestSignInLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send sign-in link.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center px-6 transition-colors">
      <span className="font-bold tracking-[0.25em] text-sm mb-10">
        <span className="text-yellow-600 dark:text-yellow-400">LIVE</span> CASTER
      </span>

      {sent ? (
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-3">Check your email</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            We sent a sign-in link to <strong>{email}</strong>. Open it on
            this device to continue.
          </p>
          <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
            Not there? Check your spam folder — new senders often land
            there.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-3">Sign in to continue</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">
            Enter your email and we'll send a one-time sign-in link.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center focus:outline-none focus:ring-4 focus:ring-yellow-400/40 mb-4"
          />
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full px-8 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-black rounded-full font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400/40"
          >
            {sending ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}
    </div>
  );
}
