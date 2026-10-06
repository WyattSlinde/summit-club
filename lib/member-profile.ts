export const profileInterests = ['Hiking', 'Beach days', 'Wildlife', 'Photography', 'Trail care', 'Community service', 'Camping', 'Leadership'] as const;
export type Profile = {
  user_id: string; display_name: string; friend_tag: string; bio: string; wants: string;
  interests: string[]; photo_path: string | null; visibility: 'private' | 'friends'; accepting_requests: boolean; updated_at: string;
};
export type Connection = {
  id: string; user_id: string; status: 'pending' | 'accepted'; outgoing: boolean; display_name: string;
  bio: string | null; wants: string | null; interests: string[] | null; photo_path: string | null; updated_at: string; shared: boolean;
};
export type Connections = { connections: Connection[]; blocked: { user_id: string; display_name: string }[] };
export function normalizeFriendTag(value: string) { return value.trim().toUpperCase(); }
export function validFriendTag(value: string) { return /^SUM-[A-F0-9]{10}$/.test(normalizeFriendTag(value)); }
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'S'; }
export function accountReturn(search: string) {
  const params = new URLSearchParams(search);
  if (params.getAll('intent').length !== 1 || params.getAll('outing').length > 1) return null;
  if (params.get('intent') === 'idea') return '/?afterSignIn=idea#board';
  const outing = params.get('outing');
  if (params.get('intent') === 'vote' && ['ridge', 'coast', 'wild'].includes(outing || '')) return `/?afterSignIn=vote&outing=${outing}#expeditions`;
  return null;
}
