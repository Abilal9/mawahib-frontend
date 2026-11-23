import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';

/** Mawahib pink for password visibility icons (per product request). */
const PASSWORD_TOGGLE_PINK = '#F6339A';

interface TextInputComponentProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showCharacterCount?: boolean;
  /**
   * When true, shows an eye / eye-off toggle that only affects secureTextEntry display.
   * Does not change the value or validation. Opt-in so SignIn stays unchanged.
   */
  enableVisibilityToggle?: boolean;
  /** Accessibility labels for the visibility toggle (defaults: Show/Hide password). */
  visibilityToggleLabels?: { show: string; hide: string };
}

export default function TextInput({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  showCharacterCount,
  value,
  maxLength,
  enableVisibilityToggle = false,
  visibilityToggleLabels,
  secureTextEntry,
  ...props
}: TextInputComponentProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const charCount =
    showCharacterCount && maxLength != null
      ? `${String(value ?? '').length}/${maxLength}`
      : null;

  const showToggle = enableVisibilityToggle;
  const isSecure = showToggle ? !passwordVisible : Boolean(secureTextEntry);
  const showLabel = visibilityToggleLabels?.show ?? 'Show password';
  const hideLabel = visibilityToggleLabels?.hide ?? 'Hide password';

  const toggleControl = showToggle ? (
    <TouchableOpacity
      onPress={() => setPasswordVisible((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={passwordVisible ? hideLabel : showLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.toggleHit}
      activeOpacity={0.7}
    >
      <Ionicons
        name={passwordVisible ? 'eye' : 'eye-off'}
        size={22}
        color={PASSWORD_TOGGLE_PINK}
      />
    </TouchableOpacity>
  ) : null;

  const resolvedRightIcon = toggleControl ?? rightIcon;

  return (
    <View style={[styles.container, containerStyle]}>
      {(label || charCount) && (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {charCount ? <Text style={styles.charCount}>{charCount}</Text> : null}
        </View>
      )}
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <RNTextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeft : undefined,
            resolvedRightIcon ? styles.inputWithRight : undefined,
            style,
          ]}
          placeholderTextColor={colors.textSecondary}
          value={value}
          maxLength={maxLength}
          secureTextEntry={isSecure}
          {...props}
        />
        {resolvedRightIcon ? (
          <View style={styles.iconRight}>{resolvedRightIcon}</View>
        ) : null}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputWithLeft: {
    paddingStart: spacing.sm,
  },
  inputWithRight: {
    paddingEnd: spacing.sm,
  },
  iconLeft: {
    paddingStart: spacing.lg,
  },
  iconRight: {
    paddingEnd: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
