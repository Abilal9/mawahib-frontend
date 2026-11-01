import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import SplashLoadingDots, {
  splashLoadingDotStyles,
} from '../onboarding/SplashLoadingDots';
import { spacing } from '../../theme';

/**
 * Home placement for Splash 2's loader. The animation itself is SplashLoadingDots.
 * Reduced motion shows the same dots without starting that animation.
 * This component does not fetch data or delay content.
 */
export default function HomeSplashLoader({
  fill = false,
  compact = false,
  accessibilityLabel = 'Loading',
}: {
  fill?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      },
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      pointerEvents="none"
      style={[
        styles.placement,
        fill ? styles.fill : null,
        compact ? styles.compact : null,
      ]}
    >
      {reduceMotion ? <StaticSplashDots /> : <SplashLoadingDots />}
    </View>
  );
}

function StaticSplashDots() {
  return (
    <View style={splashLoadingDotStyles.dotsRow}>
      <View style={splashLoadingDotStyles.dot} />
      <View style={splashLoadingDotStyles.dot} />
      <View style={splashLoadingDotStyles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  placement: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flexGrow: 1,
    alignSelf: 'stretch',
  },
  compact: {
    paddingVertical: spacing.lg,
  },
});
