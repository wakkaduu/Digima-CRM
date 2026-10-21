import cloudinary from '../config/cloudinary';

// Legacy: receipts submitted before the move to S3. Read-only; new receipts go through storage.service.ts.
// Remove this file, config/cloudinary.ts and the cloudinary package once scripts/migrate-receipts-to-s3.ts has run.

// Signed URL, used only server-side. Browsers get the image through /api/payments/:id/receipt.
// `width` returns a resized copy (never upscaled, automatic quality and format) for phones and list views.
export function signedUrl(publicId: string, width?: number) {
    return cloudinary.url(publicId, {
        resource_type: 'image',
        type: 'authenticated',
        sign_url: true,
        secure: true,
        ...(width ? { transformation: [{ width, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] } : {}),
    });
}
