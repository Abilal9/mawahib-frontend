import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Explore tabs — aligns with SearchScreen / explore utils (no legacy all/posts). */
export type SearchContentType = 'talents' | 'jobs' | 'services';

export type JobsTabLanding = {
  /**
   * Explicit landing override (success redirect / deep link).
   * When omitted on focus, Jobs preserves its current tab/section
   * (e.g. Back from a detail screen).
   */
  tab?: 'sent' | 'received';
  /** Horizontal section carousel key inside that tab */
  section?:
    | 'requests'
    | 'pending-payment'
    | 'in-progress'
    | 'completed'
    | 'posted';
};

export type MainTabParamList = {
  HomeTab: undefined;
  SearchTab:
    | {
        contentType?: SearchContentType;
        category?: string;
      }
    | undefined;
  CreateTab: undefined;
  MessagesTab: undefined;
  JobsTab: JobsTabLanding | undefined;
};

/** Guest bottom tabs match auth chrome. Messages/Jobs are gate placeholders. */
export type GuestTabParamList = {
  HomeTab: undefined;
  SearchTab:
    | {
        contentType?: SearchContentType;
      }
    | undefined;
  CreateTab: undefined;
  MessagesTab: undefined;
  JobsTab: undefined;
};

export type SplashStackParamList = {
  Splash1: undefined;
  Splash2: undefined;
};

/**
 * Signed-out product tree. Private route names are intentionally absent.
 * Public detail routes map to Guest-safe containers, not authenticated screens.
 */
export type SignedOutStackParamList = {
  GuestTabs: NavigatorScreenParams<GuestTabParamList> | undefined;
  Welcome: { step?: 1 | 2 | 3 };
  TurnOnNotifications: undefined;
  AccountType: undefined;
  SignIn: { email?: string; notice?: 'password-updated' | 'session-expired' } | undefined;
  ForgotPassword: { email?: string; autoSend?: boolean } | undefined;
  ResetPassword: undefined;
  SignUp: { preserveDraft?: boolean } | undefined;
  VerifyAccount: { email: string; phoneE164: string };
  ConfirmCode: { phone?: string; email?: string };
  SignupSuccess: undefined;
  UserProfile: { userId: string };
  ServiceDetail: { serviceId: string; userId?: string };
  JobListingDetail: { listingId: string };
  PostDetail: { postId: string; focusComments?: boolean; commentId?: string };
  Reviews: { userId?: string; serviceId?: string } | undefined;
  PortfolioProjectDetail: {
    projectId: string;
    userId?: string;
    title?: string;
    description?: string;
    images?: string[];
  };
};

export type RootStackParamList = {
  Splash1: undefined;
  Splash2: undefined;
  GuestTabs: NavigatorScreenParams<GuestTabParamList> | undefined;
  Welcome: { step?: 1 | 2 | 3 };
  TurnOnNotifications: undefined;
  AccountType: undefined;
  SignIn: { email?: string; notice?: 'password-updated' | 'session-expired' } | undefined;
  ForgotPassword: { email?: string; autoSend?: boolean } | undefined;
  ResetPassword: undefined;
  ChangePassword: undefined;
  AccountSuspended: undefined;
  SignUp: { preserveDraft?: boolean } | undefined;
  VerifyAccount: { email: string; phoneE164: string };
  SignupSuccess: undefined;
  Profile: undefined;
  UserProfile: { userId: string };
  EditProfile: { coverDraftUri?: string } | undefined;
  CoverReposition: { uri: string };
  EditAboutSection: {
    section: 'bio' | 'languages' | 'talents' | 'education' | 'experience' | 'certifications';
    /** Structured list edit target. Absent = Add mode. Talents ignore this. */
    itemId?: string;
  };
  AddPortfolioProject: { projectId?: string } | undefined;
  AddProfileService: { serviceId?: string } | undefined;
  ManageProfileList: { type: 'portfolio' | 'services' };
  PortfolioProjectDetail: { projectId: string; userId?: string };
  JobListingDetail: { listingId: string };
  ConfirmCode: { phone?: string; email?: string };
  ProfileSetup: { step?: number };
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Notifications: undefined;
  PostDetail: { postId: string; focusComments?: boolean; commentId?: string };
  UserPosts: { userId?: string } | undefined;
  PostCreate: undefined;
  PhotoCapture: undefined;
  PhotoEdit: { uri?: string };
  VideoEdit: { uri?: string };
  VideoTrim: { uri?: string };
  Chat: { conversationId: string };
  ConversationMedia: { conversationId: string };
  ArchivedConversations: undefined;
  ServiceDetail: { serviceId: string; userId?: string };
  RequestService: {
    userId: string;
    serviceId?: string;
    packageName?: 'Basic' | 'Standard' | 'Premium';
  };
  Calendar: undefined;
  Connections: { userId?: string } | undefined;
  Saved: undefined;
  Reviews: { userId?: string } | undefined;
  Documentation: undefined;
  ChangeLanguage: undefined;
  Settings: undefined;
  Premium: undefined;
  PostJob: { step?: number };
  /** The unified request detail — every inbox row opens here. */
  WorkRequestDetail: { requestId: string };
  DirectRequest: { userId: string };
  WriteReview: {
    jobId: string;
    initialRating?: number;
    engagementId?: string;
    conversationId?: string;
    workRequestId?: string;
  };
  /** Payment summary for an engagement waiting on payment (`pending_payment`). */
  ConfirmPayment: { engagementId: string; requestId?: string };
  ApplePay: { engagementId: string; requestId?: string };
  /** Card entry form. Card data is validated locally and never sent to the API. */
  CardPayment: { engagementId: string; requestId?: string };
  StoryViewer: { storyId: string };
  FullPhotoPreview: { images: string[]; initialIndex?: number };
};

/** Authenticated product tree — current private stack plus MainTabs. */
export type AuthenticatedStackParamList = Omit<
  RootStackParamList,
  | 'Splash1'
  | 'Splash2'
  | 'GuestTabs'
  | 'Welcome'
  | 'TurnOnNotifications'
  | 'AccountType'
  | 'SignIn'
  | 'ForgotPassword'
  | 'ResetPassword'
  | 'SignUp'
  | 'VerifyAccount'
  | 'ConfirmCode'
  | 'SignupSuccess'
  | 'AccountSuspended'
>;

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type SignedOutScreenProps<T extends keyof SignedOutStackParamList> =
  NativeStackScreenProps<SignedOutStackParamList, T>;

export type GuestTabScreenProps<T extends keyof GuestTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<GuestTabParamList, T>,
    NativeStackScreenProps<SignedOutStackParamList>
  >;

export type RootStackScreenProps<T extends keyof RootStackParamList> = ScreenProps<T>;

export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
