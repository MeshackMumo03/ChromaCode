const cloudinary = require('./cloudinary');

/**
 * Cloudinary reports a rejected upload as a plain object ({ message, http_code }),
 * not an Error, so it had no stack and the server logged only "undefined".
 * Wrap it so the real reason reaches the logs and the error handler.
 */
function toUploadError(error) {
  if (error instanceof Error && !error.http_code) return error;
  const wrapped = new Error(error.message || 'Cloudinary upload failed');
  wrapped.name = 'CloudinaryError';
  wrapped.httpCode = error.http_code;
  return wrapped;
}

/**
 * A minimal multer storage engine that streams uploaded files straight to
 * Cloudinary using the (actively maintained) cloudinary v2 SDK.
 *
 * We write this ourselves instead of using the `multer-storage-cloudinary`
 * package because that package has been unmaintained for years and still
 * declares a hard peer dependency on cloudinary@^1.x, which conflicts with
 * the modern v2 SDK.
 *
 * Usage:
 *   const storage = new CloudinaryStorage({ folder: 'my-folder', resourceType: 'auto' });
 *   const upload = multer({ storage });
 *
 * After upload, multer attaches these fields to req.file:
 *   - path      -> the permanent Cloudinary URL (secure_url)
 *   - filename  -> the Cloudinary public_id (needed to delete the asset later)
 */
class CloudinaryStorage {
  constructor({ folder, resourceType = 'auto' }) {
    this.folder = folder;
    this.resourceType = resourceType;
  }

  _handleFile(req, file, cb) {
    const publicId = `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: this.folder,
        resource_type: this.resourceType,
        public_id: publicId,
      },
      (error, result) => {
        if (error) {
          return cb(toUploadError(error));
        }
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
          resourceType: result.resource_type,
        });
      }
    );

    file.stream.on('error', (err) => cb(err));
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    if (!file.filename) return cb(null);
    // Cloudinary only finds the asset under its real type (image, video or raw).
    cloudinary.uploader.destroy(
      file.filename,
      { resource_type: file.resourceType || 'image', invalidate: true },
      (error) => cb(error),
    );
  }
}

module.exports = CloudinaryStorage;
module.exports.toUploadError = toUploadError;
