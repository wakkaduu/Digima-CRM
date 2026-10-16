const multer = require('multer');
const { HttpError } = require('./errorHandler');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const multerInstance = multer({
    storage: multer.memoryStorage(), // buffer goes straight to Cloudinary, nothing touches disk
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
        cb(new HttpError(400, 'Receipt must be a JPG, PNG or WebP image'));
    },
});

const single = multerInstance.single('proof'); // form field name: "proof"

// Wraps multer so its errors become clean 400s instead of 500s.
const uploadProof = (req, res, next) =>
    single(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const msg =
                err.code === 'LIMIT_FILE_SIZE'
                    ? 'Receipt image must be 5 MB or smaller'
                    : `Upload error: ${err.message}`;
            return next(new HttpError(400, msg));
        }
        next(err);
    });

// The browser-supplied mimetype can be spoofed, so check the real file signature too.
function hasImageSignature(buf) {
    if (!buf || buf.length < 12) return false;
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp =
        buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP';
    return jpeg || png || webp;
}

const verifyImageSignature = (req, res, next) => {
    if (!req.file) return next(new HttpError(400, 'Receipt image is required'));
    if (!hasImageSignature(req.file.buffer)) {
        return next(new HttpError(400, 'File is not a valid JPG, PNG or WebP image'));
    }
    next();
};

module.exports = { uploadProof, verifyImageSignature };