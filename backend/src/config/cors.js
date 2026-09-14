const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
);

module.exports = {
  origin(origin, callback) {
    callback(null, origin === undefined || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
