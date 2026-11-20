import type { SignUpInput } from '../context/AuthContext';

// Holds the registration form in memory between Register -> Verify code.
// (Kept out of route params so the password never appears in a URL.)
let pending: (SignUpInput & { createdAt: number }) | null = null;

export function setPendingRegistration(input: SignUpInput) {
  pending = { ...input, createdAt: Date.now() };
}

export function getPendingRegistration() {
  // Expire after 30 minutes, same idea as the website's sessionStorage copy
  if (pending && Date.now() - pending.createdAt > 30 * 60 * 1000) pending = null;
  return pending;
}

export function clearPendingRegistration() {
  pending = null;
}
