import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../../theme';
import { useCreateMenu } from '../../context/CreateMenuContext';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';

type MenuItem = {
  id: 'post' | 'story' | 'job';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  offset: { x: number; y: number };
};

const BASE_ITEMS: MenuItem[] = [
  {
    id: 'post',
    icon: 'images-outline',
    label: 'Post',
    color: colors.primary,
    offset: { x: -118, y: -86 },
  },
  {
    id: 'story',
    icon: 'add-circle-outline',
    label: 'Story',
    color: '#FF6B35',
    offset: { x: 0, y: -112 },
  },
  {
    id: 'job',
    icon: 'briefcase-outline',
    label: 'Job',
    color: '#2CB67D',
    offset: { x: 118, y: -86 },
  },
];

/** Soft account-type emphasis: business fans Job leftmost; talent leads with Post. */
function menuItemsForAccount(accountType: 'talent' | 'business' | null): MenuItem[] {
  const items = BASE_ITEMS;
  if (accountType === 'business') {
    const job = items.find((i) => i.id === 'job')!;
    const rest = items.filter((i) => i.id !== 'job');
    // Reassign fan-out positions: job leftmost for business emphasis
    return [
      { ...job, offset: { x: -118, y: -86 } },
      { ...rest[1], offset: { x: 0, y: -112 } },
      { ...rest[0], offset: { x: 118, y: -86 } },
    ];
  }
  return items;
}

const TAB_BAR_HEIGHT = 60;

export default function CreateActionMenu() {
  const { isOpen, close } = useCreateMenu();
  const { accountType } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const MENU_ITEMS = menuItemsForAccount(accountType);

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(expandAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(expandAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen, fadeAnim, expandAnim]);

  const handleSelect = (item: MenuItem) => {
    close();
    setTimeout(() => {
      if (item.id === 'post') navigation.navigate('PostCreate');
      if (item.id === 'story') navigation.navigate('PhotoCapture');
      if (item.id === 'job') navigation.navigate('PostJob', { step: 1 });
    }, 120);
  };

  const tabBarPadding = Math.max(insets.bottom, 8);
  const tabBarTotalHeight = TAB_BAR_HEIGHT + tabBarPadding;
  const createButtonCenterY = tabBarPadding + TAB_BAR_HEIGHT / 2;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={[styles.dismissArea, { bottom: tabBarTotalHeight }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close create menu"
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.backdropFill, { opacity: fadeAnim }]}
          />
        </Pressable>

        <View
          pointerEvents="box-none"
          style={[
            styles.menuAnchor,
            {
              bottom: createButtonCenterY,
              left: Dimensions.get('window').width / 2,
            },
          ]}
        >
          {MENU_ITEMS.map((item, index) => {
            const translateX = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, item.offset.x],
            });
            const translateY = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, item.offset.y],
            });
            const scale = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 1],
            });
            const itemOpacity = expandAnim.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [0, 0.85, 1],
            });

            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.menuItemWrap,
                  {
                    opacity: Animated.multiply(fadeAnim, itemOpacity),
                    transform: [{ translateX }, { translateY }, { scale }],
                    zIndex: MENU_ITEMS.length - index,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <View
          pointerEvents="box-none"
          style={[styles.tabBarPassThrough, { height: tabBarTotalHeight }]}
        />

        <Pressable
          style={[
            styles.createButtonHitArea,
            {
              bottom: tabBarPadding + TAB_BAR_HEIGHT / 2 - 30,
              left: Dimensions.get('window').width / 2 - 30,
            },
          ]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close create menu"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backdropFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 36, 58, 0.45)',
  },
  tabBarPassThrough: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  createButtonHitArea: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  menuAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingStart: spacing.sm,
    paddingEnd: spacing.lg,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    ...typography.label,
    color: colors.text,
  },
});
