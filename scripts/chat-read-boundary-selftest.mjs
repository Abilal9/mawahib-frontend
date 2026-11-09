import assert from 'node:assert/strict';
import {
  applyConversationSnapshot,
  canAcknowledgeRead,
  unreadDividerMessageId,
  visibleReadBoundaryId,
} from '../src/lib/chatReadBoundary.ts';

const messages = [
  { id: 'm1', sequence: 1 },
  { id: 'm2', sequence: 2 },
  { id: 'm3', sequence: 3 },
];

assert.equal(
  visibleReadBoundaryId({
    messages,
    visibleIds: new Set(['m1', 'm2']),
    lastReadSequence: 1,
    hasOlder: false,
  }),
  'm2',
);

assert.equal(
  visibleReadBoundaryId({
    messages,
    visibleIds: new Set(['m1', 'm3']),
    lastReadSequence: 1,
    hasOlder: false,
  }),
  null,
);

assert.equal(
  visibleReadBoundaryId({
    messages,
    visibleIds: new Set(['m3']),
    lastReadSequence: null,
    hasOlder: true,
  }),
  null,
);

assert.equal(
  visibleReadBoundaryId({
    messages: [{ id: 'pending' }, ...messages],
    visibleIds: new Set(['pending', 'm1']),
    lastReadSequence: null,
    hasOlder: false,
  }),
  'm1',
);

const stale = applyConversationSnapshot(
  { id: 'c1', lastReadSequence: 10, hasUnread: false, title: 'kept' },
  { id: 'c1', lastReadSequence: 5, hasUnread: true, title: 'fresh' },
);
assert.equal(stale.lastReadSequence, 10);
assert.equal(stale.hasUnread, false);
assert.equal(stale.title, 'fresh');

const newer = applyConversationSnapshot(
  { id: 'c1', lastReadSequence: 5, hasUnread: true },
  { id: 'c1', lastReadSequence: 8, hasUnread: false },
);
assert.equal(newer.lastReadSequence, 8);
assert.equal(newer.hasUnread, false);

const thread = [
  { id: 'old', sequence: 4, kind: 'user', senderId: 'them' },
  { id: 'mid', sequence: 20, kind: 'user', senderId: 'them' },
  { id: 'new', sequence: 21, kind: 'user', senderId: 'me' },
];
assert.equal(
  unreadDividerMessageId({
    messages: thread,
    viewerId: 'me',
    lastReadSequence: 1,
    hasOlder: true,
  }),
  null,
);
assert.equal(
  unreadDividerMessageId({
    messages: thread,
    viewerId: 'me',
    lastReadSequence: 19,
    hasOlder: true,
  }),
  'mid',
);
assert.equal(
  unreadDividerMessageId({
    messages: thread,
    viewerId: 'me',
    lastReadSequence: 3,
    hasOlder: false,
  }),
  'old',
);

assert.equal(canAcknowledgeRead({ appActive: true, focused: true }), true);
assert.equal(canAcknowledgeRead({ appActive: false, focused: true }), false);
assert.equal(canAcknowledgeRead({ appActive: true, focused: false }), false);

const chat = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../src/screens/messages/ChatScreen.tsx', import.meta.url), 'utf8'),
);
assert.match(chat, /visibleReadBoundaryId/);
assert.match(chat, /applyConversationSnapshot/);
assert.match(chat, /conversationRef/);
assert.match(chat, /messagesRef/);
assert.doesNotMatch(chat, /setConversation\(\(current\)/);
assert.doesNotMatch(chat, /setMessages\(\(prev\)/);
assert.match(chat, /unreadDividerMessageId/);
assert.match(chat, /canAcknowledgeRead/);
assert.match(chat, /focused && !missing && appActive/);
assert.doesNotMatch(chat, /markRead\(conversationId\)/);

console.log('chat-read-boundary-selftest: ok');
