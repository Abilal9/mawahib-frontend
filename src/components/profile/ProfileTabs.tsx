import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import type { MessageKey } from '../../i18n/messages';
import { ProfileTab } from '../../data/types';

const TABS: ProfileTab[] = ['About', 'Portfolio', 'Services', 'Posts'];
const TAB_LABEL: Record<ProfileTab, MessageKey> = {
  About: 'profile.tabAbout',
  Portfolio: 'profile.tabPortfolio',
  Services: 'profile.tabServices',
  Posts: 'profile.tabPosts',
};

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

export default function ProfileTabs({ active, onChange }: ProfileTabsProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.wrap}>
        {TABS.map((tab, index) => {
          const selected = active === tab;
          return (
            <React.Fragment key={tab}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <TouchableOpacity
                style={[styles.tab, selected && styles.tabActive]}
                onPress={() => onChange(tab)}
                activeOpacity={0.85}
              >
                <Text style={[styles.text, selected && styles.textActive]}>{t(TAB_LABEL[tab])}</Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#FCE7F3',
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  textActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
