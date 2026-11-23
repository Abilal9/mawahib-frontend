import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { getMediaCacheKey } from '../../lib/mediaCacheKey';
import { toImageSource } from '../../utils/image';
import { colors, typography } from '../../theme';
import { t } from '../../i18n/runtime';

/** Explore cover height. Profile cards pass their own existing height. */
const DEFAULT_MEDIA_HEIGHT = 160;
/** Subtle tile split. Smaller than spacing.xs so the gallery still reads as one cover. */
const TILE_GAP = 2;

type Props = {
  /** Position-ordered gallery URLs. images[0] is the primary cover. */
  images: string[];
  /** Media block height. Defaults to the Explore cover height. */
  height?: number;
};

/**
 * Shared service-card cover. One image stays full-bleed. Two or more use a
 * LinkedIn-style mosaic: a wide primary and a narrow right column.
 * The parent card owns the tap; this component does not navigate.
 */
export default function ServiceMediaMosaic({
  images,
  height = DEFAULT_MEDIA_HEIGHT,
}: Props) {
  const count = images.length;
  const stackTileHeight = (height - TILE_GAP) / 2;
  if (count === 0) {
    return <View style={[styles.fallback, { height }]} />;
  }

  const label =
    count === 1 ? t('discover.galleryOne') : t('discover.galleryMany', { count });

  if (count === 1) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label}>
        <Tile uri={images[0]} style={[styles.full, { height }]} />
      </View>
    );
  }

  const extra = count - 3;

  return (
    <View
      style={[styles.row, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Tile uri={images[0]} style={[styles.main, { height }]} />
      {count === 2 ? (
        <Tile uri={images[1]} style={[styles.side, { height }]} />
      ) : (
        <View style={[styles.stack, { height }]}>
          <Tile uri={images[1]} style={[styles.stackTile, { height: stackTileHeight }]} />
          <View style={[styles.stackTile, { height: stackTileHeight }]}>
            <Tile uri={images[2]} style={StyleSheet.absoluteFill} />
            {extra > 0 ? (
              <View style={styles.overlay} pointerEvents="none">
                <Text style={styles.overlayText}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function Tile({ uri, style }: { uri: string; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tile, style]}>
      <Image
        source={toImageSource(uri)}
        style={styles.image}
        contentFit="cover"
        accessible={false}
        recyclingKey={getMediaCacheKey(uri) ?? uri}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.borderLight,
  },
  full: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  main: { flex: 2 },
  side: { flex: 1 },
  stack: { flex: 1, gap: TILE_GAP },
  stackTile: { width: '100%', overflow: 'hidden' },
  tile: {
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    ...typography.h3,
    color: colors.white,
  },
});
