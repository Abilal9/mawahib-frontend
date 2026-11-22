import assert from 'node:assert/strict';
import {
  canRegisterChatPush,
  chatPushRoute,
  chatPushTarget,
  claimChatPushResponse,
  shouldRenewChatPushViewing,
} from '../src/lib/chatPush.ts';

const target = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
};

assert.equal(chatPushTarget({ type: 'chat_message', ...target })?.conversationId, target.conversationId);
assert.equal(chatPushTarget({ type: 'chat_message', conversationId: target.conversationId, body: 'secret' }), null);
assert.equal(chatPushTarget({ type: 'other', ...target }), null);

assert.equal(chatPushRoute({ sessionReady: false, signedInUserId: null, target }), 'wait');
assert.equal(chatPushRoute({ sessionReady: true, signedInUserId: null, target }), 'sign-in');
assert.equal(
  chatPushRoute({ sessionReady: true, signedInUserId: '33333333-3333-4333-8333-333333333333', target }),
  'unavailable',
);
assert.equal(chatPushRoute({ sessionReady: true, signedInUserId: target.recipientUserId, target }), 'open');

assert.equal(shouldRenewChatPushViewing({ appActive: true, focused: true }), true);
assert.equal(shouldRenewChatPushViewing({ appActive: false, focused: true }), false);
assert.equal(shouldRenewChatPushViewing({ appActive: true, focused: false }), false);

assert.equal(canRegisterChatPush({ expoGo: true, projectId: 'p', permission: 'granted' }), false);
assert.equal(canRegisterChatPush({ expoGo: false, projectId: null, permission: 'granted' }), false);
assert.equal(canRegisterChatPush({ expoGo: false, projectId: 'p', permission: 'denied' }), false);
assert.equal(canRegisterChatPush({ expoGo: false, projectId: 'p', permission: 'granted' }), true);

assert.equal(claimChatPushResponse('response-1'), true);
assert.equal(claimChatPushResponse('response-1'), false);

console.log('chat-push-selftest: ok');
