import type { MessageKey } from '../i18n/messages';

/**
 * Welcome flow copy — aligned with Figma Welcome Screen 4/5/6 (8368:11342–11378).
 */
export const WELCOME_STEPS: Record<
  1 | 2 | 3,
  { title: MessageKey; subtitle: MessageKey; image: string }
> = {
  1: {
    title: 'welcome.discover',
    subtitle: 'welcome.discoverBody',
    image:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=690&h=474&fit=crop',
  },
  2: {
    title: 'welcome.showcase',
    subtitle: 'welcome.showcaseBody',
    image:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=690&h=474&fit=crop',
  },
  3: {
    title: 'welcome.find',
    subtitle: 'welcome.findBody',
    image:
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=690&h=474&fit=crop',
  },
};
