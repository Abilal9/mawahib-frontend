import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  customCategoryError,
  displayCustomCategory,
  offeringTaxonomyPayload,
  rankSkillSuggestions,
  uniqueOfferingSkills,
  visibleJobSkillLabels,
} from '../src/domain/offeringTaxonomy.ts';

const unique = uniqueOfferingSkills([
  { id: 'a', name: 'Branding' },
  { id: 'a', name: 'Branding again' },
  { id: 'b', name: 'UI Design' },
]);
assert.deepEqual(unique.map((item) => item.id), ['a', 'b']);

const ranked = rankSkillSuggestions(
  [
    { id: 'photo', nameEn: 'Photography', matchedTerm: 'Photography', categoryId: 'photography' },
    { id: 'brand', nameEn: 'Branding', matchedTerm: 'Branding', categoryId: 'design' },
  ],
  'design',
);
assert.equal(ranked[0].id, 'brand');

const created = offeringTaxonomyPayload({
  creating: true,
  categoryId: 'design',
  initialCategoryId: null,
  skillIds: ['brand'],
  initialSkillIds: [],
});
assert.deepEqual(created, { categoryId: 'design', skillIds: ['brand'] });

const legacyEdit = offeringTaxonomyPayload({
  creating: false,
  categoryId: null,
  initialCategoryId: null,
  skillIds: [],
  initialSkillIds: [],
});
assert.deepEqual(legacyEdit, {});

assert.equal(displayCustomCategory('   Live    Illustration  '), 'Live Illustration');
assert.equal(
  customCategoryError({ allowsCustomCategory: true, customCategory: '   ' }),
  'Describe this category',
);
assert.equal(
  customCategoryError({
    allowsCustomCategory: true,
    customCategory: 'ق'.repeat(61),
  }),
  'Use 60 characters or fewer',
);
assert.equal(
  customCategoryError({ allowsCustomCategory: false, customCategory: '' }),
  null,
);
assert.equal(
  customCategoryError({
    allowsCustomCategory: true,
    customCategory: 'Live\nIllustration',
  }),
  'Invalid category description',
);
assert.equal(displayCustomCategory('Live\nIllustration'), 'Live\nIllustration');

const otherCreated = offeringTaxonomyPayload({
  creating: true,
  categoryId: 'other',
  initialCategoryId: null,
  skillIds: ['illustration', 'brand'],
  initialSkillIds: [],
  allowsCustomCategory: true,
  customCategory: '  Calligraphy ',
});
assert.deepEqual(otherCreated, {
  categoryId: 'other',
  skillIds: ['illustration', 'brand'],
  customCategory: 'Calligraphy',
});

const switchedAway = offeringTaxonomyPayload({
  creating: true,
  categoryId: 'design',
  initialCategoryId: null,
  skillIds: ['brand'],
  initialSkillIds: [],
  allowsCustomCategory: false,
  customCategory: 'Calligraphy',
});
assert.deepEqual(switchedAway, { categoryId: 'design', skillIds: ['brand'] });
assert.equal('customCategory' in switchedAway, false);

const otherTextUpdate = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'other',
  initialCategoryId: 'other',
  skillIds: ['illustration'],
  initialSkillIds: ['illustration'],
  allowsCustomCategory: true,
  customCategory: 'Hand Lettering',
  initialCustomCategory: 'Calligraphy',
});
assert.deepEqual(otherTextUpdate, { customCategory: 'Hand Lettering' });

const otherUnchanged = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'other',
  initialCategoryId: 'other',
  skillIds: ['illustration'],
  initialSkillIds: ['illustration'],
  allowsCustomCategory: true,
  customCategory: 'Calligraphy',
  initialCustomCategory: 'Calligraphy',
});
assert.deepEqual(otherUnchanged, {});

const leaveOther = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'design',
  initialCategoryId: 'other',
  skillIds: ['illustration'],
  initialSkillIds: ['illustration'],
  allowsCustomCategory: false,
  customCategory: '',
  initialCustomCategory: 'Calligraphy',
});
assert.deepEqual(leaveOther, { categoryId: 'design' });
assert.equal('customCategory' in leaveOther, false);

const designWithoutSkills = offeringTaxonomyPayload({
  creating: true,
  categoryId: 'design',
  initialCategoryId: null,
  skillIds: [],
  initialSkillIds: [],
});
assert.deepEqual(designWithoutSkills, { categoryId: 'design', skillIds: [] });

const otherWithoutSkills = offeringTaxonomyPayload({
  creating: true,
  categoryId: 'other',
  initialCategoryId: null,
  skillIds: [],
  initialSkillIds: [],
  allowsCustomCategory: true,
  customCategory: 'Calligraphy',
});
assert.deepEqual(otherWithoutSkills, {
  categoryId: 'other',
  skillIds: [],
  customCategory: 'Calligraphy',
});

const clearSkills = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'design',
  initialCategoryId: 'design',
  skillIds: [],
  initialSkillIds: ['branding', 'ui'],
});
assert.deepEqual(clearSkills, { skillIds: [] });

const alreadyEmpty = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'design',
  initialCategoryId: 'design',
  skillIds: [],
  initialSkillIds: [],
});
assert.deepEqual(alreadyEmpty, {});
assert.equal('skillIds' in alreadyEmpty, false);

const titleOnlySkills = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'design',
  initialCategoryId: 'design',
  skillIds: ['branding', 'ui'],
  initialSkillIds: ['branding', 'ui'],
});
assert.deepEqual(titleOnlySkills, {});

