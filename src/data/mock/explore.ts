import type { MessageKey } from '../../i18n/messages';

export const exploreTabs = [
  { id: 'talents', labelKey: 'discover.talents' },
  { id: 'services', labelKey: 'discover.services' },
  { id: 'jobs', labelKey: 'discover.jobs' },
] as const satisfies ReadonlyArray<{ id: string; labelKey: MessageKey }>;

export type ExploreTab = (typeof exploreTabs)[number]['id'];

/** @deprecated use ExploreTab — kept for older navigations */
export type ExploreContentType = ExploreTab | 'all' | 'posts';
