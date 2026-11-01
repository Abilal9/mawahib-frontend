/**
 * Home loading presentation. No React, fetching, or auth imports so Node
 * selftests can execute the coordination table.
 */

export type HomeSectionAppearance =
  | 'omit'
  | 'placeholder'
  | 'content'
  | 'error'
  | 'empty';

export type HomePageEmptyKind = 'none' | 'empty' | 'error';

/**
 * One Splash 2 loader only while Home has no useful content, a request
 * is still pending, pull-to-refresh is not already showing a spinner, and no
 * section error is already on screen (retry must not replace the page).
 */
export function resolveHomeInitialLoader(input: {
  hasContent: boolean;
  anyPending: boolean;
  refreshing: boolean;
  hasVisibleError: boolean;
}): boolean {
  return (
    !input.hasContent &&
    input.anyPending &&
    !input.refreshing &&
    !input.hasVisibleError
  );
}

export function resolveHomeSectionAppearance(input: {
  itemCount: number;
  loading: boolean;
  error: string | null;
  showInitialLoader: boolean;
  showSettledEmpty?: boolean;
}): HomeSectionAppearance {
  if (input.itemCount > 0) return 'content';
  if (input.showInitialLoader) return 'omit';
  if (input.loading) return 'placeholder';
  if (input.error) return 'error';
  if (input.showSettledEmpty) return 'empty';
  return 'omit';
}

export function resolveHomePageEmpty(input: {
  hasContent: boolean;
  anyPending: boolean;
  allFailed: boolean;
}): HomePageEmptyKind {
  if (input.hasContent || input.anyPending) return 'none';
  if (input.allFailed) return 'error';
  return 'empty';
}

export function resolveHomePaginationIndicator(input: {
  showInitialLoader: boolean;
  loadingMore: boolean;
}): boolean {
  return !input.showInitialLoader && input.loadingMore;
}

export function sectionHasVisibleError(input: {
  error: string | null;
  itemCount: number;
}): boolean {
  return Boolean(input.error) && input.itemCount === 0;
}
