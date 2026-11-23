import React from 'react';
import { chevronForwardIcon } from '../../i18n/direction';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { colors, spacing, radius, typography } from '../../theme';
import { TabScreenProps } from '../../navigation/types';

const MENU_ITEMS = [
  {
    id: 'post',
    icon: 'images-outline' as const,
    label: 'Post',
    subtitle: 'Share photos or videos',
    color: colors.primary,
    screen: 'PostCreate' as const,
  },
  {
    id: 'story',
    icon: 'add-circle-outline' as const,
    label: 'Story',
    subtitle: 'Share a moment',
    color: '#FF6B35',
    screen: 'PhotoCapture' as const,
  },
  {
    id: 'job',
    icon: 'briefcase-outline' as const,
    label: 'Job',
    subtitle: 'Post a job opening',
    color: '#2CB67D',
    screen: 'PostJob' as const,
  },
];

export default function CreateMenuScreen({ navigation }: TabScreenProps<'CreateTab'>) {
  const handleSelect = (screen: (typeof MENU_ITEMS)[number]['screen']) => {
    if (screen === 'PostJob') {
      navigation.navigate('PostJob', {});
    } else {
      navigation.navigate(screen);
    }
  };

  return (
    <ScreenContainer safeBottom={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Create</Text>
        <Text style={styles.subtitle}>What would you like to share?</Text>
      </View>

      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.menuItem}
          onPress={() => handleSelect(item.screen)}
          activeOpacity={0.8}
        >
          <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name={chevronForwardIcon()} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl, marginTop: spacing.lg },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { ...typography.label, color: colors.text },
  menuSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
