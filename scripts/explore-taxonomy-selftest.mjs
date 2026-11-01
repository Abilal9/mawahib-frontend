import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPLORE_MAX_CATEGORY_FILTERS,
  acceptExploreResponse,
  isInactiveTaxonomyFilterError,
  pruneExploreSelection,
  categoriesForExploreTab,
  clearExploreTab,
  emptyExploreTaxonomy,
  exploreFilterParams,
  exploreTaxonomyKey,
  toggleExploreCategory,
} from '../src/domain/exploreTaxonomy.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const design = {
  id: 'design',
  sortOrder: 30,
  skills: [
    { id: 'branding' },
    { id: 'figma' },
  ],
};
const photo = {
  id: 'photography',
  sortOrder: 10,
  skills: [{ id: 'photography-skill' }],
};
const technology = {
  id: 'technology',
  sortOrder: 90,
  skills: [{ id: 'react-native' }],
};
const other = {
  id: 'other',
  sortOrder: 110,
  allowsCustomCategory: true,
  skills: [],
};
const catalog = [other, technology, design, photo];

const talentCategories = categoriesForExploreTab(catalog, 'talents');
assert.equal(talentCategories.length, 3);
assert.deepEqual(
  talentCategories.map((category) => category.id),
  ['photography', 'design', 'technology'],
);
assert.equal(
  talentCategories.some((category) => category.allowsCustomCategory),
  false,
);

const serviceCategories = categoriesForExploreTab(catalog, 'services');
const jobCategories = categoriesForExploreTab(catalog, 'jobs');
assert.equal(serviceCategories.length, 4);
assert.equal(jobCategories.length, 4);
assert.deepEqual(
  serviceCategories.map((category) => category.id),
  ['photography', 'design', 'technology', 'other'],
);
assert.deepEqual(
  jobCategories.map((category) => category.id),
  ['photography', 'design', 'technology', 'other'],
);

let categories = toggleExploreCategory([], 'design');
categories = toggleExploreCategory(categories, 'technology');
assert.deepEqual(categories, ['design', 'technology']);
categories = toggleExploreCategory(categories, 'design');
assert.deepEqual(categories, ['technology']);
const filled = Array.from({ length: EXPLORE_MAX_CATEGORY_FILTERS }, (_, index) => `c${index}`);
assert.equal(toggleExploreCategory(filled, 'extra').length, EXPLORE_MAX_CATEGORY_FILTERS);

const selection = { categoryIds: ['design', 'photography'] };
const params = exploreFilterParams(selection);
assert.equal(params.categoryIds, 'design,photography');
assert.equal('skillIds' in params, false);
assert.deepEqual(exploreFilterParams(emptyExploreTaxonomy()), {});
assert.equal(
  exploreTaxonomyKey({ categoryIds: ['photography', 'design'] }),
  exploreTaxonomyKey({ categoryIds: ['design', 'photography'] }),
);
assert.equal(exploreTaxonomyKey(emptyExploreTaxonomy()), '');

let state = {
  talents: { categoryIds: ['photography', 'design'] },
  services: { categoryIds: ['technology'] },
  jobs: { categoryIds: ['other', 'design'] },
};
state = clearExploreTab(state, 'talents');
assert.deepEqual(state.talents, emptyExploreTaxonomy());
assert.deepEqual(state.services.categoryIds, ['technology']);
assert.deepEqual(state.jobs.categoryIds, ['other', 'design']);

let generation = 0;
const first = ++generation;
const second = ++generation;
generation += 1;
assert.equal(acceptExploreResponse(generation, first), false);
assert.equal(acceptExploreResponse(generation, second), false);
assert.equal(acceptExploreResponse(generation, generation), true);

