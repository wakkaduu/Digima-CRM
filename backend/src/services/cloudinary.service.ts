import cloudinary from '../config/cloudinary';
import env from '../config/env';
/* eslint-disable @typescript-eslint/no-explicit-any */
import HttpError from '../utils/HttpError';

export function uploadProof(buffer: Buffer) {
    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: env.CLOUDINARY_FOLDER,
                resource_type: 'image',
                type: 'authenticated', // not publicly readable without a signature
                unique_filename: true,
                overwrite: false,
            },
            (err, result) => {
                if (err) {
                    console.error('Cloudinary upload failed:', err.message || err);
                    return reject(new HttpError(502, 'Could not upload the receipt image. Please try again.'));
                }
                resolve({ url: result!.secure_url, publicId: result!.public_id });
            }
        );
        stream.end(buffer);
    });
}

// Signed URL, used only server-side. Browsers get the image through /api/payments/:id/receipt.
export function signedUrl(publicId: string) {
    return cloudinary.url(publicId, {
        resource_type: 'image',
        type: 'authenticated',
        sign_url: true,
        secure: true,
    });
}

export async function deleteImage(publicId: string) {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated' });
    } catch (err: any) {
        console.error('Cloudinary cleanup failed for', publicId, err.message || err);
    }
}
