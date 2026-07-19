const cloudinary = require('./cloudinary');

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
          return cb(error);
        }
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
        });
      }
    );

    file.stream.on('error', (err) => cb(err));
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    if (!file.filename) return cb(null);
    cloudinary.uploader.destroy(file.filename, (error) => cb(error));
  }
}

module.exports = CloudinaryStorage;
