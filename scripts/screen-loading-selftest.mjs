/**
 * Profile and conversation loading surfaces.
 * A matching record stays visible. A switch, denial, or missing target does not.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  conversationSurface,
  profileSurface,
  protectedRecordDenied,
  sameShownRecord,
} from '../src/lib/screenLoadingPresentation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

assert.equal(sameShownRecord('a', 'a'), true);
assert.equal(sameShownRecord('a', 'b'), false);
assert.equal(sameShownRecord(null, 'a'), false);
assert.equal(protectedRecordDenied(401), true);
assert.equal(protectedRecordDenied(403), true);
assert.equal(protectedRecordDenied(404), true);
assert.equal(protectedRecordDenied(500), false);

assert.equal(
  profileSurface({
    requestedId: 'a',
    shownId: null,
    pending: true,
    denied: false,
  }),
  'skeleton',
);
assert.equal(
  profileSurface({
    requestedId: 'a',
    shownId: 'a',
    pending: true,
    denied: false,
  }),
  'content',
);
assert.equal(
  profileSurface({
    requestedId: 'b',
    shownId: 'a',
    pending: true,
    denied: false,
  }),
  'skeleton',
);
assert.equal(
  profileSurface({
    requestedId: 'a',
    shownId: 'a',
    pending: false,
    denied: true,
  }),
  'unavailable',
);
assert.equal(
  profileSurface({
    requestedId: 'a',
    shownId: null,
    pending: false,
    denied: false,
  }),
  'unavailable',
);

assert.equal(
  conversationSurface({ missing: false, hasMessages: false, pending: true }),
  'skeleton',
);
assert.equal(
  conversationSurface({ missing: false, hasMessages: true, pending: true }),
  'messages',
);
assert.equal(
  conversationSurface({ missing: true, hasMessages: true, pending: false }),
  'missing',
);

const profile = read('src/screens/profile/UserProfileScreen.tsx');
const chat = read('src/screens/messages/ChatScreen.tsx');
const hook = read('src/hooks/useVisitorUser.ts');
assert.match(profile, /LoadingSkeleton/);
assert.match(profile, /navigation\.goBack/);
assert.match(chat, /LoadingSkeleton/);
assert.match(hook, /protectedRecordDenied/);
assert.doesNotMatch(profile, /Loading profile…/);
