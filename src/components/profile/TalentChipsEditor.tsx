import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { catalogLabel } from '../../i18n/catalogLabel';
import { t } from '../../i18n/runtime';
import { colors, spacing, radius, typography } from '../../theme';
import { TALENT_CHIP_STYLES } from '../../data/types';
import {
  acceptSuggestionResponse,
  addCanonicalSkill,
  addCustomSkill,
  exactSuggestion,
  suggestionsForDraft,
  MAX_PROFILE_SKILL_LENGTH,
  MAX_PROFILE_SKILLS,
  type CanonicalSkillSuggestion,
  type ProfileSkillSelection,
} from '../../domain/profileSkills';
import { suggestSkills } from '../../services/taxonomyApi';

const MAX_TALENTS = MAX_PROFILE_SKILLS;
const MAX_LEN = MAX_PROFILE_SKILL_LENGTH;

type Props = {
  value: ProfileSkillSelection[];
  onChange: (next: ProfileSkillSelection[]) => void;
  disabled?: boolean;
};

/**
 * Draft talent chip manager: add, × remove, drag reorder.
 * Persists only when parent Save is pressed.
 */
export default function TalentChipsEditor({ value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<CanonicalSkillSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const [suggestAttempt, setSuggestAttempt] = useState(0);
  const [readyQuery, setReadyQuery] = useState('');
  const layoutYs = useRef<number[]>([]);
  const itemsRef = useRef(value);
  const requestGen = useRef(0);
  itemsRef.current = value;

  useEffect(() => {
    const query = draft.trim();
    const requestId = requestGen.current + 1;
    requestGen.current = requestId;
    if (!query) {
      setSuggestions([]);
      setReadyQuery('');
      setSuggestError(false);
      setSuggesting(false);
      return;
    }
    const timer = setTimeout(() => {
      setSuggesting(true);
      suggestSkills(query)
        .then((rows) => {
          const accepted = acceptSuggestionResponse(
            requestId,
            requestGen.current,
            rows,
          );
          if (!accepted) return;
          setSuggestions(accepted);
          setReadyQuery(query);
          setSuggestError(false);
        })
        .catch(() => {
          if (requestId !== requestGen.current) return;
          setSuggestions([]);
          setReadyQuery(query);
          setSuggestError(true);
        })
        .finally(() => {
          if (requestId === requestGen.current) setSuggesting(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, suggestAttempt]);

  const visibleSuggestions = suggestionsForDraft(readyQuery, draft, suggestions);
  const lookupPending = draft.trim().length > 0 && readyQuery !== draft.trim();

  const selectCanonical = (suggestion: CanonicalSkillSuggestion) => {
    onChange(addCanonicalSkill(value, suggestion));
    setDraft('');
    setSuggestions([]);
    setReadyQuery('');
  };

  const addTalent = () => {
    if (lookupPending) return;
    const matched = exactSuggestion(visibleSuggestions, draft);
    if (matched) {
      selectCanonical(matched);
      return;
    }
    const next = addCustomSkill(value, draft);
    if (next.length === value.length && !draft.trim()) {
      setDraft('');
      return;
    }
    if (next.length === value.length) return;
    onChange(next);
    setDraft('');
    setSuggestions([]);
    setReadyQuery('');
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= itemsRef.current.length) return;
    const next = [...itemsRef.current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onChipLayout = (index: number, e: LayoutChangeEvent) => {
    layoutYs.current[index] = e.nativeEvent.layout.y;
  };

  const createPan = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => setDragging(index),
      onPanResponderMove: (_, g) => {
        const originY = layoutYs.current[index] ?? 0;
        const fingerY = originY + g.dy;
        let target = index;
        for (let i = 0; i < layoutYs.current.length; i += 1) {
          const y = layoutYs.current[i];
          if (y == null) continue;
          if (fingerY + 12 >= y) target = i;
        }
        if (target !== index) {
          move(index, target);
          setDragging(target);
        }
      },
      onPanResponderRelease: () => setDragging(null),
      onPanResponderTerminate: () => setDragging(null),
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.chipWrap}>
        {value.map((talent, index) => {
          const tone = TALENT_CHIP_STYLES[index % TALENT_CHIP_STYLES.length];
          const pan = createPan(index);
          return (
            <View
              key={talent.skillId ?? `custom:${talent.name}`}
              style={[
                styles.chip,
                { backgroundColor: tone.bg },
                dragging === index && styles.chipDragging,
              ]}
              onLayout={(e) => onChipLayout(index, e)}
              {...pan.panHandlers}
            >
              <Ionicons
                name="reorder-three"
                size={14}
                color={tone.text}
                style={{ marginEnd: 4 }}
              />
              <Text style={[styles.chipText, { color: tone.text }]}>{talent.name}</Text>
              <TouchableOpacity
                onPress={() => removeAt(index)}
                hitSlop={8}
                disabled={disabled}
                accessibilityLabel={`Remove ${talent.name}`}
              >
                <Ionicons name="close" size={14} color={tone.text} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_LEN))}
          placeholder="Add a talent…"
          placeholderTextColor={colors.textSecondary}
          editable={!disabled && value.length < MAX_TALENTS}
          onSubmitEditing={addTalent}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.addBtn,
            (!draft.trim() || disabled || lookupPending) && styles.addBtnDisabled,
          ]}
          onPress={addTalent}
          disabled={!draft.trim() || disabled || lookupPending || value.length >= MAX_TALENTS}
        >
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
      {draft.trim() ? (
        <View style={styles.suggestBox}>
          {lookupPending || suggesting ? (
            <Text style={styles.hint}>{t('taxonomy.looking')}</Text>
          ) : null}
          {visibleSuggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.suggestRow}
              onPress={() => selectCanonical(suggestion)}
              disabled={disabled}
            >
              <Text style={styles.suggestName}>{catalogLabel(suggestion)}</Text>
            </TouchableOpacity>
          ))}
          {!lookupPending && !exactSuggestion(visibleSuggestions, draft) ? (
            <TouchableOpacity
              key="add-custom-skill"
              style={styles.suggestRow}
              onPress={addTalent}
              disabled={disabled}
            >
              <Text style={styles.suggestName}>{`Add "${draft.trim()}"`}</Text>
            </TouchableOpacity>
          ) : null}
          {suggestError ? (
            <TouchableOpacity onPress={() => setSuggestAttempt((n) => n + 1)}>
              <Text style={styles.hint}>Couldn’t load suggestions. Tap to retry. You can still add your own.</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.hint}>
        {value.length}/{MAX_TALENTS} · drag chips to reorder · Save to persist
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minHeight: 36,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
  },
  chipDragging: {
    opacity: 0.85,
    transform: [{ scale: 1.03 }],
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.white,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  suggestBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  suggestRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestName: {
    ...typography.body,
    color: colors.text,
  },
});
