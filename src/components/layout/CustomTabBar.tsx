import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../theme';
import { useCreateMenu } from '../../context/CreateMenuContext';
import { useMessagingUnread } from '../../context/MessagingUnreadContext';
import { useUserJobs } from '../../context/UserJobsContext';

type TabIconName = keyof typeof Ionicons.glyphMap;

const ICON_SIZE = 24;
const CREATE_ICON_SIZE = 28;

/** Floating tab-bar content height. The bar is absolutely positioned over each tab scene. */
export const TAB_BAR_HEIGHT = 60;
/** Matches the bar's minimum bottom padding when the device safe area is smaller. */
export const TAB_BAR_MIN_BOTTOM_INSET = 10;

/** Distance from the physical screen bottom to the top of the floating tab bar. */
export function tabBarOverlayHeight(safeBottom: number) {
  return TAB_BAR_HEIGHT + Math.max(safeBottom, TAB_BAR_MIN_BOTTOM_INSET);
}

/**
 * List padding that clears the floating tab bar.
 * Use this when the screen already applies the safe-area bottom inset,
 * as ScreenContainer does. `gap` is the breathing room above the bar.
 */
export function listPaddingAboveTabBar(safeBottom: number, gap: number) {
  return tabBarOverlayHeight(safeBottom) - safeBottom + gap;
}

const TAB_ICONS: Record<
  string,
  { active: TabIconName; inactive: TabIconName }
> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  SearchTab: { active: 'search', inactive: 'search-outline' },
  MessagesTab: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  JobsTab: { active: 'briefcase', inactive: 'briefcase-outline' },
  AccountTab: { active: 'person', inactive: 'person-outline' },
};

type GatedTabName = 'MessagesTab' | 'JobsTab';

type CustomTabBarProps = BottomTabBarProps & {
  /** Guest tabs pass false so unread providers are not required. */
  showUnreadIndicators?: boolean;
  /** Guest Messages/Jobs: open the auth gate without changing the selected tab. */
  onGatedTabPress?: (name: GatedTabName) => void;
};

export default function CustomTabBar({
  showUnreadIndicators = true,
  onGatedTabPress,
  ...props
}: CustomTabBarProps) {
  if (!showUnreadIndicators) {
    return (
      <TabBarBody
        {...props}
        showMessagesDot={false}
        showJobsDot={false}
        onGatedTabPress={onGatedTabPress}
      />
    );
  }
  return <AuthenticatedUnreadTabBar {...props} />;
}

function AuthenticatedUnreadTabBar(props: BottomTabBarProps) {
  const { unreadCount: messagesUnread } = useMessagingUnread();
  const { unread: jobsUnread } = useUserJobs();
  return (
    <TabBarBody
      {...props}
      showMessagesDot={messagesUnread > 0}
      showJobsDot={jobsUnread.sent + jobsUnread.received > 0}
    />
  );
}

function TabBarBody({
  state,
  descriptors,
  navigation,
  showMessagesDot,
  showJobsDot,
  onGatedTabPress,
}: BottomTabBarProps & {
  showMessagesDot: boolean;
  showJobsDot: boolean;
  onGatedTabPress?: (name: GatedTabName) => void;
}) {
  const insets = useSafeAreaInsets();
  const { isOpen: isCreateMenuOpen, toggle: toggleCreateMenu, close: closeCreateMenu } =
    useCreateMenu();
  const bottomPad = Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_INSET);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: bottomPad }]}
    >
      <View style={styles.glassShell}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 55 : 80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheen} pointerEvents="none" />
        <View style={styles.glassBorder} pointerEvents="none" />

        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const isCreate = route.name === 'CreateTab';

            const onPress = () => {
              if (isCreate) {
                toggleCreateMenu();
                return;
              }

              if (
                onGatedTabPress &&
                (route.name === 'MessagesTab' || route.name === 'JobsTab')
              ) {
                onGatedTabPress(route.name);
                return;
              }

              if (isCreateMenuOpen) {
                closeCreateMenu();
              }

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            if (isCreate) {
              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isCreateMenuOpen ? { selected: true } : {}}
                  accessibilityLabel="Create"
                  onPress={onPress}
                  style={styles.tab}
                  activeOpacity={0.85}
                >
                  {isCreateMenuOpen ? (
                    <View style={styles.highlight} pointerEvents="none" />
                  ) : null}
                  <Ionicons
                    name={isCreateMenuOpen ? 'close' : 'add'}
                    size={CREATE_ICON_SIZE}
                    color={isCreateMenuOpen ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              );
            }

            const icons = TAB_ICONS[route.name] ?? {
              active: 'ellipse' as TabIconName,
              inactive: 'ellipse-outline' as TabIconName,
            };

            const showDot =
              (route.name === 'MessagesTab' && showMessagesDot) ||
              (route.name === 'JobsTab' && showJobsDot);

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : { selected: false }}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                style={styles.tab}
                activeOpacity={0.7}
              >
                {isFocused ? <View style={styles.highlight} pointerEvents="none" /> : null}
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={isFocused ? icons.active : icons.inactive}
                    size={ICON_SIZE}
                    color={isFocused ? colors.primary : colors.textSecondary}
                  />
                  {showDot ? <View style={styles.indicatorDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  glassShell: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.28)',
      default: 'rgba(255,255,255,0.72)',
    }),
    ...Platform.select({
      ios: {
        shadowColor: '#0E243A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'transparent',
  },
  glassBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'transparent',
  },
  tab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: ICON_SIZE + 8,
    height: ICON_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Binary unread cue — no count. Same look selected or not. */
  indicatorDot: {
    position: 'absolute',
    top: 0,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  /** Behind the icon only — same slot size active/inactive */
  highlight: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(230, 0, 118, 0.14)',
  },
});
