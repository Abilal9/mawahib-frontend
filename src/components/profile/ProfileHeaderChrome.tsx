import React from 'react';
import { chevronBackIcon } from '../../i18n/direction';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { toImageSource } from '../../utils/image';
import { colors, spacing } from '../../theme';
import {
  PROFILE_COLLAPSE_DISTANCE,
  PROFILE_WAVE_MAX,
} from './ProfileCollapsingHeader';

export const PROFILE_FIXED_BAR_BODY = 28;

interface ProfileHeaderChromeProps {
  topInset: number;
  scrollY: Animated.Value;
  onBack: () => void;
  rightIcon: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  /** Optional icon shown to the left of the primary right action (e.g. edit next to share) */
  secondaryRightIcon?: keyof typeof Ionicons.glyphMap;
  onSecondaryRightPress?: () => void;
  /** Public cover URL; null/undefined → Mawahib pink fallback (no fake image file). */
  coverUrl?: string | null;
}

/** One continuous header: fixed top chrome + collapsing cover/wave. */
export default function ProfileHeaderChrome({
  topInset,
  scrollY,
  onBack,
  rightIcon,
  onRightPress,
  secondaryRightIcon,
  onSecondaryRightPress,
  coverUrl,
}: ProfileHeaderChromeProps) {
  const barTop = Math.max(topInset - 6, 0);
  const fixedBarHeight = barTop + PROFILE_FIXED_BAR_BODY;
  const coverTotal = fixedBarHeight + PROFILE_WAVE_MAX;
  const hasCover = Boolean(coverUrl?.trim());

  const waveHeight = scrollY.interpolate({
    inputRange: [0, PROFILE_COLLAPSE_DISTANCE],
    outputRange: [PROFILE_WAVE_MAX, 0],
    extrapolate: 'clamp',
  });

  const renderCoverImage = (shiftTop = 0) =>
    hasCover ? (
      <Image
        source={toImageSource(coverUrl!.trim())}
        style={{ width: '100%', height: coverTotal, marginTop: shiftTop }}
        contentFit="cover"
        transition={200}
      />
    ) : null;

  return (
    <>
      <View
        style={[
          styles.fixedBar,
          {
            paddingTop: barTop,
            height: fixedBarHeight,
            backgroundColor: hasCover ? 'transparent' : colors.primary,
          },
        ]}
      >
        {hasCover ? (
          <View style={[styles.coverClip, StyleSheet.absoluteFill]} pointerEvents="none">
            {renderCoverImage(0)}
          </View>
        ) : null}
        <TouchableOpacity style={styles.navBtn} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name={chevronBackIcon()} size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.navSpacer} />
        <View style={styles.rightActions}>
          {secondaryRightIcon ? (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={onSecondaryRightPress}
              activeOpacity={0.85}
            >
              <Ionicons name={secondaryRightIcon} size={18} color={colors.white} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.navBtn} onPress={onRightPress} activeOpacity={0.85}>
            <Ionicons name={rightIcon} size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.wave,
          {
            top: fixedBarHeight - 1,
            height: waveHeight,
            backgroundColor: hasCover ? 'transparent' : colors.primary,
          },
        ]}
      >
        {hasCover ? (
          <View style={styles.coverClip}>{renderCoverImage(-(fixedBarHeight - 1))}</View>
        ) : null}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fixedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    zIndex: 30,
    overflow: 'hidden',
  },
  coverClip: {
    overflow: 'hidden',
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  navSpacer: {
    flex: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  wave: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
});
