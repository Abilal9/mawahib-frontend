import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '../ui/UserAvatar';
import { colors, spacing, radius, typography } from '../../theme';
import { displayProfileTitle } from '../../constants/profile';
import type { TalentConnectStatus } from '../../data/types';

export type ExploreTalentCardData = {
  id: string;
  name: string;
  title: string | null;
  avatarUrl?: string | number | null;
  location: string | null;
  skills: string[];
  rating: number;
  reviewCount: number;
  studio?: boolean;
  isVerified?: boolean;
};

export default function ExploreTalentCard({
  talent,
  connectStatus = 'connect',
  onPress,
  onConnect,
  compact = false,
}: {
  talent: ExploreTalentCardData;
  connectStatus?: TalentConnectStatus;
  onPress: () => void;
  onConnect?: () => void;
  compact?: boolean;
}) {
  const connectStyle =
    connectStatus === 'added'
      ? styles.connectAdded
      : connectStatus === 'incoming'
        ? styles.connectIncoming
        : connectStatus === 'request-sent'
          ? styles.connectPending
          : styles.connectDefault;
  const connectIcon: keyof typeof Ionicons.glyphMap =
    connectStatus === 'added'
      ? 'checkmark'
      : connectStatus === 'incoming'
        ? 'arrow-down'
        : connectStatus === 'request-sent'
          ? 'time-outline'
          : 'person-add-outline';

  return (
    <TouchableOpacity
      style={[styles.talentCard, compact && styles.compactCard]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.talentRow}>
        <UserAvatar uri={talent.avatarUrl} size={36} />
        <View style={styles.talentBody}>
          <View style={styles.nameRow}>
            <Text style={styles.talentName}>{talent.name}</Text>
            {talent.isVerified ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            ) : null}
            {talent.studio ? (
              <View style={styles.studioBadge}>
                <Text style={styles.studioText}>Studio</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.talentTitle}>{displayProfileTitle(talent.title)}</Text>
          {talent.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.text} />
              <Text style={styles.metaText}>{talent.location}</Text>
            </View>
          ) : null}
          {talent.skills.length > 0 ? (
            <Text style={styles.skillLine} numberOfLines={1}>
              {talent.skills.slice(0, 3).join(' · ')}
            </Text>
          ) : null}
          {talent.reviewCount > 0 ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={styles.ratingValue}>{talent.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({talent.reviewCount})</Text>
            </View>
          ) : null}
        </View>
        {onConnect ? (
          <TouchableOpacity
            style={[styles.connectBtn, connectStyle]}
            onPress={onConnect}
            accessibilityLabel={
              connectStatus === 'incoming'
                ? 'Accept connection request'
                : connectStatus === 'request-sent'
                  ? 'Cancel connection request'
                  : connectStatus === 'added'
                    ? 'Confirm disconnect'
                    : 'Connect'
            }
            activeOpacity={0.85}
          >
            <Ionicons
              name={connectIcon}
              size={16}
              color={connectStatus === 'request-sent' ? colors.text : colors.white}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  talentCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  compactCard: {
    width: 280,
    marginBottom: 0,
    marginRight: spacing.sm,
  },
  talentRow: { flexDirection: 'row', gap: spacing.sm },
  talentBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  talentName: { ...typography.body, color: colors.text, fontWeight: '600' },
  studioBadge: {
    backgroundColor: '#FDF2F8',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  studioText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  talentTitle: { ...typography.bodySmall, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.caption, color: colors.text },
  skillLine: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingValue: { ...typography.caption, color: colors.text },
  ratingCount: { ...typography.caption, color: '#829AB1' },
  connectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectDefault: { backgroundColor: colors.primary },
  connectPending: { backgroundColor: colors.borderLight },
  connectIncoming: { backgroundColor: colors.warning },
  connectAdded: { backgroundColor: colors.success },
});
