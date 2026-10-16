const MAX_EDGE = 2000;
const SKIP_UNDER = 1.5 * 1024 * 1024;
const QUALITY = 0.8;

/**
 * Downscales large receipt photos/screenshots in the browser (max 2000px long edge, JPEG ~0.8) so they upload fast
 * on mobile data. Files under 1.5 MB are left alone, and the original is returned if anything fails.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size <= SKIP_UNDER || typeof createImageBitmap !== 'function') return file;
  try {
    // 'from-image' applies EXIF orientation so photos are not saved sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff'; // flatten transparency (PNG screenshots) before JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
