import React, { useCallback, useMemo, useState } from 'react';
import { backIcon, chevronForwardIcon } from '../../i18n/direction';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { toImageSource } from '../../utils/image';
import UserAvatar from '../../components/ui/UserAvatar';
import { colors, spacing, radius, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import { useConnections } from '../../context/ConnectionsContext';
import {
  connectionPeerToUser,
  connectionService,
} from '../../services/connectionService';
import { useMyProfile } from '../../context/ProfileContext';
import { User } from '../../data/types';
import { openUserProfile } from '../../utils/openUserProfile';
import { useVisitorUser } from '../../hooks/useVisitorUser';
import { isBackendUserId } from '../../lib/isBackendUserId';
import { ScreenProps } from '../../navigation/types';

type ConnectionsTab = 'requests' | 'connections';

export default function ConnectionsScreen({
  navigation,
  route,
}: ScreenProps<'Connections'>) {
  const viewedUserId = route.params?.userId;
  const { user: me } = useMyProfile();
  const isOwn = !viewedUserId || viewedUserId === me.id;
  const {
    connectedUsers,
    incomingUsers,
    acceptRequest,
    denyRequest,
    refreshIfStale,
    mutationBusy,
  } = useConnections();
  const [tab, setTab] = useState<ConnectionsTab>(
    isOwn && incomingUsers.length > 0 ? 'requests' : 'connections'
  );

  const visitorUser = useVisitorUser(
    !isOwn && isBackendUserId(viewedUserId) ? viewedUserId : undefined,
  );
  const viewedUser =
    viewedUserId && visitorUser.user?.id === viewedUserId
      ? visitorUser.user
      : undefined;
  const [mutualItems, setMutualItems] = useState<User[]>([]);
  const [mutualCount, setMutualCount] = useState(0);
  const [mutualTotal, setMutualTotal] = useState<number | null>(null);
  const [mutualLoading, setMutualLoading] = useState(false);
  const [mutualError, setMutualError] = useState<string | null>(null);
  const [mutualAttempt, setMutualAttempt] = useState(0);
  const canLoadMutuals =
    !isOwn &&
    isBackendUserId(viewedUserId) &&
    isBackendUserId(me.id) &&
    viewedUserId !== me.id;
  const mutualTargetId = canLoadMutuals ? viewedUserId : undefined;
  const [mutualForId, setMutualForId] = useState(mutualTargetId);
  if (mutualForId !== mutualTargetId) {
    setMutualForId(mutualTargetId);
    setMutualItems([]);
    setMutualCount(0);
    setMutualTotal(null);
    setMutualError(null);
    setMutualLoading(Boolean(mutualTargetId));
  }
  const visitorCount = mutualTotal ?? viewedUser?.connectionsCount ?? 0;
  const visitorHeaderPending =
    !isOwn &&
    Boolean(viewedUserId) &&
    visitorUser.user?.id !== viewedUserId &&
    !visitorUser.error;

  useFocusEffect(
    useCallback(() => {
      if (isOwn) {
        void refreshIfStale(15_000);
        return;
      }
      if (!canLoadMutuals || !viewedUserId) return;
      let cancelled = false;
      setMutualLoading(true);
      setMutualError(null);
      void connectionService
        .listMutual(viewedUserId)
        .then((result) => {
          if (cancelled) return;
          setMutualTotal(result.connectionsCount);
          setMutualCount(result.mutualCount);
          setMutualItems(result.items.map(connectionPeerToUser));
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setMutualError(
            error instanceof Error
              ? error.message
              : t('profile.failedMutual'),
          );
        })
        .finally(() => {
          if (!cancelled) setMutualLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [isOwn, canLoadMutuals, viewedUserId, refreshIfStale, mutualAttempt]),
  );

  const data: User[] = tab === 'requests' ? incomingUsers : connectedUsers;

  const header = useMemo(() => {
    if (!isOwn) {
      return (
        <View>
          <Text style={styles.count}>
            {visitorUser.loading || visitorHeaderPending
              ? t('profile.loadingConnections')
              : visitorUser.error
                ? visitorUser.error
                : t(
                    visitorCount === 1 ? 'profile.connectionOne' : 'profile.connectionOther',
                    { count: visitorCount },
                  )}
          </Text>
          {mutualTotal !== null && !mutualLoading && !mutualError && !visitorUser.error ? (
            <View>
              <Text style={styles.mutualHeading}>
                {mutualCount > 0
                  ? t('profile.mutualCount', { count: mutualCount })
                  : t('profile.noMutual')}
              </Text>
              <Text style={styles.privateNote}>
                {t('profile.sharedConnections')}
              </Text>
            </View>
          ) : null}
          {mutualLoading ? (
            <Text style={styles.privateNote}>{t('profile.loadingMutual')}</Text>
          ) : null}
          {mutualError ? (
            <TouchableOpacity onPress={() => setMutualAttempt((n) => n + 1)}>
              <Text style={styles.privateNote}>
                {mutualError ? t('profile.tapRetry', { message: mutualError }) : null}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    return (
      <View>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setTab('requests')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
              {incomingUsers.length > 0
                ? t('profile.requestsCount', { count: incomingUsers.length })
                : t('profile.requests')}
            </Text>
            <View style={[styles.tabUnderline, tab !== 'requests' && styles.tabUnderlineHidden]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setTab('connections')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'connections' && styles.tabTextActive]}>
              {t('profile.connectionsCount', { count: connectedUsers.length })}
            </Text>
            <View
              style={[styles.tabUnderline, tab !== 'connections' && styles.tabUnderlineHidden]}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.count}>
          {tab === 'requests'
            ? incomingUsers.length === 0
              ? t('profile.noPending')
              : t(
                  incomingUsers.length === 1 ? 'profile.pendingOne' : 'profile.pendingOther',
                  { count: incomingUsers.length },
                )
            : t(
                connectedUsers.length === 1 ? 'profile.connectionOne' : 'profile.connectionOther',
                { count: connectedUsers.length },
              )}
        </Text>
      </View>
    );
  }, [
    isOwn,
    tab,
    incomingUsers.length,
    connectedUsers.length,
    visitorCount,
    visitorUser.loading,
    visitorUser.error,
    visitorHeaderPending,
    mutualCount,
    mutualTotal,
    mutualLoading,
    mutualError,
  ]);

  const renderConnection = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openUserProfile(navigation, item.id, me.id)}
      activeOpacity={0.85}
    >
      <UserAvatar uri={item.avatar} size={52} style={styles.avatar} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>
          {item.isVerified ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          ) : null}
        </View>
        {item.title ? <Text style={styles.subtitle}>{item.title}</Text> : null}
        {item.location ? <Text style={styles.location}>{item.location}</Text> : null}
      </View>
      <Ionicons name={chevronForwardIcon()} size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.requestPerson}
        onPress={() => openUserProfile(navigation, item.id, me.id)}
        activeOpacity={0.85}
      >
        <UserAvatar uri={item.avatar} size={52} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            {item.isVerified ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            ) : null}
          </View>
          {item.title ? <Text style={styles.subtitle}>{item.title}</Text> : null}
          {item.location ? <Text style={styles.location}>{item.location}</Text> : null}
        </View>
      </TouchableOpacity>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => acceptRequest(item.id)}
          disabled={mutationBusy}
          activeOpacity={0.85}
        >
          <Text style={styles.acceptText}>{t('discover.accept')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.denyBtn}
          onPress={() => denyRequest(item.id)}
          disabled={mutationBusy}
          activeOpacity={0.85}
        >
          <Text style={styles.denyText}>{t('profile.deny')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const title = isOwn
    ? t('nav.connections')
    : viewedUser
      ? t('profile.personsConnections', { name: viewedUser.name.split(' ')[0] })
      : t('profile.connections');

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerButton} />
      </View>

      {isOwn ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={tab === 'requests' ? renderRequest : renderConnection}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'requests'
                ? t('profile.requestsEmpty')
                : t('profile.connectionsEmpty')}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={mutualError ? [] : mutualItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={renderConnection}
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  tabs: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  tabUnderline: {
    marginTop: spacing.sm,
    height: 2,
    width: '70%',
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  tabUnderlineHidden: { backgroundColor: 'transparent' },
  count: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  privateNote: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  mutualHeading: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  requestPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.avatar },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { ...typography.label, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  location: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  acceptText: { ...typography.button, color: colors.white, fontSize: 14 },
  denyBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  denyText: { ...typography.button, color: colors.textSecondary, fontSize: 14 },
});
