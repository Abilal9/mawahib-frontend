import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import GuestScreenHeader from '../../components/guest/GuestScreenHeader';
import { GuestStatusBlock } from '../../components/guest/GuestDiscoveryCards';
import { toImageSource } from '../../utils/image';
import { getMediaCacheKey } from '../../lib/mediaCacheKey';
import { colors, spacing, typography } from '../../theme';
import { t } from '../../i18n/runtime';
import type { SignedOutScreenProps } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Public portfolio detail uses the already-fetched public project payload.
 * No authenticated lookup and no GET /portfolio/:id fallback.
 */
export default function GuestPortfolioProjectDetailScreen({
  route,
  navigation,
}: SignedOutScreenProps<'PortfolioProjectDetail'>) {
  const title = route.params.title?.trim() ?? '';
  const description = route.params.description?.trim() ?? '';
  const images = route.params.images ?? [];
  const missing = !title && images.length === 0;

  return (
    <ScreenContainer padded={false} safeTop={false} backgroundColor={colors.background}>
      <StatusBar style="dark" />
      <GuestScreenHeader onBack={() => navigation.goBack()} title={title || t('editor.project')} />
      {missing ? (
        <GuestStatusBlock error={t('editor.projectUnavailable')} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {images.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={toImageSource(uri)}
                  style={styles.hero}
                  contentFit="cover"
                  recyclingKey={getMediaCacheKey(uri) ?? uri}
                />
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.copy}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxxl },
  hero: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    backgroundColor: colors.borderLight,
  },
  copy: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, gap: spacing.sm },
  title: { ...typography.h2, color: colors.text },
  description: { ...typography.body, color: colors.text },
});
