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
