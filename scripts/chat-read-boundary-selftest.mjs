import assert from 'node:assert/strict';
import {
  canAcknowledgeRead,
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

assert.equal(canAcknowledgeRead({ appActive: true, focused: true }), true);
assert.equal(canAcknowledgeRead({ appActive: false, focused: true }), false);
assert.equal(canAcknowledgeRead({ appActive: true, focused: false }), false);

const chat = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../src/screens/messages/ChatScreen.tsx', import.meta.url), 'utf8'),
);
assert.match(chat, /visibleReadBoundaryId/);
assert.match(chat, /canAcknowledgeRead/);
assert.match(chat, /focused && !missing && appActive/);
assert.doesNotMatch(chat, /markRead\(conversationId\)/);

console.log('chat-read-boundary-selftest: ok');
