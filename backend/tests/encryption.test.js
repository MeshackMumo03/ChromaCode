const { describe, it } = require('node:test');
const assert = require('node:assert');

process.env.MESSAGE_ENCRYPTION_KEY = 'a'.repeat(64);

const { encrypt, decrypt } = require('../src/utils/encryption');

describe('encryption', () => {
  it('round-trips plain text', () => {
    const original = 'Hello, ChromaCode!';
    const encrypted = encrypt(original);
    assert.notStrictEqual(encrypted, original);
    assert.strictEqual(decrypt(encrypted), original);
  });

  it('returns existing plaintext strings unchanged', () => {
    const original = 'some unencrypted legacy message';
    assert.strictEqual(decrypt(original), original);
  });

  it('returns empty strings unchanged', () => {
    assert.strictEqual(encrypt(''), '');
    assert.strictEqual(decrypt(''), '');
  });
});
