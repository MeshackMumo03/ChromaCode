const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Code = require('../models/Code');
const HistoryItem = require('../models/HistoryItem');
const cloudinary = require('../config/cloudinary');

/**
 * Turns a Cloudinary delivery URL into the { publicId, resourceType } needed
 * to destroy the asset, e.g.
 *   https://res.cloudinary.com/<cloud>/image/upload/v1712/chromacode/messages/123-photo.jpg
 *   -> { resourceType: 'image', publicId: 'chromacode/messages/123-photo' }
 * Raw files (documents) keep their extension as part of the public ID.
 * Returns null for anything that isn't a Cloudinary upload URL.
 */
function parseCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'res.cloudinary.com') return null;

  // /<cloud>/<resource_type>/upload/[transformations/][v<version>/]<public_id>
  const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex < 2) return null;
  const resourceType = parts[uploadIndex - 1];
  if (!['image', 'video', 'raw'].includes(resourceType)) return null;

  let rest = parts.slice(uploadIndex + 1);
  const versionIndex = rest.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionIndex >= 0) rest = rest.slice(versionIndex + 1);
  if (rest.length === 0) return null;

  let publicId = rest.join('/');
  if (resourceType !== 'raw') publicId = publicId.replace(/\.[^/.]+$/, '');
  return { publicId, resourceType };
}

async function destroyCloudinaryAssets(urls) {
  const assets = new Map();
  for (const url of urls) {
    const asset = parseCloudinaryUrl(url);
    if (asset) assets.set(`${asset.resourceType}:${asset.publicId}`, asset);
  }

  let failed = 0;
  for (const { publicId, resourceType } of assets.values()) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    } catch (err) {
      failed += 1;
      console.error(`Account deletion: could not delete Cloudinary asset ${resourceType}/${publicId}:`, err?.message || err);
    }
  }
  return { attempted: assets.size, failed };
}

/** Points a conversation's lastMessage at its newest remaining message. */
async function refreshLastMessage(conversationId) {
  const latest = await Message.findOne({ conversationId }).sort({ timestamp: -1, _id: -1 }).select('_id');
  await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessage: latest ? latest._id : null } });
}

/**
 * Permanently deletes a user and everything tied to them:
 * - every message they sent (in direct chats and groups) and its media,
 * - direct conversations they were part of (including the other person's
 *   messages in that chat, since the chat can no longer be used),
 * - their membership of group chats (groups they were the last member of are
 *   deleted; admin passes to the next member),
 * - their colour codes and code history,
 * - their profile picture and banner,
 * - their reactions, read receipts, friendships, friend requests and blocks
 *   on other users' data.
 * Media on Cloudinary is deleted after the database is cleaned up; a failed
 * media deletion is logged and does not undo the account deletion.
 */
async function deleteAccount(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  const id = user._id;
  const mediaUrls = [user.profilePicture, user.banner];

  // Direct chats: the whole conversation goes.
  const directChats = await Conversation.find({ participants: id, isGroup: { $ne: true } }).select('_id');
  const directChatIds = directChats.map((c) => c._id);

  // Groups: leave, hand over admin, or delete the group if nobody is left.
  const groups = await Conversation.find({ participants: id, isGroup: true }).select('_id participants groupAdmin groupImage');
  const emptyGroupIds = [];
  const keptGroupIds = [];
  for (const group of groups) {
    const remaining = group.participants.filter((p) => !p.equals(id));
    if (remaining.length === 0) {
      emptyGroupIds.push(group._id);
      mediaUrls.push(group.groupImage);
      continue;
    }
    const update = { $pull: { participants: id } };
    if (group.groupAdmin && group.groupAdmin.equals(id)) update.$set = { groupAdmin: remaining[0] };
    await Conversation.updateOne({ _id: group._id }, update);
    keptGroupIds.push(group._id);
  }

  const deletedConversationIds = [...directChatIds, ...emptyGroupIds];

  // Collect media from every message that is about to be deleted.
  const doomedMessages = await Message.find({
    $or: [{ sender: id }, { conversationId: { $in: deletedConversationIds } }],
  }).select('mediaUrl');
  for (const message of doomedMessages) mediaUrls.push(message.mediaUrl);

  await Message.deleteMany({ $or: [{ sender: id }, { conversationId: { $in: deletedConversationIds } }] });
  await Conversation.deleteMany({ _id: { $in: deletedConversationIds } });

  // Their reactions and read receipts on messages that remain.
  await Message.updateMany({ 'reactions.userId': id }, { $pull: { reactions: { userId: id } } });
  await Message.updateMany({ readBy: id }, { $pull: { readBy: id } });

  // Groups they left may now point at one of their deleted messages.
  for (const groupId of keptGroupIds) await refreshLastMessage(groupId);

  await Code.deleteMany({ user: id });
  await Code.updateMany({ sharedWith: id }, { $pull: { sharedWith: id } });
  await HistoryItem.deleteMany({ user: id });

  await User.updateMany(
    { $or: [{ friends: id }, { blockedUsers: id }, { 'friendRequests.from': id }] },
    { $pull: { friends: id, blockedUsers: id, friendRequests: { from: id } } },
  );

  await User.deleteOne({ _id: id });

  const media = await destroyCloudinaryAssets(mediaUrls);
  return {
    messagesDeleted: doomedMessages.length,
    conversationsDeleted: deletedConversationIds.length,
    groupsLeft: keptGroupIds.length,
    media,
  };
}

module.exports = { deleteAccount, parseCloudinaryUrl };
