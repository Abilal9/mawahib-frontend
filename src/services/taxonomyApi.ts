import { apiRequest } from '../lib/apiClient';
import {
  uniqueSkillSuggestions,
  type CanonicalSkillSuggestion,
} from '../domain/profileSkills';

export interface TaxonomySkill {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
}

export interface TaxonomyCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  allowsCustomCategory?: boolean;
  skills: TaxonomySkill[];
}

export interface TaxonomyResponse {
  categories: TaxonomyCategory[];
}

interface SuggestionResponse extends CanonicalSkillSuggestion {
  slug: string;
  nameAr: string | null;
  categoryId: string;
}

let catalogPromise: Promise<TaxonomyResponse> | null = null;
const suggestionCache = new Map<string, Promise<CanonicalSkillSuggestion[]>>();

export function resetTaxonomyCache(): void {
  catalogPromise = null;
  suggestionCache.clear();
}

export function loadTaxonomy(): Promise<TaxonomyResponse> {
  if (!catalogPromise) {
    catalogPromise = apiRequest<TaxonomyResponse>('/taxonomy').catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

export function suggestSkills(query: string): Promise<CanonicalSkillSuggestion[]> {
  const key = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return Promise.resolve([]);
  const cached = suggestionCache.get(key);
  if (cached) return cached;
  const pending = apiRequest<SuggestionResponse[]>(
    `/taxonomy/skills?q=${encodeURIComponent(key)}&limit=10`,
  )
    .then((rows) =>
      uniqueSkillSuggestions(
        rows.map((row) => ({
          id: row.id,
          nameEn: row.nameEn,
          nameAr: row.nameAr,
          matchedTerm: row.matchedTerm,
          categoryId: row.categoryId,
        })),
      ),
    )
    .catch((error) => {
      suggestionCache.delete(key);
      throw error;
    });
  suggestionCache.set(key, pending);
  return pending;
}
