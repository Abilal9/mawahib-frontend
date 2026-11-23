export const MAX_PROFILE_SKILLS = 40;
export const MAX_PROFILE_SKILL_LENGTH = 60;

export interface ProfileSkillSelection {
  name: string;
  skillId: string | null;
}

export interface CanonicalSkillSuggestion {
  id: string;
  nameEn: string;
  nameAr?: string | null;
  matchedTerm: string;
  categoryId?: string;
}

export function selectionsFromProfile(input: {
  skills?: string[];
  skillSelections?: { name: string; skillId: string | null }[] | null;
}): ProfileSkillSelection[] {
  if (input.skillSelections) {
    return input.skillSelections.map((item) => ({
      name: item.name,
      skillId: item.skillId,
    }));
  }
  return (input.skills ?? []).map((name) => ({ name, skillId: null }));
}

export function skillSelectionPayload(items: readonly ProfileSkillSelection[]): {
  skillSelections: ({ skillId: string } | { text: string })[];
} {
  return {
    skillSelections: items.map((item) =>
      item.skillId ? { skillId: item.skillId } : { text: item.name },
    ),
  };
}

function skillKey(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function addCanonicalSkill(
  items: readonly ProfileSkillSelection[],
  suggestion: CanonicalSkillSuggestion,
): ProfileSkillSelection[] {
  if (items.some((item) => item.skillId === suggestion.id)) return [...items];
  const nameKey = skillKey(suggestion.nameEn);
  const withoutSameName = items.filter(
    (item) => item.skillId != null || skillKey(item.name) !== nameKey,
  );
  return [
    ...withoutSameName,
    { name: suggestion.nameEn, skillId: suggestion.id },
  ].slice(0, MAX_PROFILE_SKILLS);
}

export function addCustomSkill(
  items: readonly ProfileSkillSelection[],
  raw: string,
): ProfileSkillSelection[] {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_PROFILE_SKILL_LENGTH) return [...items];
  if (items.some((item) => skillKey(item.name) === skillKey(name))) {
    return [...items];
  }
  return [...items, { name, skillId: null }].slice(0, MAX_PROFILE_SKILLS);
}

export function uniqueSkillSuggestions(
  rows: readonly CanonicalSkillSuggestion[],
): CanonicalSkillSuggestion[] {
  const seen = new Set<string>();
  const unique: CanonicalSkillSuggestion[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

export function suggestionsForDraft(
  readyQuery: string,
  draft: string,
  rows: readonly CanonicalSkillSuggestion[],
): CanonicalSkillSuggestion[] {
  return readyQuery === draft.trim() ? uniqueSkillSuggestions(rows) : [];
}

export function acceptSuggestionResponse(
  requestId: number,
  currentId: number,
  rows: readonly CanonicalSkillSuggestion[],
): CanonicalSkillSuggestion[] | null {
  if (requestId !== currentId) return null;
  return uniqueSkillSuggestions(rows);
}

export function exactSuggestion(
  suggestions: readonly CanonicalSkillSuggestion[],
  raw: string,
): CanonicalSkillSuggestion | undefined {
  const key = skillKey(raw);
  if (!key) return undefined;
  return suggestions.find(
    (item) => skillKey(item.nameEn) === key || skillKey(item.matchedTerm) === key,
  );
}

export function moveSkill(
  items: readonly ProfileSkillSelection[],
  from: number,
  to: number,
): ProfileSkillSelection[] {
  if (from === to || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return [...items];
  next.splice(to, 0, item);
  return next;
}
