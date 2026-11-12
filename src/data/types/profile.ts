/**
 * Own-profile / visitor profile domain types.
 * Catalog explore services use `Service` (CatalogService alias) in index.ts;
 * profile offerings use `ServiceOffering` (ProfileService alias).
 */

import type { LanguageLevelCode } from '../../constants/languageLevels';
import type { EmploymentType, LocationType } from '../../constants/aboutOptions';

export type ProfileTab = 'About' | 'Portfolio' | 'Services' | 'Posts';

export interface ProfileLanguage {
  id: string;
  name: string;
  /** Canonical: A1–C2 | NATIVE. Legacy free-text may still appear on read. */
  level: LanguageLevelCode | string;
  languageCode?: string;
  flag?: string;
}

export interface ProfileEducation {
  id: string;
  school: string;
  degree?: string;
  field?: string;
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
  currentlyStudying?: boolean;
  grade?: string;
  /** @deprecated Prefer grade */
  gpa?: string;
  description?: string;
  /** @deprecated Legacy display range */
  years?: string;
  logoColor?: string;
}

export interface ProfileExperience {
  id: string;
  title: string;
  company: string;
  employmentType?: EmploymentType | string;
  location?: string;
  locationType?: LocationType | string;
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
  currentlyWorking?: boolean;
  description?: string;
  /** @deprecated Prefer employmentType */
  type?: string;
  /** @deprecated Legacy display range */
  years?: string;
  logoColor?: string;
  logoInitials?: string;
}

export interface ProfileCertification {
  id: string;
  name: string;
  issuingOrganization?: string;
  /** @deprecated Prefer issuingOrganization */
  org?: string;
  issueMonth?: number;
  issueYear?: number;
  expirationMonth?: number;
  expirationYear?: number;
  doesNotExpire?: boolean;
  credentialId?: string;
  credentialUrl?: string;
  /** @deprecated Prefer issueYear */
  year?: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  images: string[];
  /** Backend media asset ids aligned with `images` order when known */
  mediaAssetIds?: string[];
  hasVideo?: boolean;
  videoIndex?: number;
}

export interface ServicePackage {
  name: 'Basic' | 'Standard' | 'Premium';
  /** Structured amount in major units (preferred for display/edit). */
  price?: number;
  currency?: string;
  /** Legacy display label; prefer `price` + `currency`. */
  priceLabel: string;
  delivery: string;
  includes: string[];
}

export interface ServiceAddon {
  id: string;
  title: string;
  /** Structured amount in major units (preferred for display/edit). */
  price?: number;
  currency?: string;
  /** Legacy display label; prefer `price` + `currency`. */
  priceLabel: string;
}

/** Profile tab service offering (packages/addons). Prefer over catalog `Service`. */
export interface ServiceOffering {
  id: string;
  title: string;
  description: string;
  rating: number;
  reviewCount: number;
  images: string[];
  /** Backend media asset ids aligned with `images` order when known */
  mediaAssetIds?: string[];
  /**
   * Snapshotted at create from the owner's country default currency.
   * Frozen for the life of the offering (edits may change amounts only).
   */
  currency?: 'SAR' | 'AED' | string | null;
  packages: ServicePackage[];
  addons?: ServiceAddon[];
  /** Legacy display string. Canonical edits use categoryId. */
  category?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  customCategory?: string | null;
  taxonomySkills?: Array<{ id: string; name: string }>;
  status?: 'draft' | 'published' | 'archived';
  staffHidden?: boolean;
  isSaved?: boolean;
}

/** @deprecated Prefer ServiceOffering — kept for existing imports */
export type ProfileService = ServiceOffering;

export interface ProfileContent {
  bio: string;
  languages: ProfileLanguage[];
  talents: string[];
  /** Canonical links for the signed-in editor. Display still uses `talents`. */
  talentSelections?: { name: string; skillId: string | null }[];
  education: ProfileEducation[];
  experience: ProfileExperience[];
  certifications: ProfileCertification[];
  portfolio: PortfolioProject[];
  services: ServiceOffering[];
  postIds: string[];
}

export const ABOUT_SECTION_KEYS = [
  'bio',
  'languages',
  'talents',
  'education',
  'experience',
  'certifications',
] as const;

export type AboutSectionKey = (typeof ABOUT_SECTION_KEYS)[number];

export const ABOUT_SECTION_LABELS: Record<AboutSectionKey, string> = {
  bio: 'Bio',
  languages: 'Languages',
  talents: 'Talents',
  education: 'Education',
  experience: 'Experience',
  certifications: 'Certifications',
};

export const ABOUT_SECTION_ADD_LABELS: Record<AboutSectionKey, string> = {
  bio: 'Add a bio',
  languages: 'Add languages',
  talents: 'Add talents',
  education: 'Add education',
  experience: 'Add experience',
  certifications: 'Add certifications',
};

export function isAboutSectionFilled(content: ProfileContent, key: AboutSectionKey) {
  if (key === 'bio') return content.bio.trim().length > 0;
  return (content[key] as unknown[]).length > 0;
}

export const TALENT_CHIP_STYLES = [
  { bg: '#FCE7F3', text: '#BE185D' },
  { bg: '#DCFCE7', text: '#15803D' },
  { bg: '#FEF3C7', text: '#A16207' },
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FCE7F3', text: '#BE185D' },
  { bg: '#DCFCE7', text: '#15803D' },
  { bg: '#FEF3C7', text: '#A16207' },
];
