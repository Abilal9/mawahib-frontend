import React, { useEffect, useState } from 'react';
import type { ExploreTab } from '../../data/mock/explore';
import {
  categoriesForExploreTab,
  emptyExploreTaxonomy,
  toggleExploreCategory,
  type ExploreTaxonomySelection,
} from '../../domain/exploreTaxonomy';
import { loadTaxonomy, type TaxonomyCategory } from '../../services/taxonomyApi';
import ExploreTaxonomyChipRow from './ExploreTaxonomyChipRow';

export type ExploreSelectionUpdate =
  | ExploreTaxonomySelection
  | ((current: ExploreTaxonomySelection) => ExploreTaxonomySelection);

export default function ExploreTaxonomyFilters({
  tab,
  value,
  catalogAttempt = 0,
  onChange,
}: {
  tab: ExploreTab;
  value: ExploreTaxonomySelection;
  catalogAttempt?: number;
  onChange: (update: ExploreSelectionUpdate) => void;
}) {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadTaxonomy()
      .then((catalog) => {
        if (!active) return;
        setCategories(catalog.categories);
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, catalogAttempt]);

  const visible = categoriesForExploreTab(categories, tab);

  return (
    <ExploreTaxonomyChipRow
      categories={visible}
      selectedIds={value.categoryIds}
      onToggle={(id) =>
        onChange((current) => ({
          categoryIds: toggleExploreCategory(current.categoryIds, id),
        }))
      }
      loading={loading}
      failed={failed}
      onRetry={() => setAttempt((current) => current + 1)}
      filterCount={value.categoryIds.length}
      onClear={() => onChange(emptyExploreTaxonomy())}
    />
  );
}
