export type SignInIntent = 'join' | 'idea';
/** Return to the action the visitor chose, using only fixed same-site paths. */
export function signInFor(intent: SignInIntent) {
  const returnTo = `/?afterSignIn=${intent}#${intent === 'join' ? 'basecamp' : 'board'}`;
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}
export function readSignInIntent(search: string): SignInIntent | null {
  const value = new URLSearchParams(search).get('afterSignIn');
  return value === 'join' || value === 'idea' ? value : null;
}
