const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { format } = require('node:util');
const express = require('express');
const multer = require('multer');
const cloudinary = require('./src/config/cloudinary');
const CloudinaryStorage = require('./src/config/cloudinaryStorage');
const errorHandler = require('./src/middleware/errorHandler');

async function serve(t, app) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

// Cloudinary calls back with a plain object, not an Error, when it rejects an upload.
async function uploadWhileCloudinaryRejects(t, rejection) {
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => {
    const sink = new PassThrough();
    sink.on('finish', () => callback(rejection));
    sink.resume();
    return sink;
  });
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(format(...args)));

  const app = express();
  const upload = multer({ storage: new CloudinaryStorage({ folder: 'test' }) });
  app.post('/upload', upload.single('file'), (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const base = await serve(t, app);

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('hello')], { type: 'image/png' }), 'photo.png');
  const response = await fetch(`${base}/upload`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json(), logged };
}

test('a Cloudinary credentials failure is logged with its real reason', async (t) => {
  const { status, body, logged } = await uploadWhileCloudinaryRejects(t, { message: 'Invalid api_key abc', http_code: 401 });
  assert.equal(status, 500);
  assert.equal(body.message, 'Something went wrong on our side');
  assert.equal(logged.length, 1);
  assert.match(logged[0], /POST \/upload failed \(upstream status 401\):.*Invalid api_key abc/s);
  assert.doesNotMatch(logged[0], /^undefined$/);
});

test('a file Cloudinary refuses gets a 400 that says why', async (t) => {
  const { status, body, logged } = await uploadWhileCloudinaryRejects(t, { message: 'File size too large. Got 12000000. Maximum is 10485760.', http_code: 400 });
  assert.equal(status, 400);
  assert.equal(body.message, 'Upload rejected: File size too large. Got 12000000. Maximum is 10485760.');
  assert.equal(logged.length, 0);
});

test('non-Error values thrown elsewhere are logged instead of "undefined"', async (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(format(...args)));
  const app = express();
  app.get('/boom', () => { throw { message: 'plain object' }; });
  app.use(errorHandler);
  const base = await serve(t, app);
  const response = await fetch(`${base}/boom`);
  assert.equal(response.status, 500);
  assert.match(logged[0], /GET \/boom failed:/);
  assert.doesNotMatch(logged[0], /undefined/);
});

test('format characters in the URL cannot garble the error log', async (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(format(...args)));
  const app = express();
  app.get('/boom', () => { throw new Error('real cause'); });
  app.use(errorHandler);
  const base = await serve(t, app);
  await fetch(`${base}/boom?q=%s%o%d`);
  assert.match(logged[0], /GET \/boom\?q=%s%o%d failed:.*real cause/s);
});
