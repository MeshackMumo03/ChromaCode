const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(path.dirname(module.filename), '../constants/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, URL, process: { env: {} }, require: (name) => {
  assert.equal(name, 'expo-constants');
  return { default: { expoConfig: {} } };
} };
vm.runInNewContext(compiled, context);
const { getVideoThumbnailUrl, getImageUrl } = context.exports;

test('Cloudinary video thumbnails transform only the exact trusted hostname', () => {
  assert.equal(getVideoThumbnailUrl('https://res.cloudinary.com/demo/video/upload/clip.mp4'), 'https://res.cloudinary.com/demo/video/upload/so_0/clip.jpg');
  for (const url of [
    'https://res.cloudinary.com.evil.invalid/demo/video/upload/clip.mp4',
    'https://evil.invalid/res.cloudinary.com/video/upload/clip.mp4',
    'https://res.cloudinary.com@evil.invalid/video/upload/clip.mp4',
  ]) assert.equal(getVideoThumbnailUrl(url), url);
});

test('existing image URL fallbacks and local uploads are preserved', () => {
  assert.equal(getImageUrl(undefined), 'https://www.gravatar.com/avatar/?d=mp');
  assert.equal(getImageUrl('/uploads/test.png'), 'https://chromacode.onrender.com/uploads/test.png');
  assert.equal(getImageUrl('https://res.cloudinary.com/demo/image/upload/photo.png'), 'https://res.cloudinary.com/demo/image/upload/photo.png');
});
