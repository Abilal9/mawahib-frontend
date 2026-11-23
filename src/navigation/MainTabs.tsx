import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CustomTabBar from '../components/layout/CustomTabBar';
import {
  HomeScreen,
  SearchScreen,
  MessagesInboxScreen,
  JobsScreen,
} from '../screens';
import AppSidebar from '../components/layout/AppSidebar';
import CreateActionMenu from '../components/layout/CreateActionMenu';
import CreateTabPlaceholder from '../screens/create/CreateTabPlaceholder';
import { MainTabParamList } from './types';
import { colors } from '../theme';
import { t } from '../i18n/runtime';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <View style={styles.root}>
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
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
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: t('tab.home'), tabBarAccessibilityLabel: t('tab.home') }} />
      <Tab.Screen name="SearchTab" component={SearchScreen} options={{ title: t('tab.explore'), tabBarAccessibilityLabel: t('tab.explore') }} />
      <Tab.Screen
        name="CreateTab"
        component={CreateTabPlaceholder}
        options={{ title: t('tab.create'), tabBarAccessibilityLabel: t('tab.create') }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
          },
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesInboxScreen}
        options={{ title: t('tab.messages'), tabBarAccessibilityLabel: t('tab.messages') }}
      />
      <Tab.Screen
        name="JobsTab"
        component={JobsScreen}
        options={{ title: t('tab.jobs'), tabBarAccessibilityLabel: t('tab.jobs') }}
      />
    </Tab.Navigator>
    <AppSidebar />
    <CreateActionMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
