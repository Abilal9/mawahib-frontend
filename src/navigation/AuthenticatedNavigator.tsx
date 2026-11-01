import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import {
  ChangePasswordScreen,
  ProfileSetupScreen,
  NotificationsScreen,
  PostDetailScreen,
  PostCreateScreen,
  PhotoCaptureScreen,
  PhotoEditScreen,
  VideoEditScreen,
  VideoTrimScreen,
  ChatScreen,
  ConversationMediaScreen,
  ArchivedConversationsScreen,
  ProfileScreen,
  UserProfileScreen,
  EditProfileScreen,
  CoverRepositionScreen,
  EditAboutSectionScreen,
  AddPortfolioProjectScreen,
  AddProfileServiceScreen,
  ManageProfileListScreen,
  PortfolioProjectDetailScreen,
  UserPostsScreen,
  ServiceDetailScreen,
  RequestServiceScreen,
  CalendarScreen,
  ConnectionsScreen,
  SavedScreen,
  ReviewsScreen,
  DocumentationScreen,
  ChangeLanguageScreen,
  SettingsScreen,
  PremiumScreen,
  PostJobScreen,
  WorkRequestDetailScreen,
  DirectRequestScreen,
  WriteReviewScreen,
  JobListingDetailScreen,
  ConfirmPaymentScreen,
  ApplePayScreen,
  CardPaymentScreen,
  StoryViewerScreen,
  FullPhotoPreviewScreen,
} from '../screens';
import { AuthenticatedStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { loadRecoveryState } from '../lib/recoveryState';
import {
  isAuthenticatedProductActive,
  leaveAuthenticatedProduct,
  takeAuthenticatedEntry,
} from '../lib/productTree';
import { mainTabsGateLeaveAction } from '../lib/signedOutBranchEntry';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

function MainTabsGate() {
  const {
    isSignedIn,
    authLoading,
    apiUser,
    recovery,
    mediaCacheReady,
  } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthenticatedStackParamList>>();
  const pendingRef = useRef(takeAuthenticatedEntry());

  const emailOk = Boolean(apiUser?.emailVerified);

  useEffect(() => {
    const action = mainTabsGateLeaveAction({
      authLoading,
      productActive: isAuthenticatedProductActive(),
      recoveryLocked: Boolean(recovery || loadRecoveryState()),
      isSignedIn,
      hasVerifiedProfile: Boolean(apiUser && emailOk),
    });
    if (action === 'SignIn') {
      leaveAuthenticatedProduct({ name: 'SignIn' });
    }
  }, [authLoading, isSignedIn, apiUser, emailOk, recovery]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || pending.length === 0) return;
    const onlyDefaultHome =
      pending.length === 1 &&
      pending[0].name === 'MainTabs' &&
      pending[0].params == null;
    if (onlyDefaultHome) return;
    navigation.reset({
      index: pending.length - 1,
      routes: pending as never,
    });
  }, [navigation]);

  if (
    authLoading ||
    !mediaCacheReady ||
    recovery ||
    loadRecoveryState() ||
    !isSignedIn ||
    !apiUser ||
    !emailOk
  ) {
    return null;
  }
  return <MainTabs />;
}

export default function AuthenticatedNavigator({ userId }: { userId: string }) {
  const screenOptions = {
    headerShown: false,
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor: '#F7F9FB' },
  };

  return (
    <Stack.Navigator
      key={`authenticated-${userId}`}
      initialRouteName="MainTabs"
      screenOptions={screenOptions}
    >
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="MainTabs" component={MainTabsGate} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="CoverReposition" component={CoverRepositionScreen} />
      <Stack.Screen name="EditAboutSection" component={EditAboutSectionScreen} />
      <Stack.Screen name="AddPortfolioProject" component={AddPortfolioProjectScreen} />
      <Stack.Screen name="AddProfileService" component={AddProfileServiceScreen} />
      <Stack.Screen name="ManageProfileList" component={ManageProfileListScreen} />
      <Stack.Screen name="PortfolioProjectDetail" component={PortfolioProjectDetailScreen} />
      <Stack.Screen name="UserPosts" component={UserPostsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="PostCreate" component={PostCreateScreen} />
      <Stack.Screen name="PhotoCapture" component={PhotoCaptureScreen} />
      <Stack.Screen name="PhotoEdit" component={PhotoEditScreen} />
      <Stack.Screen name="VideoEdit" component={VideoEditScreen} />
      <Stack.Screen name="VideoTrim" component={VideoTrimScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen
        name="ConversationMedia"
        component={ConversationMediaScreen}
      />
      <Stack.Screen
        name="ArchivedConversations"
        component={ArchivedConversationsScreen}
      />
      <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
      <Stack.Screen name="RequestService" component={RequestServiceScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="Connections" component={ConnectionsScreen} />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Documentation" component={DocumentationScreen} />
      <Stack.Screen name="ChangeLanguage" component={ChangeLanguageScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="JobListingDetail" component={JobListingDetailScreen} />
      <Stack.Screen name="WorkRequestDetail" component={WorkRequestDetailScreen} />
      <Stack.Screen name="DirectRequest" component={DirectRequestScreen} />
      <Stack.Screen name="WriteReview" component={WriteReviewScreen} />
      <Stack.Screen name="ConfirmPayment" component={ConfirmPaymentScreen} />
      <Stack.Screen name="ApplePay" component={ApplePayScreen} />
      <Stack.Screen name="CardPayment" component={CardPaymentScreen} />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="FullPhotoPreview"
        component={FullPhotoPreviewScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}
