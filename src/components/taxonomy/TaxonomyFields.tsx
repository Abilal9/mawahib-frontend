import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { catalogLabel } from '../../i18n/catalogLabel';
import { t } from '../../i18n/runtime';
import { colors, radius, spacing, typography } from '../../theme';
import {
  MAX_OFFERING_SKILLS,
  rankSkillSuggestions,
  uniqueOfferingSkills,
  type OfferingSkillChip,
} from '../../domain/offeringTaxonomy';
import { loadTaxonomy, suggestSkills, type TaxonomyCategory } from '../../services/taxonomyApi';

export function TaxonomyFields({
  categoryId,
  categoryName,
  onCategoryChange,
  skills,
  onSkillsChange,
  categoryRequired,
  customCategory,
  onCustomCategoryChange,
  customLabel,
  customError,
  onAllowsCustomCategoryChange,
}: {
  categoryId: string | null;
  categoryName: string | null;
  onCategoryChange: (category: {
    id: string;
    name: string;
    allowsCustomCategory: boolean;
  }) => void;
  skills: OfferingSkillChip[];
  onSkillsChange: (skills: OfferingSkillChip[]) => void;
  categoryRequired: boolean;
  customCategory: string;
  onCustomCategoryChange: (value: string) => void;
  customLabel: string;
  customError?: string | null;
  onAllowsCustomCategoryChange?: (allows: boolean) => void;
}) {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; nameEn: string; nameAr?: string | null; categoryId?: string }>
  >([]);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    loadTaxonomy()
      .then((catalog) => {
        if (!active) return;
        setCategories(catalog.categories);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    const query = draft.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setLooking(false);
      return;
    }
    let active = true;
    setLooking(true);
    const timer = setTimeout(() => {
      suggestSkills(query)
        .then((rows) => {
          if (!active) return;
          setSuggestions(rankSkillSuggestions(rows, categoryId));
          setLooking(false);
        })
        .catch(() => {
          if (!active) return;
          setSuggestions([]);
          setLooking(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, categoryId]);

  const allowsCustom =
    categories.find((category) => category.id === categoryId)
      ?.allowsCustomCategory === true;

  useEffect(() => {
    if (loading) return;
    onAllowsCustomCategoryChange?.(allowsCustom);
  }, [allowsCustom, loading, onAllowsCustomCategoryChange]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const selectedName = selectedCategory ? catalogLabel(selectedCategory) : categoryName;

  return (
    <View>
      <Text style={styles.label}>
        {t('taxonomy.category')}{categoryRequired ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <TouchableOpacity onPress={() => setAttempt((value) => value + 1)}>
          <Text style={styles.error}>{t('explore.categoriesFailed')}</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.categoryList}>
        {categories.map((category) => {
          const selected = category.id === categoryId;
          const label = catalogLabel(category);
          return (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryChip, selected && styles.categoryChipOn]}
              onPress={() =>
                onCategoryChange({
                  id: category.id,
                  name: category.nameEn,
                  allowsCustomCategory: category.allowsCustomCategory === true,
                })
              }
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Text style={[styles.categoryText, selected && styles.categoryTextOn]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {categoryId && !categories.some((category) => category.id === categoryId) && selectedName ? (
        <Text style={styles.hint}>{t('taxonomy.selected', { name: selectedName })}</Text>
      ) : null}
      {allowsCustom ? (
        <>
          <Text style={styles.label}>
            {customLabel}
            <Text style={styles.required}> *</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={customCategory}
            onChangeText={onCustomCategoryChange}
            placeholder={t('taxonomy.customExample')}
            placeholderTextColor={colors.textSecondary}
          />
          {customError ? <Text style={styles.error}>{customError}</Text> : null}
        </>
      ) : null}

      <Text style={styles.label}>{t('taxonomy.skills')}</Text>
      <View style={styles.chips}>
        {skills.map((skill, index) => (
          <View key={skill.id} style={styles.skillChip}>
            <Text style={styles.skillText}>{skill.name}</Text>
            <TouchableOpacity
              onPress={() =>
                onSkillsChange(skills.filter((item) => item.id !== skill.id))
              }
              accessibilityLabel={t('taxonomy.removeSkill', { name: skill.name })}
            >
              <Text style={styles.remove}>×</Text>
            </TouchableOpacity>
            {index > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  const next = [...skills];
                  const [item] = next.splice(index, 1);
                  next.splice(index - 1, 0, item);
                  onSkillsChange(next);
                }}
                accessibilityLabel={t('taxonomy.moveSkill', { name: skill.name })}
              >
                <Text style={styles.move}>↑</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={t('taxonomy.searchSkills')}
        placeholderTextColor={colors.textSecondary}
        editable={skills.length < MAX_OFFERING_SKILLS}
      />
      {looking ? <Text style={styles.hint}>{t('taxonomy.looking')}</Text> : null}
      {suggestions.map((suggestion) => (
        <TouchableOpacity
          key={suggestion.id}
          style={styles.suggestion}
          onPress={() => {
            onSkillsChange(
              uniqueOfferingSkills([
                ...skills,
                { id: suggestion.id, name: suggestion.nameEn },
              ]),
            );
            setDraft('');
            setSuggestions([]);
          }}
        >
          <Text style={styles.suggestionText}>{catalogLabel(suggestion)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyMedium, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  required: { color: colors.error },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { ...typography.caption, color: colors.text },
  categoryTextOn: { color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skillText: { ...typography.caption, color: colors.text },
  remove: { color: colors.textSecondary, fontSize: 16 },
  move: { color: colors.primary, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    color: colors.text,
  },
  suggestion: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: { ...typography.body, color: colors.text },
});
