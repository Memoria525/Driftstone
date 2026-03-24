import { signOut } from 'firebase/auth';
import { auth } from '../../firebase.js';

export default function Header({ user }) {
  async function handleSignOut() {
    await signOut(auth);
  }

  return (
    <header className="bg-white border-b border-[--color-border] px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold tracking-tight text-[--color-text]">
        Driftstone
      </h1>
      {user && (
        <button
          onClick={handleSignOut}
          className="min-h-touch min-w-touch flex items-center justify-center text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded-lg px-2"
          aria-label="Sign out"
        >
          Sign out
        </button>
      )}
    </header>
  );
}
