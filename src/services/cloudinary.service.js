const cloudinary = require('../config/cloudinary');
const env = require('../config/env');
const { HttpError } = require('../middleware/errorHandler');

function uploadProof(buffer) {
    return new Promise((resolve, reject) => {
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
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        stream.end(buffer);
    });
}

// Signed URL, used only server-side. Browsers get the image through /api/payments/:id/receipt.
function signedUrl(publicId) {
    return cloudinary.url(publicId, {
        resource_type: 'image',
        type: 'authenticated',
        sign_url: true,
        secure: true,
    });
}

async function deleteImage(publicId) {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated' });
    } catch (err) {
        console.error('Cloudinary cleanup failed for', publicId, err.message || err);
    }
}

module.exports = { uploadProof, signedUrl, deleteImage };