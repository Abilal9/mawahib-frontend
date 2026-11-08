export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string | number;
  coverImage?: string;
  bio?: string;
  location?: string;
  /** ISO country code when known (SA | AE). */
  countryCode?: 'SA' | 'AE' | null;
  /** Canonical city/emirate code when known. */
  locationCode?: string | null;
  /** Profile default currency derived from country. */
  defaultCurrency?: 'SAR' | 'AED' | null;
  skills?: string[];
  followers: number;
  /** Active connections from the public profile. Not `followers`. */
  connectionsCount?: number;
  following: number;
  posts: number;
  isVerified?: boolean;
  title?: string;
  rating?: number;
  reviewCount?: number;
  /** Published reviews received in either role, plus the role splits. */
  reviewSummary?: {
    overall: {
      average: number | null;
      count: number;
      stars?: [number, number, number, number, number];
    };
    asProvider: {
      average: number | null;
      count: number;
      stars?: [number, number, number, number, number];
    };
    asClient: {
      average: number | null;
      count: number;
      stars?: [number, number, number, number, number];
    };
  };
  /** talent | business. Present on Explore profiles. */
  accountType?: string;
}

export interface Post {
  id: string;
  author: User;
  caption: string;
  images: string[];
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
  location?: string;
  role?: string;
  timeAgo?: string;
  feedSource?: 'self' | 'connection' | 'discovery';
  relationship?: {
    status: 'self' | 'none' | 'outgoing' | 'incoming' | 'connected';
    connectionRequestId: string | null;
  };
  visibility?: string;
  /** Present when Mawahib hid this post and the viewer is its author. */
  hiddenByMawahib?: boolean;
}


export interface Comment {
  id: string;
  userId: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  /** Server-computed: comment author or post owner. */
  canDelete?: boolean;
  /** Present when Mawahib hid this comment and the viewer wrote it. */
  hiddenByMawahib?: boolean;
}

export interface Story {
  id: string;
  user: User;
  items: StoryItem[];
  seen: boolean;
  isOwn?: boolean;
}

export interface StoryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  duration: number;
}

/**
 * Explore / home job listing (catalog).
 * Prefer JobListing in new code; Job kept as the primary export name.
 */
export interface Job {
  id: string;
  title: string;
  company: string;
  type: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'gig';
  location: string;
  salary: string;
  /** Snapshotted listing currency (SAR | AED). */
  currency?: 'SAR' | 'AED' | null;
  description: string;
  skills: string[];
  /** Canonical category when the listing was linked. Absent on older payloads. */
  categoryId?: string | null;
  categoryName?: string | null;
  customCategory?: string | null;
  taxonomySkills?: { id: string; name: string }[];
  postedAt: string;
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  matchScore?: number;
  logo?: string | number;
  /** Explore filter chip e.g. Tech / Design / Food */
  exploreTag?: string;
  /** Poster verification, when the listing payload includes it. */
  companyVerified?: boolean;
  isSaved?: boolean;
}

/** Alias for catalog Job — distinguishes from UserJob (in-app engagement) */
export type JobListing = Job;

/**
 * Every deal in the marketplace is a work request; a UserJob is the card model
 * for one. See UserJobsContext.
 */
export type {
  UserJob,
  UserJobStatus,
  UserJobDetails,
  UserJobAddon,
  UserJobSection,
  UserJobSource,
} from './userJobs';
export type { JobApplication } from './userJobs';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'job' | 'message' | 'system';
  title?: string;
  user?: User;
  message: string;
  /** Optional tertiary context (e.g. job title) — never message body */
  context?: string;
  createdAt: string;
  read: boolean;
  postId?: string;
  /** Explore / catalog listing id (optional deep link) */
  jobId?: string;
  /** Work request id for Accept / Rate / WorkRequestDetail */
  userJobId?: string;
  conversationId?: string;
  actions?: Array<'accept' | 'decline'>;
  showRating?: boolean;
  /** Backend deep-link payload `{ screen, params }` when present */
  deepLink?: {
    screen?: string;
    params?: Record<string, unknown>;
  };
  /** Raw API notification type (Phase 4) */
  apiType?: string;
  payload?: unknown;
}

/**
 * Explore / home catalog service listing.
 * Distinct from profile ServiceOffering (packages/addons on a user profile).
 */
export interface Service {
  id: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  duration: string;
  category: string | null;
  provider: User;
  rating: number;
  reviewCount: number;
  images: string[];
  priceLabel?: string;
  /** Explore filter chip */
  exploreTag?: string;
  isSaved?: boolean;
}

/** Prefer CatalogService when clarifying vs ServiceOffering */
export type CatalogService = Service;

export type {
  ProfileTab,
  ProfileLanguage,
  ProfileEducation,
  ProfileExperience,
  ProfileCertification,
  PortfolioProject,
  ServicePackage,
  ServiceAddon,
  ServiceOffering,
  ProfileService,
  ProfileContent,
  AboutSectionKey,
} from './profile';

export {
  ABOUT_SECTION_KEYS,
  ABOUT_SECTION_LABELS,
  ABOUT_SECTION_ADD_LABELS,
  isAboutSectionFilled,
  TALENT_CHIP_STYLES,
} from './profile';

export type {
  ReviewItem,
  Review,
  ReviewDistribution,
  ReviewsBundle,
} from './reviews';

export type { ConnectionRelation } from './connections';

export type TalentConnectStatus = 'connect' | 'added' | 'request-sent' | 'incoming';

export interface Talent {
  id: string;
  user: User;
  category: string;
  rating: number;
  hourlyRate: number;
  skills: string[];
  rateLabel?: string;
  reviewCount?: number;
  mutualConnections?: number;
  mutualAvatars?: (string | number)[];
  connectStatus?: TalentConnectStatus;
  /** Explore filter chips that match this talent */
  tags?: string[];
}
