import type { AboutSectionKey } from '../data/types/profile';
import type { MessageKey } from './messages';
import { t } from './runtime';

const SECTION_LABEL: Record<AboutSectionKey, MessageKey> = {
  bio: 'profile.bio',
  languages: 'profile.languages',
  talents: 'profile.talents',
  education: 'profile.education',
  experience: 'profile.experience',
  certifications: 'profile.certifications',
};

const SECTION_ADD_LABEL: Record<AboutSectionKey, MessageKey> = {
  bio: 'profile.addBio',
  languages: 'profile.addLanguages',
  talents: 'profile.addTalents',
  education: 'profile.addEducation',
  experience: 'profile.addExperience',
  certifications: 'profile.addCertifications',
};

export function aboutSectionLabel(key: AboutSectionKey): string {
  return t(SECTION_LABEL[key]);
}

export function aboutSectionAddLabel(key: AboutSectionKey): string {
  return t(SECTION_ADD_LABEL[key]);
}

const EMPLOYMENT_KEYS: Record<string, MessageKey> = {
  'Full-time': 'discover.fullTime',
  'Part-time': 'discover.partTime',
  Freelance: 'discover.freelance',
  Contract: 'discover.contract',
  Internship: 'editor.internship',
  'Self-employed': 'editor.selfEmployed',
  Temporary: 'editor.temporary',
  Other: 'editor.other',
};

const LOCATION_TYPE_KEYS: Record<string, MessageKey> = {
  'On-site': 'editor.onSite',
  Hybrid: 'editor.hybrid',
  Remote: 'editor.remote',
};

function knownChoice(value: string | null | undefined, table: Record<string, MessageKey>): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  const key = table[trimmed];
  return key ? t(key) : trimmed;
}

/** Built-in employment labels. Stored and unknown values stay unchanged. */
export function employmentChoiceLabel(value: string | null | undefined): string {
  return knownChoice(value, EMPLOYMENT_KEYS);
}

/** Built-in location-type labels. Stored and unknown values stay unchanged. */
export function locationTypeChoiceLabel(value: string | null | undefined): string {
  return knownChoice(value, LOCATION_TYPE_KEYS);
}
