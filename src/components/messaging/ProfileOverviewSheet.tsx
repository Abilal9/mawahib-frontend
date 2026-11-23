import React, { useEffect, useState } from 'react';
import { chevronForwardIcon } from '../../i18n/direction';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../ui/UserAvatar';
import { useConnections } from '../../context/ConnectionsContext';
import { authApi, type ApiUser } from '../../services/authApi';
import type { ConnectionRelation } from '../../data/types';

function relationLabel(relation: ConnectionRelation): string {
  switch (relation) {
    case 'connected':
      return 'Connected';
    case 'outgoing':
      return 'Request sent';
    case 'incoming':
      return 'Wants to connect';
    default:
      return 'Not connected';
  }
}

function formatLocation(user: ApiUser): string | null {
  const parts = [user.locationCity, user.locationCountry].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function accountTypeLabel(accountType: string): string {
  if (accountType === 'business') return 'Business';
  if (accountType === 'talent') return 'Talent';
  return accountType;
}

export default function ProfileOverviewSheet({
  visible,
  userId,
  onClose,
  onOpenFullProfile,
  conversationId,
  onOpenMedia,
}: {
  visible: boolean;
  userId: string | null | undefined;
  onClose: () => void;
  onOpenFullProfile: (userId: string) => void;
  conversationId?: string | null;
  onOpenMedia?: () => void;
}) {
  const { getRelation } = useConnections();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setUser(null);

    void (async () => {
      try {
        const apiUser = await authApi.getById(userId);
        if (!cancelled) setUser(apiUser);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  const openFull = () => {
    if (!userId) return;
    onOpenFullProfile(userId);
    onClose();
  };

  const relation = userId ? getRelation(userId) : 'none';
  const location = user ? formatLocation(user) : null;
  const headline = user?.title?.trim() || null;
  const bio = user?.bio?.trim() || null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeLink}>
                <Text style={styles.closeLinkText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : user ? (
            <>
              <TouchableOpacity
                style={styles.identity}
                onPress={openFull}
                activeOpacity={0.85}
              >
                <UserAvatar
                  uri={user.avatarUrl}
                  size={64}
                  style={styles.avatar}
                />
                <View style={styles.identityText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {user.displayName}
                    </Text>
                    {user.isVerified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.primary}
                      />
                    ) : null}
                  </View>
                  {headline ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {headline}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View style={styles.metaBlock}>
                {location ? (
                  <View style={styles.metaRow}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.meta} numberOfLines={1}>
                      {location}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.meta}>{accountTypeLabel(user.accountType)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.meta}>{relationLabel(relation)}</Text>
                </View>
              </View>

              {bio ? (
                <Text style={styles.bio} numberOfLines={3}>
                  {bio}
                </Text>
              ) : null}

              {onOpenMedia && conversationId ? (
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={() => {
                    onOpenMedia();
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel="View shared media"
                >
                  <Ionicons
                    name="images-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.mediaBtnText}>Media</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.fullProfileBtn}
                onPress={openFull}
                activeOpacity={0.85}
              >
                <Text style={styles.fullProfileBtnText}>View full profile</Text>
                <Ionicons
                  name={chevronForwardIcon()}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
    minHeight: 180,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  closeLink: { paddingVertical: spacing.sm },
  closeLinkText: { ...typography.label, color: colors.primary },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
  },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: { ...typography.h3, color: colors.text, flexShrink: 1 },
  metaBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  bio: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
    lineHeight: 22,
  },
  fullProfileBtn: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background,
  },
  fullProfileBtnText: {
    ...typography.label,
    color: colors.primary,
  },
  mediaBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background,
  },
  mediaBtnText: {
    ...typography.label,
    color: colors.primary,
  },
});
