/**
 * Media loading quick pass.
 * Cache identity, upload resize, chat URL stability, and one-request screen entry.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMediaCacheKey } from '../src/lib/mediaCacheKey.ts';
import { shouldClearMediaImageCache } from '../src/lib/mediaCacheOwner.ts';
import {
  AVATAR_MAX_EDGE,
  PHOTO_MAX_EDGE,
  planUploadResize,
} from '../src/lib/imageUploadPlan.ts';
import {
  mergeChatMessages,
  signedUrlStillUsable,
} from '../src/lib/mergeChatMessages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, '..', 'mawahib-backend');
const read = (path) => readFileSync(join(root, path), 'utf8');
const readBackend = (path) => readFileSync(join(backend, path), 'utf8');

function signed(path, exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `https://cdn.example/storage/v1/object/sign/${path}?token=hdr.${payload}.sig`;
}

const avatarA =
  'https://cdn.example/storage/v1/object/public/avatars/user-a/face.jpg';
const avatarB =
  'https://cdn.example/storage/v1/object/public/avatars/user-a/face.jpg?t=2';
assert.equal(getMediaCacheKey(avatarA), 'avatars/user-a/face.jpg');
assert.equal(getMediaCacheKey(avatarB), getMediaCacheKey(avatarA));

const now = 1_700_000_000_000;
const first = signed('messages/user-a/photo.jpg', Math.floor(now / 1000) + 3600);
const second = signed('messages/user-a/photo.jpg', Math.floor(now / 1000) + 3500);
assert.equal(getMediaCacheKey(first), 'messages/user-a/photo.jpg');
assert.equal(getMediaCacheKey(first), getMediaCacheKey(second));
assert.equal(getMediaCacheKey('file:///tmp/local.jpg'), undefined);
assert.notEqual(
  getMediaCacheKey(signed('posts/user-a/other.jpg', Math.floor(now / 1000) + 3600)),
  getMediaCacheKey(first),
);

assert.equal(shouldClearMediaImageCache(undefined, 'user-a'), false);
assert.equal(shouldClearMediaImageCache(null, 'user-b'), false);
assert.equal(shouldClearMediaImageCache('user-a', null), true);
assert.equal(shouldClearMediaImageCache('user-a', 'user-b'), true);
assert.equal(shouldClearMediaImageCache('user-a', 'user-a'), false);

const avatarPlan = planUploadResize({
  purpose: 'avatar',
  mimeType: 'image/jpeg',
  width: 5712,
  height: 4284,
});
assert.equal(avatarPlan.resize, true);
if (avatarPlan.resize) {
  assert.equal(avatarPlan.maxEdge, AVATAR_MAX_EDGE);
  assert.equal(avatarPlan.width, 512);
  assert.equal(avatarPlan.height, 384);
  assert.ok(avatarPlan.width <= AVATAR_MAX_EDGE);
  assert.ok(avatarPlan.height <= AVATAR_MAX_EDGE);
}

const postPlan = planUploadResize({
  purpose: 'post',
  mimeType: 'image/jpeg',
  width: 4000,
  height: 3000,
});
assert.equal(postPlan.resize, true);
if (postPlan.resize) {
  assert.equal(postPlan.maxEdge, PHOTO_MAX_EDGE);
  assert.equal(postPlan.width, 1600);
  assert.equal(postPlan.height, 1200);
}

for (const purpose of ['portfolio', 'service', 'message']) {
  const plan = planUploadResize({
    purpose,
    mimeType: 'image/jpeg',
    width: 4288,
    height: 2848,
  });
  assert.equal(plan.resize, true);
  if (plan.resize) assert.ok(Math.max(plan.width, plan.height) <= PHOTO_MAX_EDGE);
}

assert.deepEqual(
  planUploadResize({
    purpose: 'message',
    mimeType: 'application/pdf',
    width: 2000,
    height: 2000,
  }),
  { resize: false },
);
assert.deepEqual(
  planUploadResize({
    purpose: 'post',
    mimeType: 'image/gif',
    width: 4000,
    height: 3000,
  }),
  { resize: false },
);
assert.deepEqual(
  planUploadResize({
    purpose: 'avatar',
    mimeType: 'image/jpeg',
    width: 200,
    height: 200,
  }),
  { resize: false },
);
const smallHeic = planUploadResize({
  purpose: 'message',
  mimeType: 'image/heic',
  width: 800,
  height: 600,
});
assert.equal(smallHeic.resize, true);
if (smallHeic.resize) {
  assert.equal(smallHeic.format, 'jpeg');
  assert.equal(smallHeic.width, 800);
  assert.equal(smallHeic.height, 600);
}
const png = planUploadResize({
  purpose: 'message',
  mimeType: 'image/png',
  width: 3000,
  height: 1500,
});
assert.equal(png.resize, true);
if (png.resize) assert.equal(png.format, 'png');

const freshExp = Math.floor(now / 1000) + 3600;
const message = {
  id: 'm1',
  createdAt: '2026-08-17T12:00:00.000Z',
  attachments: [
    { id: 'a1', mediaAssetId: 'asset-1', url: first },
    { id: 'a2', mediaAssetId: 'asset-2', url: signed('messages/user-a/b.jpg', freshExp) },
  ],
};
const polled = {
  ...message,
  attachments: [
    { id: 'a1', mediaAssetId: 'asset-1', url: second },
    { id: 'a2', mediaAssetId: 'asset-9', url: signed('messages/user-a/new.jpg', freshExp) },
  ],
};
const merged = mergeChatMessages([message], [polled], now);
assert.equal(merged[0].attachments[0].url, first);
assert.notEqual(merged[0].attachments[1].url, message.attachments[1].url);
assert.equal(merged[0].attachments.length, 2);

const expiring = signed('messages/user-a/photo.jpg', Math.floor(now / 1000) + 60);
assert.equal(signedUrlStillUsable(expiring, now), false);
const rotated = mergeChatMessages(
  [{ ...message, attachments: [{ mediaAssetId: 'asset-1', url: expiring }] }],
  [{ ...message, attachments: [{ mediaAssetId: 'asset-1', url: second }] }],
  now,
);
assert.equal(rotated[0].attachments[0].url, second);

const sent = {
  id: 'm1',
  createdAt: '2026-08-17T12:00:00.000Z',
  sequence: 1,
  receiptStatus: 'sent',
};
const alreadyRead = { ...sent, receiptStatus: 'read' };
assert.equal(mergeChatMessages([sent], [alreadyRead])[0].receiptStatus, 'read');
assert.equal(mergeChatMessages([alreadyRead], [sent])[0].receiptStatus, 'read');
assert.equal(
  mergeChatMessages([alreadyRead], [{ ...sent, receiptStatus: 'delivered' }])[0]
    .receiptStatus,
  'read',
);

const inbox = read('src/screens/messages/MessagesInboxScreen.tsx');
const chat = read('src/screens/messages/ChatScreen.tsx');
const media = read('src/screens/messages/ConversationMediaScreen.tsx');
const auth = read('src/context/AuthContext.tsx');
const cache = read('src/lib/mediaImageCache.ts');
const upload = read('src/lib/uploadMedia.ts');
const posts = readBackend('src/modules/posts/posts.service.ts');
const messaging = readBackend('src/modules/messaging/messaging.service.ts');
const signing = readBackend('src/infrastructure/supabase/supabase.service.ts');

assert.match(inbox, /immediate: false/);
assert.match(inbox, /usePolling\(/);
assert.doesNotMatch(inbox, /useEffect\(/);
assert.match(chat, /immediate: false/);
assert.match(chat, /CHAT_POLL_MS/);
assert.match(chat, /mergeChatMessages\(previous, chronological\)/);
assert.match(chat, /refreshGenRef/);
assert.match(chat, /extraData=/);
assert.doesNotMatch(chat, /useEffect\(\s*\(\)\s*=>\s*\{\s*void refreshLatest/);
assert.doesNotMatch(media, /useEffect\(/);
assert.match(media, /useFocusEffect\(/);
assert.match(auth, /reconcileMediaCacheOwner/);
assert.match(auth, /clearMediaImageCache/);
assert.match(auth, /mediaCacheReady/);
assert.doesNotMatch(auth, /imageCacheReady \? children : null/);
assert.doesNotMatch(auth, /clearMediaImageCache\(\)\.finally/);
assert.doesNotMatch(auth, /syncMediaImageCacheOwner/);
assert.match(cache, /Image\.clearMemoryCache\(\)/);
assert.match(cache, /Image\.clearDiskCache\(\)/);
assert.match(chat, /prepareImageForUpload\(\{ \.\.\.file, purpose: 'message' \}\)/);
assert.match(read('src/context/PostsContext.tsx'), /\[isSignedIn, userId\]/);
assert.match(upload, /prepareImageForUpload/);
assert.match(upload, /application\/pdf/);
assert.match(posts, /FEED_SIGN_CONCURRENCY = 5/);
assert.match(posts, /mapPool\(tasks, FEED_SIGN_CONCURRENCY/);
assert.match(messaging, /resolveUrlForAsset\(a\.mediaAsset\)/);
assert.doesNotMatch(messaging, /getSignedUrlForAsset\(/);
assert.match(signing, /signedReadUrls\.get\(/);
assert.match(signing, /does not authorize the caller/);

console.log('performance media selftest ok');
