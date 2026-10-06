import { cloudClient, communityRequest } from './cloud-client';
import type { Gallery, HikePhoto } from './trail-community';
/** Keep the whole landscape/portrait frame, cap dimensions, strip the original metadata. */
export async function prepareHikePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode().catch(() => { throw new Error('This photo could not be opened. Try another JPG or PNG.'); });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) throw new Error('Choose a photo smaller than 50 megapixels.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.fillStyle = '#f4eee4'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', .86));
    if (blob.size > 4 * 1024 * 1024) throw new Error('This photo is still too large. Choose a smaller image.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
export async function removeHikePhoto(id: string) {
  const record = await communityRequest<{ object_path: string }>('photo_remove', { id });
  const { error } = await cloudClient().storage.from('hike-photos').remove([record.object_path]);
  if (error) throw new Error('The photo is hidden, but its file could not be removed. Retry deletion from My photos.');
  await communityRequest('photo_delete', { id });
}
export async function clearMyHikePhotos() {
  const { photos } = await communityRequest<Gallery>('my_photos');
  // The owner's per-account quota bounds this list to 30 records.
  for (const photo of photos) await removeHikePhoto(photo.id);
}
export async function uploadHikePhoto(blob: Blob, fields: Record<string, unknown>) {
  const photo = await communityRequest<HikePhoto>('photo_draft', fields);
  if (photo.status !== 'published') {
    // If a previous attempt uploaded successfully, finish publishing without overwriting.
    const existing = await cloudClient().storage.from('hike-photos').download(photo.object_path);
    if (existing.error) {
      const { error } = await cloudClient().storage.from('hike-photos').upload(photo.object_path, blob, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
      if (error) throw new Error('Photo upload did not finish. Retry, or remove the unfinished upload from My photos.');
    }
    await communityRequest('photo_publish', { id: photo.id });
  }
}
