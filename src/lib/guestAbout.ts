/**
 * Map public About JSON onto the signed-in ProfileContent presentation model.
 * No RN imports. Does not invent missing entries or restore stripped credentials.
 */

import type {
  ProfileCertification,
  ProfileContent,
  ProfileEducation,
  ProfileExperience,
  ProfileLanguage,
} from '../data/types/profile';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function mapLanguages(raw: unknown[]): ProfileLanguage[] {
  const items: ProfileLanguage[] = [];
  for (const entry of raw) {
    const value = asRecord(entry);
    const name = asString(value?.name)?.trim();
    if (!value || !name) continue;
    items.push({
      id: asString(value.id) || `lang-${items.length}`,
      name,
      level: asString(value.level) || '',
      languageCode: asString(value.languageCode),
      flag: asString(value.flag) ?? '',
    });
  }
  return items;
}

function mapEducation(raw: unknown[]): ProfileEducation[] {
  const items: ProfileEducation[] = [];
  for (const entry of raw) {
    const value = asRecord(entry);
    const school = asString(value?.school)?.trim();
    if (!value || !school) continue;
    items.push({
      id: asString(value.id) || `edu-${items.length}`,
      school,
      degree: asString(value.degree),
      field: asString(value.field),
      startMonth: asNumber(value.startMonth),
      startYear: asNumber(value.startYear),
      endMonth: asNumber(value.endMonth),
      endYear: asNumber(value.endYear),
      currentlyStudying: asBoolean(value.currentlyStudying),
      grade: asString(value.grade),
      gpa: asString(value.gpa),
      description: asString(value.description),
      years: asString(value.years),
      logoColor: asString(value.logoColor),
    });
  }
  return items;
}

function mapExperience(raw: unknown[]): ProfileExperience[] {
  const items: ProfileExperience[] = [];
  for (const entry of raw) {
    const value = asRecord(entry);
    const title = asString(value?.title)?.trim();
    const company = asString(value?.company)?.trim();
    if (!value || !title || !company) continue;
    items.push({
      id: asString(value.id) || `exp-${items.length}`,
      title,
      company,
      employmentType: asString(value.employmentType),
      location: asString(value.location),
      locationType: asString(value.locationType),
      startMonth: asNumber(value.startMonth),
      startYear: asNumber(value.startYear),
      endMonth: asNumber(value.endMonth),
      endYear: asNumber(value.endYear),
      currentlyWorking: asBoolean(value.currentlyWorking),
      description: asString(value.description),
      type: asString(value.type),
      years: asString(value.years),
      logoColor: asString(value.logoColor),
      logoInitials: asString(value.logoInitials),
    });
  }
  return items;
}

function mapCertifications(raw: unknown[]): ProfileCertification[] {
  const items: ProfileCertification[] = [];
  for (const entry of raw) {
    const value = asRecord(entry);
    const name = asString(value?.name)?.trim();
    if (!value || !name) continue;
    const next: ProfileCertification = {
      id: asString(value.id) || `cert-${items.length}`,
      name,
      issuingOrganization: asString(value.issuingOrganization),
      org: asString(value.org),
      issueMonth: asNumber(value.issueMonth),
      issueYear: asNumber(value.issueYear),
      expirationMonth: asNumber(value.expirationMonth),
      expirationYear: asNumber(value.expirationYear),
      doesNotExpire: asBoolean(value.doesNotExpire),
      year: asString(value.year),
    };
    items.push(next);
  }
  return items;
}

export function guestAboutToProfileContent(profile: {
  bio: string;
  skills: string[];
  about: {
    languages: unknown[];
    education: unknown[];
    experience: unknown[];
    certifications: unknown[];
  } | null;
}): ProfileContent {
  const about = profile.about;
  return {
    bio: profile.bio ?? '',
    languages: about ? mapLanguages(about.languages) : [],
    talents: profile.skills ?? [],
    talentSelections: [],
    education: about ? mapEducation(about.education) : [],
    experience: about ? mapExperience(about.experience) : [],
    certifications: about ? mapCertifications(about.certifications) : [],
    portfolio: [],
    services: [],
    postIds: [],
  };
}
