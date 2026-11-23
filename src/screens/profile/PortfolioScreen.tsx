import React from 'react';
import { backIcon } from '../../i18n/direction';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { colors, spacing, radius, typography } from '../../theme';
import { usePosts } from '../../context/PostsContext';
import { userService } from '../../services';
import { RootStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - spacing.screen * 2 - spacing.sm) / 2;

type Props = {
  route: { params?: { userId?: string } };
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

/** Unregistered in RootNavigator — kept for optional reuse. */
export default function PortfolioScreen({ route, navigation }: Props) {
  const { posts } = usePosts();
  const user = route.params?.userId ? userService.getByIdSync(route.params.userId) : undefined;
  const portfolioItems = posts
    .filter((post) => (user ? post.author.id === user.id : true))
    .flatMap((p) => p.images.map((img, i) => ({ id: `${p.id}-${i}`, uri: img, postId: p.id })));

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name={backIcon()} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {user ? `${user.name.split(' ')[0]}'s Portfolio` : 'Portfolio'}
        </Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={portfolioItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No portfolio items yet.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('FullPhotoPreview', { images: [item.uri], initialIndex: 0 })}
            activeOpacity={0.9}
          >
            <Image source={toImageSource(item.uri)} style={styles.image} contentFit="cover" />
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screen, paddingVertical: spacing.md,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  grid: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  item: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: radius.card, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingTop: spacing.xxl },
});
