/**
 * Turns thrown errors into JSON responses. Bad client input becomes a clear 4xx,
 * and unexpected failures return a generic message so internal details (database
 * errors, stack traces) never reach the client.
 */
function clientError(err) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).find((key) => key !== 'user') || 'value';
    return { status: 400, message: `That ${field} is already taken` };
  }
  if (err.name === 'CastError') return { status: 400, message: `Invalid ${err.path || 'value'}` };
  if (err.name === 'ValidationError') return { status: 400, message: err.message };
  if (err.code === 'LIMIT_FILE_SIZE') return { status: 413, message: 'That file is too large' };
  if (err.name === 'MulterError') return { status: 400, message: err.message };
  // Cloudinary answers 400 when the file itself is the problem (too big for
  // the plan, unreadable image); its message says why, so pass it on.
  if (err.name === 'CloudinaryError' && err.httpCode === 400) return { status: 400, message: `Upload rejected: ${err.message}` };
  if (err.type === 'entity.too.large') return { status: 413, message: 'That request is too large' };
  if (err.type === 'entity.parse.failed') return { status: 400, message: 'Invalid JSON' };
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const known = clientError(err);
  if (known) return res.status(known.status).json({ message: known.message });

  const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  if (statusCode >= 500) {
    // Not everything thrown is an Error; log what we got instead of "undefined".
    const detail = err && err.httpCode ? ` (upstream status ${err.httpCode})` : '';
    console.error(`${req.method} ${req.originalUrl} failed${detail}:`, (err && err.stack) || err);
  }
  return res.status(statusCode).json({
    message: statusCode >= 500 ? 'Something went wrong on our side' : err.message,
  });
}

module.exports = errorHandler;
