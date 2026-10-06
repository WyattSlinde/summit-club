/** Re-encode on device to remove original metadata and keep student uploads small. */
export async function prepareProfilePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode().catch(() => { throw new Error('This photo could not be opened. Try a different JPG or PNG.'); });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) throw new Error('Choose a photo smaller than 50 megapixels.');
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = Math.min(edge, 768);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo editing is unavailable in this browser. Try another browser.');
    context.fillStyle = '#f4eee4'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', .88));
  } finally { URL.revokeObjectURL(url); }
}