const rapidKeys = [];
let rapid = emptyExploreTaxonomy();
const queries = ['fi', 'fig', 'figma'];
for (const query of queries) {
  rapid = {
    categoryIds: toggleExploreCategory(rapid.categoryIds, 'design'),
  };
  rapidKeys.push(`${query}|${exploreTaxonomyKey(rapid)}`);
}
rapid = {
  categoryIds: toggleExploreCategory(rapid.categoryIds, 'technology'),
};
rapid = {
  categoryIds: toggleExploreCategory(rapid.categoryIds, 'design'),
};
const finalKey = `figma|${exploreTaxonomyKey(rapid)}`;
assert.equal(finalKey, 'figma|technology');
assert.equal(rapidKeys.at(-1) === finalKey, false);
assert.equal(acceptExploreResponse(4, 4), true);
assert.equal(acceptExploreResponse(4, 3), false);

const pruned = pruneExploreSelection(
  { categoryIds: ['design', 'gone'] },
  [{ id: 'design', skills: [{ id: 'branding' }] }],
);
assert.deepEqual(pruned, { categoryIds: ['design'] });
assert.equal(isInactiveTaxonomyFilterError('Unknown or inactive category filter.'), true);
assert.equal(isInactiveTaxonomyFilterError('Unknown or inactive skill filter.'), false);
assert.equal(isInactiveTaxonomyFilterError('property skillIds should not exist'), false);
assert.equal(isInactiveTaxonomyFilterError('Could not load talents'), false);

const screen = read('src/screens/search/SearchScreen.tsx');
const filters = read('src/components/explore/ExploreTaxonomyFilters.tsx');
const chips = read('src/components/explore/ExploreTaxonomyChipRow.tsx');
const api = read('src/services/exploreApi.ts');
const jobs = read('src/services/marketplaceApi.ts');
const domain = read('src/domain/exploreTaxonomy.ts');
const listOpen = jobs.slice(jobs.indexOf('listOpenListings'), jobs.indexOf('listOpenListings') + 700);

assert.equal(
  existsSync(join(root, 'src/components/explore/ExploreSkillFilterSheet.tsx')),
  false,
);
assert.equal(screen.includes('ExploreTaxonomyFilters'), true);
assert.equal(screen.includes('ExploreSkillFilterSheet'), false);
assert.equal(screen.includes('exploreFilterParams'), true);
assert.equal(screen.includes('exploreTaxonomyKey'), true);
assert.equal(screen.includes('taxonomyByTab'), true);
assert.equal(screen.includes('requestGen.current[target] !== gen'), true);
assert.equal(screen.includes('No matches for these filters.'), true);
assert.equal(screen.includes('Try another search or city.'), true);
assert.equal(screen.includes('Search skills'), false);
assert.equal(screen.includes('supabase.from'), false);
assert.equal(screen.includes('skillIds'), false);
assert.equal(filters.includes('supabase.from'), false);
assert.equal(filters.includes('loadTaxonomy'), true);
assert.equal(filters.includes('categoriesForExploreTab'), true);
assert.equal(chips.includes('Clear filters'), true);
assert.equal(filters.includes('ExploreTaxonomyChipRow'), true);
assert.equal(filters.includes('Skill filters'), false);
assert.equal(filters.includes('ExploreSkillFilterSheet'), false);
assert.equal(domain.includes('skillIds'), false);
assert.equal(domain.includes("'Photography'"), false);
assert.equal(filters.includes('Photography'), false);
assert.equal(screen.includes("categoryIds: facets.categoryIds"), true);
assert.equal(screen.includes('resetTaxonomyCache'), true);
assert.equal(screen.includes('pruneExploreSelection'), true);
assert.equal(screen.includes('isInactiveTaxonomyFilterError'), true);
assert.equal(filters.includes('toggleExploreCategory(current.categoryIds'), true);
assert.equal(api.includes("qs.set('categoryIds', params.categoryIds)"), true);
assert.equal(api.includes('skillIds'), false);
assert.equal(listOpen.includes("qs.set('categoryIds', params.categoryIds)"), true);
assert.equal(listOpen.includes('skillIds'), false);
assert.equal(listOpen.includes("qs.set('status', 'open')"), true);

const filterStart = screen.indexOf('<ExploreTaxonomyFilters');
const errorStart = screen.indexOf('Could not load');
assert.equal(filterStart > 0 && filterStart < errorStart, true);

console.log('explore taxonomy selftest passed');
