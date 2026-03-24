import { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from '../../firebase.js';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    if (isNewUser && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (isNewUser) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    setError('');
    setResetSent(false);
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 bg-[--color-surface]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-[--color-text] mb-2">
          Driftstone
        </h1>
        <p className="text-center text-[--color-text-muted] mb-8">
          Sign in to start studying
        </p>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm"
          >
            {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full min-h-touch flex items-center justify-center gap-3 bg-white border border-[--color-border] rounded-lg px-4 py-3 text-[--color-text] font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <hr className="flex-1 border-[--color-border]" />
          <span className="text-sm text-[--color-text-muted]">or</span>
          <hr className="flex-1 border-[--color-border]" />
        </div>

        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[--color-text]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-touch border border-[--color-border] rounded-lg px-4 py-2 text-[--color-text] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[--color-text]">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-touch border border-[--color-border] rounded-lg px-4 py-2 text-[--color-text] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              autoComplete={isNewUser ? 'new-password' : 'current-password'}
            />
          </label>

          {isNewUser && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[--color-text]">Confirm password</span>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="min-h-touch border border-[--color-border] rounded-lg px-4 py-2 text-[--color-text] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                autoComplete="new-password"
              />
            </label>
          )}

          {!isNewUser && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="self-end text-sm text-[--color-brand] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded disabled:opacity-50"
            >
              Forgot password?
            </button>
          )}

          {resetSent && (
            <p className="text-sm text-emerald-600" role="status">
              Password reset email sent. Check your inbox.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-touch bg-[--color-brand] text-white font-medium rounded-lg px-4 py-3 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] disabled:opacity-50"
          >
            {isNewUser ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={() => {
            setIsNewUser(!isNewUser);
            setError('');
            setConfirmPassword('');
            setResetSent(false);
          }}
          className="w-full min-h-touch mt-4 text-sm text-[--color-brand] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded-lg"
        >
          {isNewUser ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