const changeCategoryKeepSkills = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'technology',
  initialCategoryId: 'design',
  skillIds: ['branding', 'ui'],
  initialSkillIds: ['branding', 'ui'],
});
assert.deepEqual(changeCategoryKeepSkills, { categoryId: 'technology' });
assert.equal('skillIds' in changeCategoryKeepSkills, false);

const changeCategoryClearSkills = offeringTaxonomyPayload({
  creating: false,
  categoryId: 'technology',
  initialCategoryId: 'design',
  skillIds: [],
  initialSkillIds: ['branding', 'ui'],
});
assert.deepEqual(changeCategoryClearSkills, {
  categoryId: 'technology',
  skillIds: [],
});

const picker = readFileSync(
  new URL('../src/components/taxonomy/TaxonomyFields.tsx', import.meta.url),
  'utf8',
);
assert.equal(picker.includes('loadTaxonomy'), true);
assert.equal(picker.includes('suggestSkills'), true);
assert.equal(picker.includes('allowsCustomCategory'), true);
assert.equal(picker.includes('Boolean(categoryId && customCategory)'), false);
assert.equal(picker.includes('What type of service is this?'), false);
assert.equal(picker.includes('Add "'), false);
assert.equal(picker.includes("from '../../data/mock"), false);
assert.equal(picker.includes('Photography'), false);
assert.equal(picker.includes("category || 'Other'"), false);
assert.equal(picker.includes('categoryName ?? "Other"'), false);

const serviceScreen = readFileSync(
  new URL('../src/screens/profile/AddProfileServiceScreen.tsx', import.meta.url),
  'utf8',
);
const jobScreen = readFileSync(
  new URL('../src/screens/jobs/PostJobScreen.tsx', import.meta.url),
  'utf8',
);
assert.equal(serviceScreen.includes('TaxonomyFields'), true);
assert.equal(serviceScreen.includes('Boolean(existing?.customCategory)'), false);
assert.equal(serviceScreen.includes('Boolean(existing.customCategory)'), false);
assert.equal(jobScreen.includes('TaxonomyFields'), true);
const workCatalog = readFileSync(
  new URL('../src/i18n/catalogs/work.ts', import.meta.url),
  'utf8',
);
assert.equal(serviceScreen.includes("t('work.serviceKind')"), true);
assert.equal(workCatalog.includes("'work.serviceKind': 'What type of service is this?'"), true);
assert.equal(jobScreen.includes("t('work.jobKind')"), true);
assert.equal(workCatalog.includes("'work.jobKind': 'What type of job is this?'"), true);
assert.equal(serviceScreen.includes("category: 'Design'"), false);
assert.equal(jobScreen.includes('exploreTag:'), false);
assert.equal(serviceScreen.includes("category || 'Other'"), false);
assert.equal(jobScreen.includes("categoryName ?? 'Other'"), false);
assert.equal(serviceScreen.includes('setSelectedSkills([])'), false);
assert.equal(/at least one skill/i.test(serviceScreen), false);
assert.equal(/skill required/i.test(serviceScreen), false);
assert.equal(/at least one skill/i.test(jobScreen), false);
assert.equal(/skill required/i.test(jobScreen), false);
assert.equal(serviceScreen.includes('skillIds: selectedSkills.map'), true);
assert.equal(jobScreen.includes('skillIds: selectedSkills.map'), true);

const servicesApi = readFileSync(
  new URL('../src/services/servicesApi.ts', import.meta.url),
  'utf8',
);
const jobsApi = readFileSync(
  new URL('../src/services/marketplaceApi.ts', import.meta.url),
  'utf8',
);
assert.equal(servicesApi.includes('customCategory'), true);
assert.equal(jobsApi.includes('customCategory'), true);
assert.equal(servicesApi.includes('supabase.from'), false);
assert.equal(jobsApi.includes('supabase.from'), false);
assert.equal(servicesApi.includes('input.skillIds !== undefined'), true);
assert.equal(servicesApi.includes('skillIds?.length'), false);
assert.equal(jobsApi.includes('skillIds?.length'), false);
assert.equal(jobsApi.includes('input.skillIds ?? []'), true);

assert.deepEqual(visibleJobSkillLabels(['React Native', 'UI Design']), [
  'React Native',
  'UI Design',
]);
assert.deepEqual(visibleJobSkillLabels(['  Packaging ', 'Motion']), [
  'Packaging',
  'Motion',
]);
assert.deepEqual(visibleJobSkillLabels([]), []);
assert.deepEqual(visibleJobSkillLabels(undefined), []);
assert.deepEqual(visibleJobSkillLabels(['', '   ']), []);
assert.deepEqual(visibleJobSkillLabels(['General']), ['General']);

const jobDetail = readFileSync(
  new URL('../src/screens/jobs/JobListingDetailScreen.tsx', import.meta.url),
  'utf8',
);
assert.equal(/required skills/i.test(jobDetail), false);
assert.equal(jobDetail.includes('visibleJobSkillLabels(job.skills)'), true);
assert.equal(jobDetail.includes("t('work.skills')"), true);
assert.equal(workCatalog.includes("'work.skills': 'Skills'"), true);
assert.equal(jobDetail.includes('taxonomySkills'), false);
assert.equal(jobDetail.includes("|| 'None'"), false);
assert.equal(jobDetail.includes("|| 'N/A'"), false);
assert.equal(jobDetail.includes('Not specified'), false);

console.log('offering-taxonomy-selftest: ok');
