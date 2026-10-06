export const cloudConfigured = true, cloudAuthReady = true;
export const calls = [];
const id = '10000000-0000-4000-8000-000000000001';
let user = { id, email: 'member@example.test' };
let saved = { user_id: id, display_name: 'Taylor', bio: '', wants: '', interests: [], visibility: 'private', accepting_requests: false, photo_path: null, friend_tag: 'SUM-1A2B3C4D5E', updated_at: '2026-10-06T00:00:00Z' };
let connections = [{ id: 'request-1', user_id: '10000000-0000-4000-8000-000000000002', display_name: 'Jordan', status: 'pending', outgoing: false, shared: false, bio: null, interests: null, wants: null, photo_path: null }];
const listeners = new Set();
export function cloudClient() { return {
  auth: {
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: callback => { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
    signOut: async () => { user = null; for (const listener of listeners) listener('SIGNED_OUT', null); return { error: null }; },
  },
  storage: { from: bucket => ({
    upload: async (path, photo, options) => { calls.push({ operation: 'upload', bucket, path, size: photo.size, options }); return { error: null }; },
    download: async () => ({ error: null, data: new Blob(['photo'], { type: 'image/jpeg' }) }),
    remove: async paths => { calls.push({ operation: 'remove_photo', paths }); return { error: null }; },
  }) },
}; }
export async function clubRequest(operation, payload = {}) {
  calls.push({ operation, payload });
  if (operation === 'profile') return { profile: structuredClone(saved), member: { name: 'Taylor Student', grade: '11', interest: 'Explore' } };
  if (operation === 'connections') return structuredClone({ connections, blocked: [] });
  if (operation === 'save_profile') saved = { ...saved, ...payload };
  if (operation === 'photo') saved = { ...saved, photo_path: payload.remove ? null : id + '/avatar.jpg', updated_at: '2026-10-06T01:00:00Z' };
  if (operation === 'friend' && payload.verb === 'accept') connections[0] = { ...connections[0], status: 'accepted', shared: true, bio: 'Ready for a hike.', wants: 'A coastal cleanup.', interests: ['Hiking'] };
  if (operation === 'friend' && payload.verb === 'remove') connections = connections.filter(c => c.user_id !== payload.user_id);
  if (operation === 'friend' && payload.verb === 'send') return { status: 'saved' };
  return structuredClone(saved);
}
export function announceMemberChange() { window.dispatchEvent(new Event('summit:member-change')); }
export async function signOutMember() { await cloudClient().auth.signOut(); announceMemberChange(); }
