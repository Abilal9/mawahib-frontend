/** Mirror of PUBLIC_Q_MIN_LENGTH so Node selftests can import this module. */
const SEARCH_Q_MIN_LENGTH = 2;

function normalizeCategoryIds(
  categoryIdOrIds: string | readonly string[] | null | undefined,
): string[] | undefined {
  if (Array.isArray(categoryIdOrIds)) {
    return categoryIdOrIds.length > 0 ? [...categoryIdOrIds] : undefined;
  }
  if (typeof categoryIdOrIds === 'string' && categoryIdOrIds) {
    return [categoryIdOrIds];
  }
  return undefined;
}

export function resolveGuestExploreQuery(
  typed: string,
  categoryIdOrIds: string | readonly string[] | null | undefined,
): { blocked: boolean; q?: string; categoryIds?: string[] } {
  const trimmed = typed.trim();
  const categoryIds = normalizeCategoryIds(categoryIdOrIds);
  if (trimmed.length === 1 && !categoryIds) return { blocked: true };
  if (trimmed.length >= SEARCH_Q_MIN_LENGTH) {
    return { blocked: false, q: trimmed, categoryIds };
  }
  return { blocked: false, categoryIds };
}
