import { sitePath } from '../lib/site-path';
export { readSignInIntent, readVoteIntent } from '../lib/signin-intent';
export function signInFor(intent: 'join' | 'idea') { return sitePath(`/profile/?intent=${intent}`); }
export function signInForVote(adventureId: string) {
  if (!['ridge', 'coast', 'wild'].includes(adventureId)) throw new RangeError('Choose a listed outing.');
  return sitePath(`/profile/?intent=vote&outing=${adventureId}`);
}
