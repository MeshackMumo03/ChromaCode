const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const express = require('express');
const multer = require('multer');
const qs = require('qs');
const User = require('./src/models/User');
const Code = require('./src/models/Code');
const { updateCode } = require('./src/controllers/codeController');

async function codeApi(t) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: '507f1f77bcf86cd799439011' }; next(); });
  app.put('/codes/:id', updateCode);
  app.use((err, req, res, next) => res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: err.message }));
  return serve(t, app);
}

test('code updates reject ownership and operator injection', async (t) => {
  t.mock.method(Code, 'findById', async () => ({ user: '507f1f77bcf86cd799439011' }));
  const update = t.mock.method(Code, 'findByIdAndUpdate', async () => ({}));
  const base = await codeApi(t);
  for (const body of [{ user: 'another-user' }, { $set: { user: 'another-user' } }, { name: { $ne: null } }, { sharedWith: ['another-user'] }]) {
    const response = await fetch(`${base}/codes/507f1f77bcf86cd799439012`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
  assert.equal(update.mock.callCount(), 0);
});

test('code updates accept only editable strings and enforce ownership', async (t) => {
  t.mock.method(Code, 'findByIdAndUpdate', async () => ({}));
  t.mock.method(Code, 'findById', async () => ({ user: '507f1f77bcf86cd799439011' }));
  t.mock.method(Code, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: '507f1f77bcf86cd799439012', user: '507f1f77bcf86cd799439011' });
    assert.deepEqual(update, { $set: { name: 'New name', color: '#abcdef', meaning: 'Updated meaning' } });
    assert.equal(options.runValidators, true);
    return { name: update.$set.name };
  });
  const base = await codeApi(t);
  const response = await fetch(`${base}/codes/507f1f77bcf86cd799439012`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New name', color: '#abcdef', meaning: 'Updated meaning' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, 'New name');
});

async function serve(t, app) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

for (const route of ['codeRoutes', 'historyRoutes']) {
  test(`${route} applies rate limiting before database access`, async (t) => {
    process.env.JWT_SECRET = 'local-regression-test-only-not-a-deployment-secret';
    t.mock.method(console, 'log', () => {});
    t.mock.method(Code, 'find', async () => []);
    const HistoryItem = require('./src/models/HistoryItem');
    t.mock.method(HistoryItem, 'find', () => ({ populate: () => ({ sort: async () => [] }) }));
    const app = express();
    app.use((req, res, next) => { req.user = { id: '507f1f77bcf86cd799439011', _id: '507f1f77bcf86cd799439011' }; next(); });
    app.use('/', require(`./src/routes/${route}`));
    const base = await serve(t, app);
    let response;
    for (let i = 0; i < 121; i++) {
      response = await fetch(base);
      await response.text();
    }
    assert.equal(response.status, 429);
    assert.ok(response.headers.get('retry-after'));
  });
}

test('CORS permits exact configured origins and native clients only', async (t) => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://app.example.com, http://localhost:8081';
  const configPath = require.resolve('./src/config/cors');
  delete require.cache[configPath];
  t.after(() => {
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
    delete require.cache[configPath];
  });
  const options = require(configPath);
  const app = express();
  app.use(require('cors')(options));
  app.get('/', (req, res) => res.sendStatus(200));
  const base = await serve(t, app);
  for (const origin of ['https://app.example.com', 'http://localhost:8081']) {
    const response = await fetch(base, { headers: { Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
  for (const origin of ['https://app.example.com.evil.invalid', 'https://evil.invalid', 'null']) {
    const response = await fetch(base, { headers: { Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal((await fetch(base)).status, 200);
});

test('password reset codes do not use Math.random', async (t) => {
  process.env.JWT_SECRET = 'local-regression-test-only-not-a-deployment-secret';
  const { forgotPassword } = require('./src/controllers/userController');
  const user = { save: async () => {} };
  t.mock.method(User, 'findOne', async () => user);
  t.mock.method(Math, 'random', () => { throw new Error('Insecure random source used'); });
  t.mock.method(global, 'fetch', async () => ({ ok: true }));
  await new Promise((resolve, reject) => {
    forgotPassword({ body: { email: 'regression@example.com' } }, {
      json: resolve,
      status() { return this; },
    }, reject);
  });
  assert.match(user.resetPasswordCode, /^[0-9]{6}$/);
  assert.ok(user.resetPasswordExpires > Date.now());
});

test('multipart upload preserves file bytes and rejects oversized files', async (t) => {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 } });
  app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ name: req.file.originalname, size: req.file.size, text: req.file.buffer.toString() });
  });
  app.use((err, req, res, next) => res.status(400).json({ code: err.code }));
  const base = await serve(t, app);
  const body = new FormData();
  body.append('file', new Blob(['upload regression']), 'test.txt');
  const response = await fetch(`${base}/upload`, { method: 'POST', body });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: 'test.txt', size: 17, text: 'upload regression' });
  const oversized = new FormData();
  oversized.append('file', new Blob(['x'.repeat(33)]), 'test.txt');
  const rejected = await fetch(`${base}/upload`, { method: 'POST', body: oversized });
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, 'LIMIT_FILE_SIZE');
});

