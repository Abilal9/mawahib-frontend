import React from 'react';
import { Alert, I18nManager, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { colors, spacing, radius, typography } from '../../theme';
import { languages, LanguageId } from '../../data/mock/languages';
import { arabicChoiceEnabled } from '../../i18n/locale';
import { ScreenProps } from '../../navigation/types';
import { useLocale } from '../../i18n/LocaleProvider';
import { t } from '../../i18n/runtime';
import { MessageKey } from '../../i18n/messages';

export default function ChangeLanguageScreen({ navigation }: ScreenProps<'ChangeLanguage'>) {
  const { applied, saved, pending, selectLanguage } = useLocale();

  const choose = (id: LanguageId) => {
    if (id === applied && id === saved) return;
    if (id === saved) return;
    if (id === applied) {
      void selectLanguage(id);
      return;
    }
    const languageName = t(id === 'ar' ? 'language.arabic' : 'language.english');
    Alert.alert(t('language.confirmTitle'), `${t('language.confirmBody')}\n\n${t('language.pending', { language: languageName })}`, [
      { text: t('language.cancel'), style: 'cancel' },
      { text: t('language.save'), onPress: () => void selectLanguage(id) },
    ]);
  };

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} accessibilityLabel={t('language.cancel')}>
          <Ionicons name={I18nManager.isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('language.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.list}>
        {(arabicChoiceEnabled ? languages : languages.filter((language) => language.id === 'en')).map((language, index) => {
          const isApplied = applied === language.id;
          return (
            <TouchableOpacity
              key={language.id}
              style={[styles.row, index < languages.length - 1 && styles.rowBorder]}
              onPress={() => choose(language.id)}
              activeOpacity={0.8}
              accessibilityState={{ selected: isApplied }}
            >
              <View>
                <Text style={styles.label}>{t(language.labelKey as MessageKey)}</Text>
                {isApplied ? <Text style={styles.nativeLabel}>{t('language.current')}</Text> : null}
              </View>
              <View style={[styles.radio, isApplied && styles.radioSelected]}>
                {isApplied ? <View style={styles.radioDot} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {pending ? (
        <Text style={styles.pending}>
          {t('language.pending', {
            language: t(saved === 'ar' ? 'language.arabic' : 'language.english'),
          })}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  list: {
    marginHorizontal: spacing.screen,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  label: { ...typography.body, color: colors.text, fontWeight: '500' },
  nativeLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  pending: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginHorizontal: spacing.screen,
    marginTop: spacing.lg,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
});
