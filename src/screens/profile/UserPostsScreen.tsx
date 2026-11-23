import React, { useEffect, useState } from 'react';
import { backIcon } from '../../i18n/direction';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { colors, spacing, radius, typography } from '../../theme';
import { useMyProfile } from '../../context/ProfileContext';
import { useVisitorUser } from '../../hooks/useVisitorUser';
import { Post } from '../../data/types';
import { postService } from '../../services/postService';
import { ScreenProps } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COL = 3;
const GAP = spacing.xs;
const TILE =
  (SCREEN_WIDTH - spacing.screen * 2 - GAP * (COL - 1)) / COL;

/**
 * Full list of a user's posts (own or visitor). Opened from profile Posts
 * tab via "View more" after the preview of the first two.
 */
export default function UserPostsScreen({
  route,
  navigation,
}: ScreenProps<'UserPosts'>) {
  const insets = useSafeAreaInsets();
  const { user: me } = useMyProfile();
  const userId = route.params?.userId;
  const isOwn = !userId || userId === me.id;
  const targetId = isOwn ? me.id : userId!;
  const visitorUser = useVisitorUser(isOwn ? undefined : userId);
  const profileUser = isOwn ? me : visitorUser.user;
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const page = await postService.listUserPosts(targetId);
        if (!cancelled) setUserPosts(page.items);
      } catch {
        if (!cancelled) setUserPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const title = profileUser
    ? isOwn
      ? 'My Posts'
      : `${profileUser.name.split(' ')[0]}'s Posts`
    : 'Posts';

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {isOwn ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('PostCreate')}
            hitSlop={8}
          >
            <Ionicons name="add-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={userPosts}
          keyExtractor={(item) => item.id}
          numColumns={COL}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('PostDetail', { postId: item.id })
              }
            >
              {item.images[0] ? (
                <Image
                  source={toImageSource(item.images[0])}
                  style={styles.tileImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.tileImage, styles.tileTextOnly]}>
                  <Text style={styles.tileCaption} numberOfLines={4}>
                    {item.caption}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    padding: spacing.screen,
    paddingBottom: 120,
  },
  row: { gap: GAP, marginBottom: GAP },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  tileImage: { width: '100%', height: '100%' },
  tileTextOnly: {
    padding: spacing.sm,
    justifyContent: 'center',
    backgroundColor: colors.borderLight,
  },
  tileCaption: { ...typography.caption, color: colors.text },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary },
});
