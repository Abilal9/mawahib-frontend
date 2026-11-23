import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import SearchableSelectModal, {
  SelectOption,
} from '../../components/ui/SearchableSelectModal';
import TalentChipsEditor from '../../components/profile/TalentChipsEditor';
import { aboutSectionLabel } from '../../i18n/profileLabels';
import { colors, spacing, radius, typography } from '../../theme';
import { getAppliedLocale, t } from '../../i18n/runtime';
import { employmentChoiceLabel, locationTypeChoiceLabel } from '../../i18n/profileLabels';
import { gregorianMonthName } from '../../utils/gregorianCivilDate';
import { useMyProfile } from '../../context/ProfileContext';
import {
  AboutSectionKey,
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileLanguage,
} from '../../data/types';
import { ScreenProps } from '../../navigation/types';
import {
  LANGUAGE_LEVELS,
  LanguageLevelCode,
  displayLanguageLevel,
  isLanguageLevelCode,
} from '../../constants/languageLevels';
import { WORLD_LANGUAGES, findWorldLanguage } from '../../constants/worldLanguages';
import {
  EMPLOYMENT_TYPES,
  LOCATION_TYPES,
  MONTH_OPTIONS,
  yearOptions,
} from '../../constants/aboutOptions';
import { removeById, replaceById } from '../../utils/aboutFormat';
import { selectionsFromProfile, type ProfileSkillSelection } from '../../domain/profileSkills';
import { ApiError } from '../../lib/apiClient';

const BIO_MAX_LENGTH = 500;

type SelectKind =
  | 'language'
  | 'level'
  | 'employment'
  | 'locationType'
  | 'startMonth'
  | 'startYear'
  | 'endMonth'
  | 'endYear'
  | 'issueMonth'
  | 'issueYear'
  | 'expMonth'
  | 'expYear'
  | null;