test('query parser handles normal arrays and untrusted isBuffer keys safely', () => {
  assert.deepEqual(qs.parse('a[0]=one&a[1]=two'), { a: ['one', 'two'] });
  assert.doesNotThrow(() => qs.parse('isBuffer=true&a[b]=value'));
  assert.equal(Object.prototype.polluted, undefined);
});

test('email accepts common addresses and rejects malformed addresses', () => {
  for (const email of ['testuser_devin@example.com', 'first.last+tag@example.technology']) {
    const error = new User({ username: 'test', password: 'testing123', email }).validateSync();
    assert.equal(error, undefined, email);
  }
  for (const email of ['missing-at', 'a@@example.com', 'a@domain', 'a b@example.com', 'a@example.com\n']) {
    const validate = User.schema.path('email').validators.find((entry) => entry.type === 'user defined');
    assert.ok(validate, 'email must use a bounded validator');
    assert.equal(validate.validator(email), false, email);
  }
});

test('email validation rejects long adversarial input without blocking', () => {
  const source = "const User = require('./src/models/User'); const user = new User({ username: 'test', password: 'testing123', email: 'a'.repeat(20000) + '!' }); if (!user.validateSync()) process.exit(2);";
  const result = spawnSync(process.execPath, ['-e', source], { cwd: require('node:path').dirname(module.filename), timeout: 3000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
});

async function googleApi(t) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-regression-test-only-not-a-deployment-secret';
  process.env.GOOGLE_WEB_CLIENT_ID = 'test-web-client.apps.googleusercontent.com';
  const { googleLogin } = require('./src/controllers/userController');
  const app = express();
  app.use(express.json());
  app.post('/google-login', googleLogin);
  app.use((err, req, res, next) => res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: err.message }));
  return serve(t, app);
}

test('google login rejects requests without a verified Google ID token', async (t) => {
  const { client } = require('./src/utils/googleAuth');
  const findOne = t.mock.method(User, 'findOne', async () => { throw new Error('must not reach the database'); });
  t.mock.method(client, 'verifyIdToken', async () => { throw new Error('Invalid token signature'); });
  const base = await googleApi(t);
  for (const body of [{ email: 'victim@example.com', username: 'x' }, { email: 'victim@example.com', idToken: 'forged' }]) {
    const response = await fetch(`${base}/google-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 401);
  }
  assert.equal(findOne.mock.callCount(), 0);
});

test('google login uses the email from the verified token, not the request body', async (t) => {
  const { client } = require('./src/utils/googleAuth');
  t.mock.method(client, 'verifyIdToken', async ({ audience }) => {
    assert.ok(audience.includes('test-web-client.apps.googleusercontent.com'));
    return { getPayload: () => ({ email: 'Real.User@example.com', email_verified: true, name: 'Real User' }) };
  });
  const lookups = [];
  t.mock.method(User, 'findOne', async (query) => { lookups.push(query.email); return { id: 'u1', email: query.email, save: async () => {} }; });
  const base = await googleApi(t);
  const response = await fetch(`${base}/google-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'valid', email: 'victim@example.com' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(lookups, ['real.user@example.com']);
});

test('google login rejects tokens whose email Google has not verified', async (t) => {
  const { client } = require('./src/utils/googleAuth');
  t.mock.method(client, 'verifyIdToken', async () => ({ getPayload: () => ({ email: 'someone@example.com', email_verified: false }) }));
  const findOne = t.mock.method(User, 'findOne', async () => null);
  const base = await googleApi(t);
  const response = await fetch(`${base}/google-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'valid' }) });
  assert.equal(response.status, 401);
  assert.equal(findOne.mock.callCount(), 0);
});
