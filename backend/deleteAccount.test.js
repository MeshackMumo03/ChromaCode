// Integration test for account deletion against a real MongoDB.
// Runs when MONGO_TEST_URI is set (CI starts a mongo service); skipped otherwise.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const uri = process.env.MONGO_TEST_URI;
const skip = !uri && 'MONGO_TEST_URI not set';

const User = require('./src/models/User');
const Message = require('./src/models/Message');
const Conversation = require('./src/models/Conversation');
const Code = require('./src/models/Code');
const HistoryItem = require('./src/models/HistoryItem');
const cloudinary = require('./src/config/cloudinary');
const { deleteAccount, parseCloudinaryUrl } = require('./src/utils/deleteAccount');

const CDN = 'https://res.cloudinary.com/demo';

before(async () => {
  if (skip) return;
  await mongoose.connect(uri, { dbName: `chromacode-test-${process.pid}` });
});

after(async () => {
  if (skip) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const makeUser = (username, extra = {}) => User.create({
  username, email: `${username}@example.com`, password: 'hashed-password', ...extra,
});

test('parseCloudinaryUrl extracts public IDs and ignores other hosts', { skip: false }, () => {
  assert.deepEqual(parseCloudinaryUrl(`${CDN}/image/upload/v1712/chromacode/messages/123-photo.jpg`),
    { resourceType: 'image', publicId: 'chromacode/messages/123-photo' });
  assert.deepEqual(parseCloudinaryUrl(`${CDN}/video/upload/so_0/v9/chromacode/messages/clip.mp4`),
    { resourceType: 'video', publicId: 'chromacode/messages/clip' });
  assert.deepEqual(parseCloudinaryUrl(`${CDN}/raw/upload/v1/chromacode/messages/123-report%20final.pdf`),
    { resourceType: 'raw', publicId: 'chromacode/messages/123-report final.pdf' });
  for (const url of ['https://www.gravatar.com/avatar/?d=mp', '', null, 'not a url',
    'https://res.cloudinary.com.evil.example/demo/image/upload/v1/x.jpg']) {
    assert.equal(parseCloudinaryUrl(url), null, String(url));
  }
});

test('deleting an account removes all of the user\'s data and nothing of anyone else\'s', { skip }, async (t) => {
  const destroyed = [];
  t.mock.method(cloudinary.uploader, 'destroy', async (publicId, opts) => {
    destroyed.push(`${opts.resource_type}:${publicId}`);
    return { result: 'ok' };
  });

  const alice = await makeUser('alice', {
    profilePicture: `${CDN}/image/upload/v1/chromacode/profile-pictures/alice.jpg`,
    banner: `${CDN}/image/upload/v1/chromacode/profile-pictures/alice-banner.png`,
  });
  const bob = await makeUser('bob');
  const carol = await makeUser('carol');

  await User.updateOne({ _id: bob._id }, { $push: { friends: alice._id } });
  await User.updateOne({ _id: alice._id }, { $push: { friends: bob._id } });
  await User.updateOne({ _id: carol._id }, { $push: { blockedUsers: alice._id, friendRequests: { from: alice._id } } });

  // Direct chat alice <-> bob: the whole conversation should go.
  const dm = await Conversation.create({ participants: [alice._id, bob._id] });
  await Message.create({ conversationId: dm._id, sender: alice._id, text: 'hi', mediaType: 'image', mediaUrl: `${CDN}/image/upload/v1/chromacode/messages/dm-photo.jpg` });
  await Message.create({ conversationId: dm._id, sender: bob._id, text: 'hey', mediaType: 'document', mediaUrl: `${CDN}/raw/upload/v1/chromacode/messages/bob-doc.pdf` });

  // Group with bob and carol, alice is admin: alice leaves, bob becomes admin.
  const group = await Conversation.create({ participants: [alice._id, bob._id, carol._id], isGroup: true, name: 'Team', groupAdmin: alice._id });
  const bobGroupMsg = await Message.create({ conversationId: group._id, sender: bob._id, text: 'group hello', timestamp: new Date(1000), readBy: [alice._id, carol._id], reactions: [{ emoji: '👍', userId: alice._id }, { emoji: '🎉', userId: carol._id }] });
  const aliceGroupMsg = await Message.create({ conversationId: group._id, sender: alice._id, text: 'bye', timestamp: new Date(2000), mediaType: 'video', mediaUrl: `${CDN}/video/upload/v1/chromacode/messages/alice-clip.mp4` });
  await Conversation.updateOne({ _id: group._id }, { lastMessage: aliceGroupMsg._id });

  // Group where alice is the only member: deleted, with its image.
  const solo = await Conversation.create({ participants: [alice._id], isGroup: true, name: 'Just me', groupAdmin: alice._id, groupImage: `${CDN}/image/upload/v1/chromacode/profile-pictures/solo-group.jpg` });
  await Message.create({ conversationId: solo._id, sender: alice._id, text: 'note to self' });

  // Unrelated chat between bob and carol must be untouched.
  const bobCarol = await Conversation.create({ participants: [bob._id, carol._id] });
  await Message.create({ conversationId: bobCarol._id, sender: carol._id, text: 'unrelated' });

  await Code.create({ user: alice._id, name: 'Red', color: '#ff0000', meaning: 'stop', sharedWith: [bob._id] });
  const bobCode = await Code.create({ user: bob._id, name: 'Blue', color: '#0000ff', meaning: 'calm', sharedWith: [alice._id, carol._id] });
  await HistoryItem.create({ user: alice._id, code: { name: 'Red', meaning: 'stop', color: '#ff0000' }, recipient: bob._id });
  await HistoryItem.create({ user: bob._id, code: { name: 'Blue', meaning: 'calm', color: '#0000ff' }, recipient: alice._id });

  const result = await deleteAccount(alice._id);

  assert.equal(await User.countDocuments({ _id: alice._id }), 0);
  assert.equal(await Message.countDocuments({ sender: alice._id }), 0);
  assert.equal(await Conversation.countDocuments({ _id: { $in: [dm._id, solo._id] } }), 0);
  assert.equal(await Message.countDocuments({ conversationId: { $in: [dm._id, solo._id] } }), 0);
  assert.equal(await Code.countDocuments({ user: alice._id }), 0);
  assert.equal(await HistoryItem.countDocuments({ user: alice._id }), 0);

  const groupAfter = await Conversation.findById(group._id);
  assert.deepEqual(groupAfter.participants.map(String), [String(bob._id), String(carol._id)]);
  assert.equal(String(groupAfter.groupAdmin), String(bob._id));
  assert.equal(String(groupAfter.lastMessage), String(bobGroupMsg._id));

  const bobMsgAfter = await Message.findById(bobGroupMsg._id);
  assert.deepEqual(bobMsgAfter.readBy.map(String), [String(carol._id)]);
  assert.deepEqual(bobMsgAfter.reactions.map((r) => String(r.userId)), [String(carol._id)]);

  const [bobAfter, carolAfter] = await Promise.all([User.findById(bob._id), User.findById(carol._id)]);
  assert.equal(bobAfter.friends.length, 0);
  assert.equal(carolAfter.blockedUsers.length, 0);
  assert.equal(carolAfter.friendRequests.length, 0);
  assert.deepEqual((await Code.findById(bobCode._id)).sharedWith.map(String), [String(carol._id)]);

  // Other people's data stays.
  assert.equal(await Message.countDocuments({ conversationId: bobCarol._id }), 1);
  assert.equal(await HistoryItem.countDocuments({ user: bob._id }), 1);
  assert.equal(await User.countDocuments({ _id: { $in: [bob._id, carol._id] } }), 2);

  assert.deepEqual(destroyed.sort(), [
    'image:chromacode/messages/dm-photo',
    'image:chromacode/profile-pictures/alice',
    'image:chromacode/profile-pictures/alice-banner',
    'image:chromacode/profile-pictures/solo-group',
    'raw:chromacode/messages/bob-doc.pdf',
    'video:chromacode/messages/alice-clip',
  ]);
  assert.equal(result.media.failed, 0);
  assert.equal(result.conversationsDeleted, 2);
  assert.equal(result.groupsLeft, 1);
});

test('a failed media deletion does not stop the account deletion', { skip }, async (t) => {
  t.mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('Cloudinary down'); });
  t.mock.method(console, 'error', () => {});
  const dave = await makeUser('dave', { profilePicture: `${CDN}/image/upload/v1/chromacode/profile-pictures/dave.jpg` });
  const result = await deleteAccount(dave._id);
  assert.equal(await User.countDocuments({ _id: dave._id }), 0);
  assert.equal(result.media.failed, 1);
});

test('deleting an unknown user returns null', { skip }, async () => {
  assert.equal(await deleteAccount(new mongoose.Types.ObjectId()), null);
});