export default function EditAboutSectionScreen({
  navigation,
  route,
}: ScreenProps<'EditAboutSection'>) {
  const { section, itemId } = route.params;
  const insets = useSafeAreaInsets();
  const profile = useMyProfile();
  const label = aboutSectionLabel(section);
  const isEdit = Boolean(itemId) && section !== 'talents' && section !== 'bio';

  const existingLanguage = profile.content.languages.find((l) => l.id === itemId);
  const existingEducation = profile.content.education.find((e) => e.id === itemId);
  const existingExperience = profile.content.experience.find((e) => e.id === itemId);
  const existingCert = profile.content.certifications.find((c) => c.id === itemId);

  const [bio, setBio] = useState(profile.content.bio);
  const [talents, setTalents] = useState<ProfileSkillSelection[]>(() =>
    selectionsFromProfile({
      skills: profile.content.talents,
      skillSelections: profile.content.talentSelections,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectKind, setSelectKind] = useState<SelectKind>(null);

  // Language draft
  const [langCode, setLangCode] = useState(existingLanguage?.languageCode ?? '');
  const [langName, setLangName] = useState(existingLanguage?.name ?? '');
  const [langFlag, setLangFlag] = useState(existingLanguage?.flag ?? '');
  const [langLevel, setLangLevel] = useState<LanguageLevelCode | ''>(() => {
    const lvl = existingLanguage?.level;
    if (lvl && isLanguageLevelCode(lvl)) return lvl;
    if (lvl && /^native/i.test(lvl)) return 'NATIVE';
    const m = lvl?.match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
    if (m) return m[1].toUpperCase() as LanguageLevelCode;
    return '';
  });

  // Education draft
  const [eduSchool, setEduSchool] = useState(existingEducation?.school ?? '');
  const [eduDegree, setEduDegree] = useState(existingEducation?.degree ?? '');
  const [eduField, setEduField] = useState(existingEducation?.field ?? '');
  const [eduStartMonth, setEduStartMonth] = useState<number | null>(
    existingEducation?.startMonth ?? null,
  );
  const [eduStartYear, setEduStartYear] = useState<number | null>(
    existingEducation?.startYear ?? null,
  );
  const [eduEndMonth, setEduEndMonth] = useState<number | null>(
    existingEducation?.endMonth ?? null,
  );
  const [eduEndYear, setEduEndYear] = useState<number | null>(
    existingEducation?.endYear ?? null,
  );
  const [eduStudying, setEduStudying] = useState(
    Boolean(existingEducation?.currentlyStudying),
  );
  const [eduGrade, setEduGrade] = useState(
    existingEducation?.grade ?? existingEducation?.gpa ?? '',
  );
  const [eduDesc, setEduDesc] = useState(existingEducation?.description ?? '');

  // Experience draft
  const [expTitle, setExpTitle] = useState(existingExperience?.title ?? '');
  const [expCompany, setExpCompany] = useState(existingExperience?.company ?? '');
  const [expEmployment, setExpEmployment] = useState(
    existingExperience?.employmentType || existingExperience?.type || '',
  );
  const [expLocation, setExpLocation] = useState(existingExperience?.location ?? '');
  const [expLocationType, setExpLocationType] = useState(
    existingExperience?.locationType ?? '',
  );
  const [expStartMonth, setExpStartMonth] = useState<number | null>(
    existingExperience?.startMonth ?? null,
  );
  const [expStartYear, setExpStartYear] = useState<number | null>(
    existingExperience?.startYear ?? null,
  );
  const [expEndMonth, setExpEndMonth] = useState<number | null>(
    existingExperience?.endMonth ?? null,
  );
  const [expEndYear, setExpEndYear] = useState<number | null>(
    existingExperience?.endYear ?? null,
  );
  const [expWorking, setExpWorking] = useState(
    Boolean(existingExperience?.currentlyWorking),
  );
  const [expDesc, setExpDesc] = useState(existingExperience?.description ?? '');

  // Certification draft
  const [certName, setCertName] = useState(existingCert?.name ?? '');
  const [certOrg, setCertOrg] = useState(
    existingCert?.issuingOrganization || existingCert?.org || '',
  );
  const [certIssueMonth, setCertIssueMonth] = useState<number | null>(
    existingCert?.issueMonth ?? null,
  );
  const [certIssueYear, setCertIssueYear] = useState<number | null>(
    existingCert?.issueYear ??
      (existingCert?.year ? Number.parseInt(existingCert.year, 10) || null : null),
  );
  const [certExpMonth, setCertExpMonth] = useState<number | null>(
    existingCert?.expirationMonth ?? null,
  );
  const [certExpYear, setCertExpYear] = useState<number | null>(
    existingCert?.expirationYear ?? null,
  );
  const [certNoExpire, setCertNoExpire] = useState(
    existingCert?.doesNotExpire ?? true,
  );
  const [certId, setCertId] = useState(existingCert?.credentialId ?? '');
  const [certUrl, setCertUrl] = useState(existingCert?.credentialUrl ?? '');

  const years = useMemo(() => yearOptions(), []);

  const screenTitle = useMemo(() => {
    if (section === 'bio') {
      return profile.content.bio ? `Edit ${label}` : `Add ${label}`;
    }
    if (section === 'talents') return `Edit ${label}`;
    return `${isEdit ? 'Edit' : 'Add'} ${label.replace(/s$/, '') === label ? label : label.replace(/s$/, '')}`;
  }, [section, label, isEdit, profile.content.bio]);

  // Cleaner titles
  const titleText = (() => {
    if (section === 'bio') return profile.content.bio.trim() ? t('editor.editBio') : t('editor.addBio');
    if (section === 'talents') return t('editor.editTalents');
    if (section === 'languages') return isEdit ? t('editor.editLanguage') : t('editor.addLanguage');
    if (section === 'education') return isEdit ? t('editor.editEducation') : t('editor.addEducation');
    if (section === 'experience') return isEdit ? t('editor.editExperience') : t('editor.addExperience');
    if (section === 'certifications') {
      return isEdit ? t('editor.editCertification') : t('editor.addCertification');
    }
    return screenTitle;
  })();

  const selectOptions: SelectOption[] = useMemo(() => {
    switch (selectKind) {
      case 'language':
        return WORLD_LANGUAGES.map((l) => ({
          value: l.code,
          label: l.name,
          meta: l.flag,
        }));
      case 'level':
        return LANGUAGE_LEVELS.map((code) => ({
          value: code,
          label: displayLanguageLevel(code),
        }));
      case 'employment':
        return EMPLOYMENT_TYPES.map((value) => ({
          value,
          label: employmentChoiceLabel(value),
        }));
      case 'locationType':
        return LOCATION_TYPES.map((value) => ({
          value,
          label: locationTypeChoiceLabel(value),
        }));
      case 'startMonth':
      case 'endMonth':
      case 'issueMonth':
      case 'expMonth':
        return MONTH_OPTIONS.map((month) => ({
          value: String(month.value),
          label: gregorianMonthName(month.value - 1, getAppliedLocale()),
        }));
      case 'startYear':
      case 'endYear':
      case 'issueYear':
      case 'expYear':
        return years.map((y) => ({ value: String(y), label: String(y) }));
      default:
        return [];
    }
  }, [selectKind, years]);

  const onSelectOption = (opt: SelectOption) => {
    switch (selectKind) {
      case 'language': {
        const lang = findWorldLanguage(opt.value);
        setLangCode(opt.value);
        setLangName(lang?.name ?? opt.label);
        setLangFlag(lang?.flag ?? '');
        break;
      }
      case 'level':
        setLangLevel(opt.value as LanguageLevelCode);
        break;
      case 'employment':
        setExpEmployment(opt.value);
        break;
      case 'locationType':
        setExpLocationType(opt.value);
        break;
      case 'startMonth':
        if (section === 'education') setEduStartMonth(Number(opt.value));
        else if (section === 'experience') setExpStartMonth(Number(opt.value));
        break;
      case 'startYear':
        if (section === 'education') setEduStartYear(Number(opt.value));
        else if (section === 'experience') setExpStartYear(Number(opt.value));
        break;
      case 'endMonth':
        if (section === 'education') setEduEndMonth(Number(opt.value));
        else if (section === 'experience') setExpEndMonth(Number(opt.value));
        break;
      case 'endYear':
        if (section === 'education') setEduEndYear(Number(opt.value));
        else if (section === 'experience') setExpEndYear(Number(opt.value));
        break;
      case 'issueMonth':
        setCertIssueMonth(Number(opt.value));
        break;
      case 'issueYear':
        setCertIssueYear(Number(opt.value));
        break;
      case 'expMonth':
        setCertExpMonth(Number(opt.value));
        break;
      case 'expYear':
        setCertExpYear(Number(opt.value));
        break;
      default:
        break;
    }
  };

  const datesOk = (
    startYear: number | null,
    startMonth: number | null,
    endYear: number | null,
    endMonth: number | null,
    current: boolean,
  ) => {
    if (current || endYear == null || startYear == null) return true;
    const s = startYear * 100 + (startMonth ?? 0);
    const e = endYear * 100 + (endMonth ?? 0);
    return e >= s;
  };

  const save = async () => {
    try {
      setSaving(true);
      switch (section as AboutSectionKey) {
        case 'bio':
          await profile.setBio(bio.trim());
          break;
        case 'talents':
          await profile.setTalentSelections(talents);
          break;
        case 'languages': {
          if (!langName.trim() || !langLevel) {
            Alert.alert(t('editor.missingFields'), t('editor.chooseLanguage'));
            return;
          }
          const duplicate = profile.content.languages.some((l) => {
            if (isEdit && l.id === itemId) return false;
            if (langCode && l.languageCode) {
              return l.languageCode.toLowerCase() === langCode.toLowerCase();
            }
            return l.name.trim().toLowerCase() === langName.trim().toLowerCase();
          });
          if (duplicate) {
            Alert.alert(t('editor.alreadyAdded'), t('editor.languageExists'));
            return;
          }
          const nextItem: ProfileLanguage = {
            id: isEdit && itemId ? itemId : `lang-${Date.now()}`,
            name: langName.trim(),
            level: langLevel,
            ...(langCode ? { languageCode: langCode } : {}),
            ...(langFlag ? { flag: langFlag } : {}),
          };
          const next = isEdit && itemId
            ? replaceById(profile.content.languages, itemId, nextItem)
            : [...profile.content.languages, nextItem];
          await profile.setLanguages(next);
          break;
        }
        case 'education': {
          if (!eduSchool.trim()) {
            Alert.alert(t('editor.schoolRequired'), t('editor.enterSchool'));
            return;
          }
          if (!datesOk(eduStartYear, eduStartMonth, eduEndYear, eduEndMonth, eduStudying)) {
            Alert.alert(t('editor.invalidDates'), t('editor.endAfterStart'));
            return;
          }
          const nextItem: ProfileEducation = {
            id: isEdit && itemId ? itemId : `edu-${Date.now()}`,
            school: eduSchool.trim(),
            ...(eduDegree.trim() ? { degree: eduDegree.trim() } : {}),
            ...(eduField.trim() ? { field: eduField.trim() } : {}),
            ...(eduStartMonth ? { startMonth: eduStartMonth } : {}),
            ...(eduStartYear ? { startYear: eduStartYear } : {}),
            currentlyStudying: eduStudying,
            ...(!eduStudying && eduEndMonth ? { endMonth: eduEndMonth } : {}),
            ...(!eduStudying && eduEndYear ? { endYear: eduEndYear } : {}),
            ...(eduGrade.trim() ? { grade: eduGrade.trim() } : {}),
            ...(eduDesc.trim() ? { description: eduDesc.trim() } : {}),
          };
          const next = isEdit && itemId
            ? replaceById(profile.content.education, itemId, nextItem)
            : [...profile.content.education, nextItem];
          await profile.setEducation(next);
          break;
        }
        case 'experience': {
          if (!expTitle.trim() || !expCompany.trim()) {
            Alert.alert(t('editor.missingFields'), t('editor.titleCompanyRequired'));
            return;
          }
          if (!datesOk(expStartYear, expStartMonth, expEndYear, expEndMonth, expWorking)) {
            Alert.alert(t('editor.invalidDates'), t('editor.endAfterStart'));
            return;
          }
          const nextItem: ProfileExperience = {
            id: isEdit && itemId ? itemId : `exp-${Date.now()}`,
            title: expTitle.trim(),
            company: expCompany.trim(),
            ...(expEmployment ? { employmentType: expEmployment } : {}),
            ...(expLocation.trim() ? { location: expLocation.trim() } : {}),
            ...(expLocationType ? { locationType: expLocationType } : {}),
            ...(expStartMonth ? { startMonth: expStartMonth } : {}),
            ...(expStartYear ? { startYear: expStartYear } : {}),
            currentlyWorking: expWorking,
            ...(!expWorking && expEndMonth ? { endMonth: expEndMonth } : {}),
            ...(!expWorking && expEndYear ? { endYear: expEndYear } : {}),
            ...(expDesc.trim() ? { description: expDesc.trim() } : {}),
          };
          const next = isEdit && itemId
            ? replaceById(profile.content.experience, itemId, nextItem)
            : [...profile.content.experience, nextItem];
          await profile.setExperience(next);
          break;
        }
        case 'certifications': {
          if (!certName.trim() || !certOrg.trim()) {
            Alert.alert(t('editor.missingFields'), t('editor.certRequired'));
            return;
          }
          if (certUrl.trim()) {
            try {
              // eslint-disable-next-line no-new
              new URL(certUrl.trim());
            } catch {
              Alert.alert(t('editor.invalidUrl'), t('editor.enterUrl'));
              return;
            }
          }
          const nextItem: ProfileCertification = {
            id: isEdit && itemId ? itemId : `cert-${Date.now()}`,
            name: certName.trim(),
            issuingOrganization: certOrg.trim(),
            ...(certIssueMonth ? { issueMonth: certIssueMonth } : {}),
            ...(certIssueYear ? { issueYear: certIssueYear } : {}),
            doesNotExpire: certNoExpire,
            ...(!certNoExpire && certExpMonth ? { expirationMonth: certExpMonth } : {}),
            ...(!certNoExpire && certExpYear ? { expirationYear: certExpYear } : {}),
            ...(certId.trim() ? { credentialId: certId.trim() } : {}),
            ...(certUrl.trim() ? { credentialUrl: certUrl.trim() } : {}),
          };
          const next = isEdit && itemId
            ? replaceById(profile.content.certifications, itemId, nextItem)
            : [...profile.content.certifications, nextItem];
          await profile.setCertifications(next);
          break;
        }
      }
      navigation.goBack();
    } catch (err) {
      const canonical =
        err instanceof ApiError && err.code === 'SKILL_MATCHES_CANONICAL'
          ? err.nameEn
          : null;
      Alert.alert(
        t('editor.saveFailed'),
        canonical
          ? t('editor.chooseCanonical', { name: canonical })
          : err instanceof Error
            ? err.message
            : t('editor.pleaseTryAgain'),
      );
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async () => {
    if (!itemId) return;
    try {
      setSaving(true);
      setConfirmDelete(false);
      switch (section) {
        case 'languages':
          await profile.setLanguages(removeById(profile.content.languages, itemId));
          break;
        case 'education':
          await profile.setEducation(removeById(profile.content.education, itemId));
          break;
        case 'experience':
          await profile.setExperience(removeById(profile.content.experience, itemId));
          break;
        case 'certifications':
          await profile.setCertifications(
            removeById(profile.content.certifications, itemId),
          );
          break;
        default:
          break;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        t('editor.deleteFailed'),
        err instanceof Error ? err.message : t('editor.pleaseTryAgain'),
      );
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = (m: number | null) =>
    m ? gregorianMonthName(m - 1, getAppliedLocale()) || String(m) : t('editor.month');

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          disabled={saving}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{titleText}</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {section === 'bio' && (
            <Field
              label={t('editor.bio')}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder={t('editor.bioPlaceholder')}
              maxLength={BIO_MAX_LENGTH}
              showCount
            />
          )}

          {section === 'talents' && (
            <TalentChipsEditor value={talents} onChange={setTalents} disabled={saving} />
          )}

          {section === 'languages' && (
            <>
              <SelectField
                label={t('editor.language')}
                value={langName || t('editor.selectLanguage')}
                placeholder={!langName}
                onPress={() => setSelectKind('language')}
              />
              <SelectField
                label={t('editor.proficiency')}
                value={langLevel ? displayLanguageLevel(langLevel) : t('editor.selectLevel')}
                placeholder={!langLevel}
                onPress={() => setSelectKind('level')}
              />
            </>
          )}

          {section === 'education' && (
            <>
              <Field label={t('editor.school')} value={eduSchool} onChangeText={setEduSchool} />
              <Field label={t('editor.degree')} value={eduDegree} onChangeText={setEduDegree} />
              <Field label={t('editor.fieldOfStudy')} value={eduField} onChangeText={setEduField} />
              <Text style={styles.groupLabel}>{t('editor.start')}</Text>
              <View style={styles.row2}>
                <SelectField
                  label={t('editor.month')}
                  value={monthLabel(eduStartMonth)}
                  placeholder={!eduStartMonth}
                  onPress={() => setSelectKind('startMonth')}
                  compact
                />
                <SelectField
                  label={t('editor.year')}
                  value={eduStartYear ? String(eduStartYear) : t('editor.year')}
                  placeholder={!eduStartYear}
                  onPress={() => setSelectKind('startYear')}
                  compact
                />
              </View>
              <ToggleRow
                label={t('editor.studying')}
                value={eduStudying}
                onChange={setEduStudying}
              />
              {!eduStudying ? (
                <>
                  <Text style={styles.groupLabel}>{t('editor.end')}</Text>
                  <View style={styles.row2}>
                    <SelectField
                      label={t('editor.month')}
                      value={monthLabel(eduEndMonth)}
                      placeholder={!eduEndMonth}
                      onPress={() => setSelectKind('endMonth')}
                      compact
                    />
                    <SelectField
                      label={t('editor.year')}
                      value={eduEndYear ? String(eduEndYear) : t('editor.year')}
                      placeholder={!eduEndYear}
                      onPress={() => setSelectKind('endYear')}
                      compact
                    />
                  </View>
                </>
              ) : null}
              <Field label={t('editor.grade')} value={eduGrade} onChangeText={setEduGrade} />
              <Field
                label={t('editor.description')}
                value={eduDesc}
                onChangeText={setEduDesc}
                multiline
              />
            </>
          )}

          {section === 'experience' && (
            <>
              <Field label={t('editor.role')} value={expTitle} onChangeText={setExpTitle} />
              <Field
                label={t('editor.company')}
                value={expCompany}
                onChangeText={setExpCompany}
              />
              <SelectField
                label={t('editor.employmentType')}
                value={expEmployment ? employmentChoiceLabel(expEmployment) : t('editor.selectType')}
                placeholder={!expEmployment}
                onPress={() => setSelectKind('employment')}
              />
              <Field label={t('editor.location')} value={expLocation} onChangeText={setExpLocation} />
              <SelectField
                label={t('editor.locationType')}
                value={expLocationType ? locationTypeChoiceLabel(expLocationType) : t('editor.selectType')}
                placeholder={!expLocationType}
                onPress={() => setSelectKind('locationType')}
              />
              <Text style={styles.groupLabel}>{t('editor.start')}</Text>
              <View style={styles.row2}>
                <SelectField
                  label={t('editor.month')}
                  value={monthLabel(expStartMonth)}
                  placeholder={!expStartMonth}
                  onPress={() => setSelectKind('startMonth')}
                  compact
                />
                <SelectField
                  label={t('editor.year')}
                  value={expStartYear ? String(expStartYear) : t('editor.year')}
                  placeholder={!expStartYear}
                  onPress={() => setSelectKind('startYear')}
                  compact
                />
              </View>
              <ToggleRow
                label={t('editor.workingHere')}
                value={expWorking}
                onChange={setExpWorking}
              />
              {!expWorking ? (
                <>
                  <Text style={styles.groupLabel}>{t('editor.end')}</Text>
                  <View style={styles.row2}>
                    <SelectField
                      label={t('editor.month')}
                      value={monthLabel(expEndMonth)}
                      placeholder={!expEndMonth}
                      onPress={() => setSelectKind('endMonth')}
                      compact
                    />
                    <SelectField
                      label={t('editor.year')}
                      value={expEndYear ? String(expEndYear) : t('editor.year')}
                      placeholder={!expEndYear}
                      onPress={() => setSelectKind('endYear')}
                      compact
                    />
                  </View>
                </>
              ) : null}
              <Field
                label={t('editor.description')}
                value={expDesc}
                onChangeText={setExpDesc}
                multiline
              />
            </>
          )}

          {section === 'certifications' && (
            <>
              <Field
                label={t('editor.certName')}
                value={certName}
                onChangeText={setCertName}
              />
              <Field
                label={t('editor.issuer')}
                value={certOrg}
                onChangeText={setCertOrg}
              />
              <Text style={styles.groupLabel}>{t('editor.issueDate')}</Text>
              <View style={styles.row2}>
                <SelectField
                  label={t('editor.month')}
                  value={monthLabel(certIssueMonth)}
                  placeholder={!certIssueMonth}
                  onPress={() => setSelectKind('issueMonth')}
                  compact
                />
                <SelectField
                  label={t('editor.year')}
                  value={certIssueYear ? String(certIssueYear) : t('editor.year')}
                  placeholder={!certIssueYear}
                  onPress={() => setSelectKind('issueYear')}
                  compact
                />
              </View>
              <ToggleRow
                label={t('editor.noExpire')}
                value={certNoExpire}
                onChange={setCertNoExpire}
              />
              {!certNoExpire ? (
                <>
                  <Text style={styles.groupLabel}>{t('editor.expirationDate')}</Text>
                  <View style={styles.row2}>
                    <SelectField
                      label={t('editor.month')}
                      value={monthLabel(certExpMonth)}
                      placeholder={!certExpMonth}
                      onPress={() => setSelectKind('expMonth')}
                      compact
                    />
                    <SelectField
                      label={t('editor.year')}
                      value={certExpYear ? String(certExpYear) : t('editor.year')}
                      placeholder={!certExpYear}
                      onPress={() => setSelectKind('expYear')}
                      compact
                    />
                  </View>
                </>
              ) : null}
              <Field label={t('editor.credentialId')} value={certId} onChangeText={setCertId} />
              <Field
                label={t('editor.credentialUrl')}
                value={certUrl}
                onChangeText={setCertUrl}
                placeholder="https://"
                autoCapitalize="none"
              />
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button
            title={t('common.save')}
            onPress={() => {
              void save();
            }}
            disabled={saving}
          />
          {isEdit ? (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Text style={styles.deleteText}>
                {t(
                  section === 'languages'
                    ? 'editor.deleteLanguage'
                    : section === 'education'
                      ? 'editor.deleteEducation'
                      : section === 'experience'
                        ? 'editor.deleteExperience'
                        : 'editor.deleteCertification',
                )}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <SearchableSelectModal
        visible={selectKind != null}
        title={
          selectKind === 'language'
            ? t('editor.selectLanguage')
            : selectKind === 'level'
              ? t('editor.proficiency')
              : selectKind === 'employment'
                ? t('editor.selectEmployment')
                : selectKind === 'locationType'
                  ? t('editor.selectLocationType')
                  : t('editor.select')
        }
        options={selectOptions}
        searchable={selectKind === 'language'}
        onSelect={onSelectOption}
        onClose={() => setSelectKind(null)}
        selectedValue={
          selectKind === 'language'
            ? langCode
            : selectKind === 'level'
              ? langLevel
              : selectKind === 'employment'
                ? expEmployment
                : selectKind === 'locationType'
                  ? expLocationType
                  : undefined
        }
      />

      <ConfirmActionModal
        visible={confirmDelete}
        title={t('editor.deleteItemTitle')}
        message={t('editor.deleteItemBody')}
        confirmLabel={t('common.delete')}
        danger
        busy={saving}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void performDelete();
        }}
      />
    </ScreenContainer>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
  maxLength,
  showCount,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  showCount?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showCount && maxLength != null ? (
          <Text style={styles.charCount}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function SelectField({
  label,
  value,
  onPress,
  placeholder,
  compact,
}: {
  label: string;
  value: string;
  onPress: () => void;
  placeholder?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selector} onPress={onPress} activeOpacity={0.8}>
        <Text
          style={[styles.selectorText, placeholder && styles.selectorPlaceholder]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.text },
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  field: { gap: spacing.sm, flex: 1 },
  fieldCompact: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { ...typography.label, color: colors.text },
  charCount: { ...typography.caption, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 120,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.white,
  },
  selectorText: { ...typography.body, color: colors.text, flex: 1 },
  selectorPlaceholder: { color: colors.textSecondary },
  groupLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xs },
  row2: { flexDirection: 'row', gap: spacing.md },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: { ...typography.bodyMedium, color: colors.text, flex: 1, paddingEnd: spacing.md },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  deleteText: {
    ...typography.button,
    color: '#DC2626',
  },
});
