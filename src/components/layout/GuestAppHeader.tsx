import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import GuestAccountEntry from './GuestAccountEntry';

const LOGO_LAYOUT = 56;
const LOGO_DRAW = 112;
const SIDE_ICON_SIZE = 32;

/**
 * Signed-out chrome: logo only. No inbox bell, unread badges, messages
 * shortcut, or signed-in avatar menu.
 */
export default function GuestAppHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.sideSlot} />
        <View style={styles.centerSlot}>
          <Image
            source={require('../../../assets/images/arabic-emblem.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <View style={[styles.sideSlot, styles.rightSlot]}>
          <GuestAccountEntry />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  sideSlot: {
    flex: 1,
    height: SIDE_ICON_SIZE,
  },
  rightSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  centerSlot: {
    width: LOGO_LAYOUT,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    width: LOGO_DRAW,
    height: LOGO_DRAW,
  },
});
