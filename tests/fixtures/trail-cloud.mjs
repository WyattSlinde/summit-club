export const cloudConfigured = true;
export const calls = [], listeners = new Set();
const mineId = '10000000-0000-4000-8000-000000000001';
const hikes = [{ id: 'cowles-mountain', name: 'Cowles Mountain', area: 'Mission Trails Regional Park', official_url: 'https://www.sandiego.gov/cowles-mountain-summit', average: 4, rating_count: 3, rank: 1, my_rating: null }];
let photos = [];
const files = new Map();
export async function communityRequest(operation, payload = {}) {
  calls.push({ operation, payload });
  if (operation === 'ratings') return structuredClone({ month: payload.month || '2026-10-01', today: '2026-10-06', minimum_ratings: 3, hikes });
  if (operation === 'rate') { hikes[0].my_rating = { stars: payload.stars, hiked_on: payload.hiked_on }; return { saved: true }; }
  if (operation === 'remove_rating') { hikes[0].my_rating = null; return { saved: true }; }
  if (operation === 'gallery') return structuredClone({ photos: photos.filter(p => p.status === 'published') });
  if (operation === 'my_photos') return structuredClone({ photos });
  if (operation === 'photo_draft') {
    const photo = { ...payload, object_path: `${mineId}/${payload.id}.jpg`, hike_name: 'Cowles Mountain', author_name: 'Taylor', status: 'draft', mine: true, published_at: null };
    photos.push(photo); return structuredClone(photo);
  }
  if (operation === 'photo_publish') { const photo = photos.find(p => p.id === payload.id); photo.status = 'published'; photo.published_at = '2026-10-06T18:00:00Z'; return { saved: true }; }
  if (operation === 'photo_remove') { const photo = photos.find(p => p.id === payload.id); photo.status = 'deleting'; return { object_path: photo.object_path }; }
  if (operation === 'photo_delete') { photos = photos.filter(p => p.id !== payload.id); return { saved: true }; }
  if (operation === 'photo_edit') { Object.assign(photos.find(p => p.id === payload.id), payload); return { saved: true }; }
  return { saved: true };
}
export function cloudClient() { return {
  auth: { onAuthStateChange: fn => { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; } },
  storage: { from: bucket => ({
    download: async path => files.has(path) ? { data: files.get(path), error: null } : { data: null, error: { status: 404 } },
    upload: async (path, blob, options) => { calls.push({ operation: 'upload', bucket, path, options }); files.set(path, blob); return { error: null }; },
    remove: async paths => { paths.forEach(path => files.delete(path)); calls.push({ operation: 'storage_remove', paths }); return { error: null }; },
  }) },
}; }
