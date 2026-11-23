import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CustomTabBar from '../components/layout/CustomTabBar';
import CreateTabPlaceholder from '../screens/create/CreateTabPlaceholder';
import GuestHomeScreen from '../screens/guest/GuestHomeScreen';
import GuestExploreScreen from '../screens/guest/GuestExploreScreen';
import GuestCreateMenu from '../components/layout/GuestCreateMenu';
import { CreateMenuProvider } from '../context/CreateMenuContext';
import { useAuthGate } from '../context/AuthGateContext';
import { GuestTabParamList } from './types';
import { t } from '../i18n/runtime';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<GuestTabParamList>();

function preventTabPress() {
  return {
    tabPress: (e: { preventDefault: () => void }) => {
      e.preventDefault();
    },
  };
}

export default function GuestTabs() {
  const { requireAuth } = useAuthGate();

  return (
    <CreateMenuProvider>
      <View style={styles.root}>
        <Tab.Navigator
          tabBar={(props) => (
            <CustomTabBar
              {...props}
              showUnreadIndicators={false}
              onGatedTabPress={(name) =>
                requireAuth({
                  action: name === 'MessagesTab' ? 'messages' : 'jobs',
                  route: 'GuestTabs',
                  params: { screen: name },
                })
              }
            />
          )}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: colors.background },
            tabBarStyle: {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
            },
          }}
        >
          <Tab.Screen
            name="HomeTab"
            component={GuestHomeScreen}
            options={{ title: t('tab.home'), tabBarAccessibilityLabel: t('tab.home') }}
          />
          <Tab.Screen
            name="SearchTab"
            component={GuestExploreScreen}
            options={{ title: t('tab.explore'), tabBarAccessibilityLabel: t('tab.explore') }}
          />
          <Tab.Screen
            name="CreateTab"
            component={CreateTabPlaceholder}
            options={{ title: t('tab.create'), tabBarAccessibilityLabel: t('tab.create') }}
            listeners={preventTabPress}
          />
          <Tab.Screen
            name="MessagesTab"
            component={CreateTabPlaceholder}
            options={{
              title: t('tab.messages'),
              tabBarAccessibilityLabel: t('guest.messagesLocked'),
            }}
            listeners={preventTabPress}
          />
          <Tab.Screen
            name="JobsTab"
            component={CreateTabPlaceholder}
            options={{
              title: t('tab.jobs'),
              tabBarAccessibilityLabel: t('guest.jobsLocked'),
            }}
            listeners={preventTabPress}
          />
        </Tab.Navigator>
        <GuestCreateMenu />
      </View>
    </CreateMenuProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
