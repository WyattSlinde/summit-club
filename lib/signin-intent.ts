import config from './cloud-config.json' with { type: 'json' };
import { sitePath } from './site-path.ts';
export type SignInIntent = 'join' | 'idea';
/** Return to the action the visitor chose, using only fixed same-site paths. */
export function signInFor(intent: SignInIntent) {
  if (config.url && config.publishableKey) return sitePath(`/profile/?intent=${intent}`);
  const returnTo = intent === 'join' ? '/register/' : '/members/?afterSignIn=idea#board';
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}
export function readSignInIntent(search: string): SignInIntent | null {
  const value = new URLSearchParams(search).get('afterSignIn');
  return value === 'join' || value === 'idea' ? value : null;
}

// Keep the return destination independent of any user-supplied URL or hash.
const voteOutings = new Set(['ridge', 'coast', 'wild']);

/** Restore an outing after sign-in without casting a vote. Throws for unknown IDs. */
export function signInForVote(adventureId: string) {
  if (!voteOutings.has(adventureId)) throw new RangeError('Choose a listed outing.');
  if (config.url && config.publishableKey) return sitePath(`/profile/?intent=vote&outing=${adventureId}`);
  const returnTo = `/members/?afterSignIn=vote&outing=${adventureId}#expeditions`;
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}

/** Read exactly one allowed outing; reject ambiguous or manipulated action parameters. */
export function readVoteIntent(search: string): string | null {
  const params = new URLSearchParams(search);
  const actions = params.getAll('afterSignIn'), outings = params.getAll('outing');
  if (actions.length !== 1 || actions[0] !== 'vote' || outings.length !== 1) return null;
  return voteOutings.has(outings[0]) ? outings[0] : null;
}
