import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  REPORT_REASONS,
  reportCanSend,
  reportResultMessage,
  submitContentReport,
  type ReportReasonId,
} from '../../lib/contentReports';
import { StatusBar } from 'expo-status-bar';
import ScreenContainer from '../../components/ui/ScreenContainer';
import Button from '../../components/ui/Button';
import CalendarPicker from '../../components/ui/CalendarPicker';
import MapsLocationLink from '../../components/job/MapsLocationLink';
import {
  isPastLocalDay,
  startOfLocalDay,
  startOfLocalMonth,
} from '../../utils/calendarDay';
import { formatGregorianLocalDay } from '../../utils/gregorianCivilDate';
import { placeFromLocationNote } from '../../utils/googleMapsLink';
import ActionBusyOverlay from '../../components/ui/ActionBusyOverlay';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';
import MoneyAmountField from '../../components/ui/MoneyAmountField';
import MoneyAmount from '../../components/ui/MoneyAmount';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import DocumentViewerModal, {
  type DocumentViewerSource,
} from '../../components/media/DocumentViewerModal';
import EngagementReviewPrompt from '../../components/job/EngagementReviewPrompt';
import { colors, spacing, radius, typography, fontFamily } from '../../theme';
import {
  normalizeMoneyInputEditing,
  parseMoneyInput,
} from '../../utils/money';
import {
  attachmentIcon,
  WORK_REQUEST_ATTACHMENT_MAX_COUNT,
} from '../../utils/workRequestAttachments';
import { formatBytes } from '../../utils/formatBytes';
import {
  promptPickWorkRequestFile,
  uploadAndAttachFile,
} from '../../lib/workRequestAttachmentUpload';
import { invoicesApi, type ApiInvoice } from '../../services/invoicesApi';
import { ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useMyProfile } from '../../context/ProfileContext';
import { useUserJobs } from '../../context/UserJobsContext';
import { useMarketplaceSuccess } from '../../hooks/useMarketplaceSuccess';
import { openUserProfile } from '../../utils/openUserProfile';
import { openEngagementReview } from '../../utils/openEngagementReview';
import {
  jobsTabForViewer,
  MarketplaceSuccessKey,
} from '../../utils/marketplaceSuccess';
import {
  getNegotiationTurn,
  getWorkRequestOverflowMenu,
  negotiationActionLabel,
  overflowMenuActionLabel,
  type NegotiationAction,
  type OverflowMenuAction,
} from '../../utils/workRequestNegotiation';
import { deliveryAcceptanceCopy, providerDeliveryWaiting, workStatusPresentation } from '../../utils/workStatusPresentation';
import { ScreenProps } from '../../navigation/types';
import {
  ApiWorkRequest,
  DEFAULT_CURRENCY,
  DURATION_UNITS,
  DeadlineType,
  DurationUnit,
  ProposedTermsInput,
  SOURCE_BADGE_LABEL,
  WorkRequestDeadlineInput,
  WorkRequestEvent,
  WorkRequestTerms,
  effectiveTerms,
  formatDeadline,
  formatMoney,
  fromIsoDate,
  summarizeTermsChange,
  termsAddonsSum,
  termsChangeFromPayload,
  termsTotal,
  toIsoDate,
  workRequestApi,
} from '../../services/workRequestApi';
import {
  type ApiEngagement,
  type ApiWorkRequestAttachment,
  marketplaceApi,
} from '../../services/marketplaceApi';
import { messageService } from '../../services/messageService';

const EVENT_LABEL: Record<WorkRequestEvent['type'], string> = {
  created: 'Request Sent',
  changes_requested: 'Changes Requested',
  changes_accepted: 'Changes Accepted',
  changes_declined: 'Changes Declined',
  changes_cancelled: 'Change Request Withdrawn',
  accepted: 'Request Accepted',
  rejected: 'Request Rejected',
  withdrawn: 'Request Cancelled',
  viewed: 'Viewed',
  listing_closed: 'Listing Closed',
  note: 'Note',
};

const DEADLINE_MODES: { id: DeadlineType; label: string }[] = [
  { id: 'exact_date', label: 'Exact' },
  { id: 'date_range', label: 'Range' },
  { id: 'duration', label: 'Duration' },
  { id: 'flexible', label: 'Flexible' },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPickedDate(date: Date) {
  return formatGregorianLocalDay(date);
}

type EngagementEvent = ApiEngagement['events'][number];

/** Real engagement transitions only; delivered → in_progress is a change request. */
function engagementEventLabel(event: EngagementEvent): string {
  if (event.fromStatus === 'delivered' && event.toStatus === 'in_progress') {
    return 'Changes requested';
  }
  if (event.fromStatus === 'disputed' && event.toStatus === 'delivered') {
    return 'Returned for client review';
  }
  if (event.fromStatus === 'disputed' && event.toStatus === 'in_progress') {
    return 'Further work agreed';
  }
  switch (event.toStatus) {
    case 'pending_payment':
      return 'Pending Payment';
    case 'payment_failed':
      return 'Payment Failed';
    case 'in_progress':
      return 'In Progress';
    case 'delivered':
      return 'Delivered';
    case 'disputed':
      return 'Delivery Declined';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Engagement Cancelled';
    case 'declined':
      return 'Engagement Declined';
    default:
      return event.toStatus.replace(/_/g, ' ');
  }
}

/** Request-level `accepted` already covers these two engagement statuses. */
const ENGAGEMENT_EVENTS_SKIPPED = new Set<string>(['requested', 'accepted']);

interface TimelineEntry {
  key: string;
  title: string;
  summary?: string;
  note?: string;
  createdAt: string;
}

function moneyChanged(
  a: WorkRequestTerms['money'],
  b: WorkRequestTerms['money'],
): boolean {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return a.amount !== b.amount || a.currency !== b.currency;
}

function deadlineChanged(
  a: WorkRequestTerms['deadline'],
  b: WorkRequestTerms['deadline'],
): boolean {
  return formatDeadline(a) !== formatDeadline(b);
}

/**
 * Package/base + each add-on + total. A job posting with a single amount shows
 * only the agreed total — no invented package rows.
 */
function PriceBreakdown({
  terms,
  isJobPosting,
}: {
  terms: WorkRequestTerms;
  isJobPosting: boolean;
}) {
  const addons = terms.addons ?? [];
  const total = termsTotal(terms);
  if (!total) return null;
  const hasPackage = !!(terms.packageName || terms.packageTier);
  const singleAmount = isJobPosting && addons.length === 0 && !hasPackage;

  return (
    <>
      <Text style={styles.sectionTitle}>Price breakdown</Text>
      <View style={styles.termsCard}>
        {singleAmount ? (
          <MoneyRow label="Agreed total" money={total} fallback="—" />
        ) : (
          <>
            {terms.money ? (
              <MoneyRow
                label={
                  hasPackage
                    ? `Package · ${terms.packageName || terms.packageTier}`
                    : 'Base price'
                }
                money={terms.money}
                fallback="—"
              />
            ) : null}
            {addons.map((addon) => (
              <MoneyRow
                key={addon.id || addon.title}
                label={`Add-on · ${addon.title}`}
                money={addon.money}
                fallback="—"
              />
            ))}
            <MoneyRow label="Total" money={total} fallback="—" />
          </>
        )}
      </View>
    </>
  );
}

function TermsBlock({
  terms,
  compareWith,
  variant = 'plain',
}: {
  terms: WorkRequestTerms;
  /** When set, price/deadline diffs against this snapshot are highlighted. */
  compareWith?: WorkRequestTerms | null;
  variant?: 'plain' | 'original' | 'proposed';
}) {
  const addons = terms.addons ?? [];
  const total = termsTotal(terms);
  const showTotal =
    addons.length > 0 && !!total && total.amount !== terms.money?.amount;
  const priceDiff = compareWith
    ? moneyChanged(terms.money, compareWith.money)
    : false;
  const deadlineDiff = compareWith
    ? deadlineChanged(terms.deadline, compareWith.deadline)
    : false;
  const priceLabel =
    terms.packageName || terms.packageTier ? 'Package Price' : 'Base Price';
  const deadlineLabel = formatDeadline(terms.deadline);

  return (
    <View
      style={[
        styles.termsCard,
        variant === 'proposed' && styles.proposedTermsCard,
      ]}
    >
      <Row label="Title" value={terms.title || '—'} />
      <MoneyRow
        label={priceLabel}
        money={terms.money}
        fallback="Negotiable"
        struck={variant === 'original' && priceDiff}
        emphasized={variant === 'proposed' && priceDiff}
      />
      {deadlineLabel ? (
        <Row
          label="Deadline"
          value={deadlineLabel}
          struck={variant === 'original' && deadlineDiff}
          emphasized={variant === 'proposed' && deadlineDiff}
        />
      ) : null}
      {terms.packageName || terms.packageTier ? (
        <Row
          label="Package"
          value={terms.packageName || terms.packageTier || ''}
        />
      ) : null}
      {addons.map((addon) => (
        <MoneyRow
          key={addon.id || addon.title}
          label={`Add-on · ${addon.title}`}
          money={addon.money}
          fallback="—"
        />
      ))}
      {showTotal ? (
        <MoneyRow label="Total" money={total} fallback="—" />
      ) : null}
      {terms.location?.trim() ||
      placeFromLocationNote(terms.notes) ||
      terms.mapsUrl ? (
        <MapsLocationLink
          label={terms.location?.trim() || placeFromLocationNote(terms.notes)}
          mapsUrl={terms.mapsUrl}
          query={terms.location?.trim() || placeFromLocationNote(terms.notes)}
        />
      ) : null}
      {terms.scope ? <Block label="Scope" value={terms.scope} /> : null}
      {terms.notes ? <Block label="Notes" value={terms.notes} /> : null}
    </View>
  );
}

function Row({
  label,
  value,
  struck,
  emphasized,
}: {
  label: string;
  value: string;
  struck?: boolean;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          struck && styles.struckValue,
          emphasized && styles.emphasizedValue,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function MoneyRow({
  label,
  money,
  fallback,
  struck,
  emphasized,
}: {
  label: string;
  money: WorkRequestTerms['money'];
  fallback: string;
  struck?: boolean;
  emphasized?: boolean;
}) {
  if (!money || money.amount == null || !Number.isFinite(money.amount)) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{fallback}</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <MoneyAmount
        amount={money.amount}
        currency={money.currency}
        size={14}
        struck={struck}
        emphasized={emphasized}
        style={styles.moneyAmountAlign}
      />
    </View>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.blockValue}>{value}</Text>
    </View>
  );
}

export default function WorkRequestDetailScreen({
  route,
  navigation,
}: ScreenProps<'WorkRequestDetail'>) {
  const { requestId } = route.params;
  const { apiUser } = useAuth();
  const { user: me } = useMyProfile();
  const {
    acceptRequest,
    requestChanges,
    acceptChanges,
    declineChanges,
    cancelChanges,
    rejectRequest,
    withdrawRequest,
    markDelivered,
    markCompleted,
    markDisputed,
    requestEngagementChanges,
    getJobById,
    refresh,
    refreshUnread,
  } = useUserJobs();
  const {
    successVisible,
    successTitle,
    successMessage,
    showSuccess,
    completeSuccess,
  } = useMarketplaceSuccess(navigation, refresh);

  const [request, setRequest] = useState<ApiWorkRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workConversationId, setWorkConversationId] = useState<string | null>(
    null,
  );
  const [attachments, setAttachments] = useState<ApiWorkRequestAttachment[]>(
    [],
  );
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(
    null,
  );
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null);
  const [viewerSource, setViewerSource] =
    useState<DocumentViewerSource | null>(null);
  /** Real engagement_events — drives the timeline and the dispute notice. */
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>(
    [],
  );
  /** Job postings: the listing owner has selected this application. */
  const [applicantSelected, setApplicantSelected] = useState(false);
  const wasBlurred = useRef(false);

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    danger?: boolean;
    commentPlaceholder?: string;
    successKey?: MarketplaceSuccessKey;
    landingOverride?: Parameters<typeof showSuccess>[1];
    run: (comment?: string) => Promise<unknown>;
  } | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonId | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const reportSubmittingRef = useRef(false);
  const [reportSuccessOpen, setReportSuccessOpen] = useState(false);
  const [reportSuccessTitle, setReportSuccessTitle] = useState('Report sent');
  /** Client delivery note sheet: dispute (→ disputed) or request changes (→ in_progress). */
  const [deliveryNoteMode, setDeliveryNoteMode] = useState<
    'dispute' | 'changes' | null
  >(null);
  const [declineText, setDeclineText] = useState('');
  /** Latest engagement_events.note for delivered → disputed (Marketplace SoT). */
  const [disputeNote, setDisputeNote] = useState<string | null>(null);
  const [disputeAt, setDisputeAt] = useState<string | null>(null);

  const [changesOpen, setChangesOpen] = useState(false);
  const [deadlineMode, setDeadlineMode] = useState<DeadlineType>('exact_date');
  /** A request with no deadline stays that way until the editor chooses one. */
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfLocalMonth(new Date()),
  );
  const [exactDate, setExactDate] = useState<Date | null>(null);
  const [rangeFrom, setRangeFrom] = useState<Date | null>(null);
  const [rangeTo, setRangeTo] = useState<Date | null>(null);
  const [activeRangeField, setActiveRangeField] = useState<'from' | 'to'>(
    'from',
  );
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('weeks');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [proposalComment, setProposalComment] = useState('');

  /**
   * `silent` refreshes in place (no spinner, keeps current data on failure) —
   * used when returning from payment / attachment flows.
   */
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
      setDisputeNote(null);
      setDisputeAt(null);
      setEngagementEvents([]);
    }
    try {
      const fetched = await workRequestApi.get(requestId);
      setRequest(fetched);
      // Marking read does not bump updatedAt, so the counterparty is unaffected.
      const viewed = await workRequestApi
        .markViewed(requestId)
        .catch(() => null);
      if (viewed) setRequest(viewed);
      const current = viewed ?? fetched;
      setAttachments(current.attachments ?? []);
      await refreshUnread();

      // Selected comes from the canonical application status on this payload.
      setApplicantSelected(
        current.source === 'job_posting' &&
          current.jobApplicationStatus === 'accepted' &&
          (current.status === 'pending' ||
            current.status === 'changes_requested' ||
            current.status === 'changes_declined'),
      );

      const engagementId =
        viewed?.workEngagementId ?? fetched.workEngagementId;
      const engagementStatus =
        viewed?.workEngagementStatus ?? fetched.workEngagementStatus;
      const canOpenWorkChat =
        engagementId &&
        (engagementStatus === 'in_progress' ||
          engagementStatus === 'delivered' ||
          engagementStatus === 'disputed' ||
          engagementStatus === 'completed');
      if (canOpenWorkChat) {
        const workChats = await messageService
          .listConversations('work')
          .catch(() => []);
        const match = messageService.findWorkConversation(
          workChats,
          engagementId,
        );
        setWorkConversationId(match?.id ?? null);
      } else {
        setWorkConversationId(null);
      }

      // Invoices exist once the engagement has been paid.
      if (canOpenWorkChat && engagementId) {
        setInvoices(
          await invoicesApi.listForEngagement(engagementId).catch(() => []),
        );
      } else {
        setInvoices([]);
      }

      // Engagement events feed the timeline (incl. "Changes requested") and the
      // dispute reason; only fetched once an engagement exists.
      if (engagementId) {
        const engagement = await marketplaceApi
          .getEngagement(engagementId)
          .catch(() => null);
        setEngagementEvents(engagement?.events ?? []);
        const lastDispute =
          engagementStatus === 'disputed' && engagement
            ? [...engagement.events]
                .reverse()
                .find((e) => e.toStatus === 'disputed' && e.note?.trim())
            : undefined;
        setDisputeNote(lastDispute ? lastDispute.note.trim() : null);
        setDisputeAt(lastDispute ? lastDispute.createdAt : null);
      } else {
        setEngagementEvents([]);
        setDisputeNote(null);
        setDisputeAt(null);
      }
    } catch (e) {
      if (!silent) {
        setError(
          e instanceof ApiError ? e.message : 'Failed to load this request',
        );
        setRequest(null);
        setWorkConversationId(null);
        setDisputeNote(null);
        setDisputeAt(null);
        setAttachments([]);
        setInvoices([]);
        setEngagementEvents([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
    },
    [requestId, refreshUnread],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Returning from the payment screens (or any pushed screen): refresh in place.
  useEffect(() => {
    const unsubBlur = navigation.addListener('blur', () => {
      wasBlurred.current = true;
    });
    const unsubFocus = navigation.addListener('focus', () => {
      if (!wasBlurred.current) return;
      wasBlurred.current = false;
      void load({ silent: true });
    });
    return () => {
      unsubBlur();
      unsubFocus();
    };
  }, [navigation, load]);

  const terms = useMemo(
    () => (request ? effectiveTerms(request) : null),
    [request],
  );

  /**
   * `successKey` marks the actions that leave this screen after Done: they
   * confirm and hand off to the Jobs inbox instead of refreshing this screen.
   */
  const runAction = async (
    action: (comment?: string) => Promise<unknown>,
    successKey?: MarketplaceSuccessKey,
    landingOverride?: Parameters<typeof showSuccess>[1],
    comment?: string,
  ) => {
    setBusy(true);
    try {
      await action(comment);
      if (successKey) {
        showSuccess(successKey, landingOverride);
        return;
      }
      const fresh = await workRequestApi.get(requestId);
      setRequest(fresh);
      await refreshUnread();
    } catch (e) {
      Alert.alert(
        'Could not update request',
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!request || !terms) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <Text style={styles.missingText}>{error || 'Request not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const viewerId = apiUser?.id ?? me.id;
  const isSender = request.senderUserId === viewerId;
  const isRecipient = request.recipientUserId === viewerId;
  const isClient = request.clientUserId === viewerId;
  const isProvider = request.providerUserId === viewerId;
  const presentation = workStatusPresentation({
    requestStatus: request.status,
    engagementStatus: request.workEngagementStatus,
    applicationStatus: request.jobApplicationStatus,
  });
  const tone = presentation.tone;

  const turn = getNegotiationTurn(request, viewerId, { applicantSelected });
  const overflow = getWorkRequestOverflowMenu(request, viewerId);
  const isPendingPayment = presentation.showPay;
  const canDeliver = isProvider && presentation.showDeliver;
  const canConfirmDelivery = isClient && presentation.showConfirm;
  const canDeclineDelivery = isClient && presentation.showDecline;
  const isCompletedEngagement = request.workEngagementStatus === 'completed';
  const canMessageWork =
    !!request.workEngagementId &&
    (request.workEngagementStatus === 'in_progress' ||
      request.workEngagementStatus === 'delivered' ||
      request.workEngagementStatus === 'disputed' ||
      request.workEngagementStatus === 'completed');
  const deliveryWaitingMessage = isProvider
    ? providerDeliveryWaiting(request.workEngagementStatus)
    : null;
  /** Pay Now: the client, while the engagement waits for money. */
  const canPay =
    isPendingPayment && isClient && !!request.workEngagementId;
  const attachmentsLocked =
    request.workEngagementStatus === 'delivered' ||
    request.workEngagementStatus === 'disputed' ||
    request.workEngagementStatus === 'completed';
  const requestOpenForAttachmentEdits =
    !attachmentsLocked &&
    (request.status === 'pending' ||
      request.status === 'changes_requested' ||
      request.status === 'changes_declined' ||
      request.status === 'pending_payment');
  const canAddAttachments =
    (isSender || isRecipient) && requestOpenForAttachmentEdits;
  const canRemoveAttachment = (file: ApiWorkRequestAttachment) =>
    requestOpenForAttachmentEdits && file.uploadedByUserId === viewerId;

  // Chronological, real events only: request negotiation + engagement transitions.
  const timelineEntries: TimelineEntry[] = [
    ...request.events.map((event): TimelineEntry => {
      const change =
        event.type === 'changes_requested' ||
        event.type === 'changes_declined' ||
        event.type === 'changes_cancelled'
          ? termsChangeFromPayload(event.payload)
          : null;
      // Cancelled proposals: show the event, not the term diff.
      const summary =
        change && event.type !== 'changes_cancelled'
          ? summarizeTermsChange(change)
          : '';
      return {
        key: `req-${event.id}`,
        title: EVENT_LABEL[event.type] ?? event.type,
        summary: summary || undefined,
        note: event.note || undefined,
        createdAt: event.createdAt,
      };
    }),
    ...engagementEvents
      .filter((e) => !ENGAGEMENT_EVENTS_SKIPPED.has(e.toStatus))
      .map(
        (event): TimelineEntry => ({
          key: `eng-${event.id}`,
          title: engagementEventLabel(event),
          note: event.note?.trim() || undefined,
          createdAt: event.createdAt,
        }),
      ),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const lastEngagementEvent =
    engagementEvents.length > 0
      ? engagementEvents[engagementEvents.length - 1]
      : null;
  const pendingChangesNote =
    request.workEngagementStatus === 'in_progress' &&
    lastEngagementEvent?.fromStatus === 'delivered' &&
    lastEngagementEvent.toStatus === 'in_progress'
      ? lastEngagementEvent
      : null;
  const reviewJob = getJobById(request.id);
  const paymentWaitingMessage =
    isPendingPayment && !isClient
      ? 'Waiting for the client to complete payment.'
      : null;
  const ownerSelectedNotice =
    request.source === 'job_posting' &&
    isRecipient &&
    applicantSelected &&
    (request.status === 'pending' || request.status === 'changes_declined');
  const documentedInvoices = invoices.filter((inv) => inv.hasDocument);
  const jobsTab = jobsTabForViewer(isSender);

  const openWorkChat = () => {
    if (workConversationId) {
      navigation.navigate('Chat', { conversationId: workConversationId });
      return;
    }
    Alert.alert(
      'Chat not ready',
      'The work conversation is not available yet. Try again in a moment.',
    );
  };

  const openPayment = () => {
    if (!request.workEngagementId) return;
    navigation.navigate('ConfirmPayment', {
      engagementId: request.workEngagementId,
      requestId: request.id,
    });
  };

  const openAttachment = (attachment: ApiWorkRequestAttachment) => {
    if (openingAttachmentId) return;
    void (async () => {
      setOpeningAttachmentId(attachment.id);
      try {
        const { url, originalFileName, mimeType } =
          await marketplaceApi.getWorkRequestAttachmentUrl(
            request.id,
            attachment.id,
          );
        setViewerSource({
          title: originalFileName || attachment.originalFileName,
          uri: url,
          mimeType: mimeType || attachment.mimeType,
        });
      } catch (e) {
        Alert.alert(
          'Could not open file',
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Please try again.',
        );
      } finally {
        setOpeningAttachmentId(null);
      }
    })();
  };

  const addAttachment = () => {
    if (uploadingAttachment || busy) return;
    if (attachments.length >= WORK_REQUEST_ATTACHMENT_MAX_COUNT) {
      Alert.alert(
        'Too many files',
        `A request can have up to ${WORK_REQUEST_ATTACHMENT_MAX_COUNT} files.`,
      );
      return;
    }
    void (async () => {
      const picked = await promptPickWorkRequestFile();
      if (!picked) return;
      if ('error' in picked) {
        Alert.alert('Could not attach file', picked.error);
        return;
      }
      setUploadingAttachment(true);
      try {
        const created = await uploadAndAttachFile(request.id, picked.file);
        setAttachments((prev) => [...prev, created]);
      } catch (e) {
        Alert.alert(
          'Could not attach file',
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Please try again.',
        );
      } finally {
        setUploadingAttachment(false);
      }
    })();
  };

  const queueRemoveAttachment = (file: ApiWorkRequestAttachment) => {
    setConfirm({
      title: 'Remove attachment?',
      message: `Are you sure you want to remove "${file.originalFileName}"?`,
      confirmLabel: 'Remove',
      danger: true,
      run: async () => {
        await marketplaceApi.deleteWorkRequestAttachment(request.id, file.id);
        setAttachments((prev) => prev.filter((a) => a.id !== file.id));
        try {
          setAttachments(
            await marketplaceApi.listWorkRequestAttachments(request.id),
          );
        } catch {
          // The local removal above already reflects the delete.
        }
      },
    });
  };

  const openInvoice = (invoice: ApiInvoice) => {
    if (openingInvoiceId) return;
    void (async () => {
      setOpeningInvoiceId(invoice.id);
      try {
        const doc = await invoicesApi.getDocument(invoice.id);
        setViewerSource({
          title: doc.originalFileName || invoice.invoiceNumber,
          uri: doc.url,
          mimeType: doc.mimeType || 'application/pdf',
        });
      } catch (e) {
        Alert.alert(
          'Could not open invoice',
          e instanceof ApiError || e instanceof Error
            ? e.message
            : 'Please try again.',
        );
      } finally {
        setOpeningInvoiceId(null);
      }
    })();
  };

  const openChanges = () => {
    const money = terms.money;
    setAmountText(money ? normalizeMoneyInputEditing(String(money.amount)) : '');
    setCurrency(money?.currency || DEFAULT_CURRENCY);

    setDeadlineTouched(false);
    const deadline = terms.deadline;
    const start =
      deadline?.type === 'exact_date' || deadline?.type === 'date_range'
        ? fromIsoDate(deadline.startDate)
        : null;
    const end =
      deadline?.type === 'date_range' ? fromIsoDate(deadline.endDate) : null;

    setDeadlineMode(deadline?.type ?? 'exact_date');
    setActiveRangeField('from');
    setDurationValue(
      deadline?.type === 'duration' && deadline.durationValue
        ? String(deadline.durationValue)
        : '1',
    );
    setDurationUnit(
      deadline?.type === 'duration' && deadline.durationUnit
        ? deadline.durationUnit
        : 'weeks',
    );
    const futureStart = start && !isPastLocalDay(start) ? start : null;
    setExactDate(deadline?.type === 'exact_date' ? futureStart : null);
    setRangeFrom(deadline?.type === 'date_range' ? futureStart : null);
    setRangeTo(end && !isPastLocalDay(end) ? end : null);
    const anchor = futureStart ?? new Date();
    setVisibleMonth(startOfLocalMonth(anchor));
    setProposalComment('');
    setChangesOpen(true);
  };

  const queueNegotiationAction = (action: NegotiationAction) => {
    switch (action) {
      case 'accept':
      case 'accept_original_terms':
        setConfirm({
          title: `${negotiationActionLabel(action)}?`,
          message:
            'This accepts the current terms and moves the request to Pending Payment.',
          confirmLabel: negotiationActionLabel(action),
          successKey: 'requestAccepted',
          landingOverride: { tab: jobsTab, section: 'pending-payment' },
          run: () => acceptRequest(request.id),
        });
        return;
      case 'accept_changes':
        setConfirm({
          title: 'Accept Changes?',
          message:
            'You agree to the proposed terms. The request will move to Pending Payment.',
          confirmLabel: 'Accept Changes',
          successKey: 'changesAccepted',
          landingOverride: { tab: jobsTab, section: 'pending-payment' },
          run: () => acceptChanges(request.id),
        });
        return;
      case 'request_changes':
      case 'request_changes_again':
        openChanges();
        return;
      case 'decline_changes':
        setConfirm({
          title: 'Decline Changes?',
          message:
            'The request stays open. The other party can Accept Original Terms, Request Changes Again, or Reject Request.',
          confirmLabel: 'Decline Changes',
          commentPlaceholder: 'Optional message…',
          successKey: 'changesDeclined',
          landingOverride: { tab: jobsTab, section: 'requests' },
          run: (comment) => declineChanges(request.id, comment),
        });
        return;
      case 'reject_request':
        setConfirm({
          title: 'Reject Request?',
          message:
            'This permanently closes the work request and moves it to History. It cannot be undone.',
          confirmLabel: 'Reject Request',
          danger: true,
          commentPlaceholder: 'Optional reason…',
          successKey: 'requestRejected',
          landingOverride: {
            tab: jobsTab,
            section: 'completed',
          },
          run: (comment) => rejectRequest(request.id, comment),
        });
        return;
      default:
        return;
    }
  };

  const queueOverflowAction = (action: OverflowMenuAction) => {
    setMenuOpen(false);
    switch (action) {
      case 'withdraw_change_request':
        setConfirm({
          title: 'Withdraw Change Request?',
          message:
            'This will withdraw your proposed changes and restore the previous negotiation state.',
          confirmLabel: 'Withdraw',
          cancelLabel: 'Cancel',
          successKey: 'changesWithdrawn',
          landingOverride: { tab: jobsTab, section: 'requests' },
          run: () => cancelChanges(request.id),
        });
        return;
      case 'cancel_request':
        setConfirm({
          title: 'Cancel Request?',
          message:
            'This will permanently cancel this request and move it to History.',
          confirmLabel: 'Cancel Request',
          cancelLabel: 'Keep Request',
          danger: true,
          successKey: 'requestCancelled',
          landingOverride: {
            tab: 'sent',
            section: 'completed',
          },
          run: () => withdrawRequest(request.id),
        });
        return;
      case 'report':
        setReportReason(null);
        setReportText('');
        setReportNotice(null);
        setReportOpen(true);
        return;
      default:
        return;
    }
  };

  const closeReportSheet = () => {
    if (reportSubmittingRef.current) return;
    setReportOpen(false);
  };

  const submitReport = async () => {
    const description = reportText.trim();
    if (!reportCanSend(reportReason, description) || !reportReason || reportSubmittingRef.current || !request) return;
    reportSubmittingRef.current = true;
    setReportSubmitting(true);
    setReportNotice(null);
    try {
      const result = await submitContentReport({
        targetType: 'work_request',
        targetId: request.id,
        reason: reportReason,
        details: description,
      });
      const message = reportResultMessage(result);
      if (message.confirmed || result.outcome === 'unavailable') {
        setReportOpen(false);
        setReportReason(null);
        setReportText('');
        setReportSuccessTitle(message.title);
        setReportNotice(message.message);
        setReportSuccessOpen(true);
      } else {
        setReportNotice(message.message);
      }
    } finally {
      reportSubmittingRef.current = false;
      setReportSubmitting(false);
    }
  };

  const submitDeliveryNote = () => {
    const mode = deliveryNoteMode;
    const explanation = declineText.trim();
    if (!mode) return;
    if (!explanation) {
      Alert.alert(
        mode === 'changes' ? 'Note required' : 'Explanation required',
        mode === 'changes'
          ? 'Please describe what needs to change.'
          : 'Please describe the issue.',
      );
      return;
    }
    if (!request.workEngagementId || busy) return;
    const engagementId = request.workEngagementId;
    setDeliveryNoteMode(null);
    setDeclineText('');
    if (mode === 'changes') {
      void runAction(
        () => requestEngagementChanges(engagementId, explanation),
        'jobChangesRequested',
        { tab: jobsTab, section: 'in-progress' },
      );
      return;
    }
    void runAction(
      () => markDisputed(engagementId, explanation),
      'jobDisputed',
      { tab: jobsTab, section: 'in-progress' },
    );
  };

  const primaryNegotiation = turn.actions[0] ?? null;
  const secondaryNegotiation = turn.actions.slice(1);

  const openConfirmDelivery = () => {
    const copy = deliveryAcceptanceCopy(request.workEngagementStatus);
    setConfirm({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirmLabel,
      successKey: 'jobCompleted',
      landingOverride: {
        tab: jobsTab,
        section: 'completed',
      },
      run: () => markCompleted(request.workEngagementId!),
    });
  };

  /** The one call to action; everything else lives in the secondary row. */
  const primaryAction: {
    title: string;
    onPress: () => void;
  } | null = primaryNegotiation
    ? {
        title: negotiationActionLabel(primaryNegotiation),
        onPress: () => queueNegotiationAction(primaryNegotiation),
      }
    : canPay
      ? { title: 'Pay Now', onPress: openPayment }
      : canDeliver
      ? {
          title: 'Mark as Delivered',
          onPress: () =>
            setConfirm({
              title: 'Mark as Delivered?',
              message:
                'Confirm that you have delivered the work. The client can then Confirm Delivery or Decline.',
              confirmLabel: 'Mark as Delivered',
              successKey: 'jobDelivered',
              landingOverride: {
                tab: jobsTab,
                section: 'in-progress',
              },
              run: () => markDelivered(request.workEngagementId!),
            }),
        }
      : canConfirmDelivery
        ? {
            title: deliveryAcceptanceCopy(request.workEngagementStatus).button,
            onPress: openConfirmDelivery,
          }
        : null;

  const hasSecondaryActions =
    secondaryNegotiation.length > 0 || canDeclineDelivery;
  const waitingMessage =
    turn.waitingMessage ?? paymentWaitingMessage ?? deliveryWaitingMessage;
  const hasFooterActions =
    !!primaryAction ||
    hasSecondaryActions ||
    !!waitingMessage ||
    isCompletedEngagement ||
    canMessageWork ||
    canPay;

  /** Switching mode drops the previous mode. Coming back starts clean. */
  const chooseDeadlineMode = (mode: DeadlineType) => {
    if (mode === deadlineMode) return;
    setDeadlineTouched(true);
    setDeadlineMode(mode);
    setExactDate(null);
    setRangeFrom(null);
    setRangeTo(null);
    setActiveRangeField('from');
    setDurationValue('');
    setDurationUnit('days');
    setVisibleMonth(startOfLocalMonth(new Date()));
  };

  /**
   * Exact mode picks a single day. Range mode fills `from` then `to`.
   * A day before the start is not selectable.
   */
  const onPickDay = (picked: Date) => {
    setDeadlineTouched(true);
    if (deadlineMode === 'exact_date') {
      setExactDate(picked);
      return;
    }
    if (activeRangeField === 'from' || !rangeFrom) {
      setRangeFrom(picked);
      setRangeTo(null);
      setActiveRangeField('to');
      return;
    }
    if (startOfLocalDay(picked).getTime() < startOfLocalDay(rangeFrom).getTime()) {
      return;
    }
    setRangeTo(picked);
  };

  const proposedDeadline = (): WorkRequestDeadlineInput | null => {
    if (deadlineMode === 'exact_date') {
      return exactDate ? { type: 'exact_date', startDate: toIsoDate(exactDate) } : null;
    }
    if (deadlineMode === 'date_range') {
      if (!rangeFrom || !rangeTo || rangeTo < rangeFrom) return null;
      return {
        type: 'date_range',
        startDate: toIsoDate(rangeFrom),
        endDate: toIsoDate(rangeTo),
      };
    }
    if (deadlineMode === 'duration') {
      const value = Number(durationValue);
      if (!Number.isInteger(value) || value < 1) return null;
      return { type: 'duration', durationValue: value, durationUnit };
    }
    return { type: 'flexible' };
  };

  const proposedAmount = parseMoneyInput(amountText);
  const amountReady = amountText.trim().length === 0 || proposedAmount !== null;
  const proposingDeadline = terms.deadline != null || deadlineTouched;
  const proposedSchedule = proposedDeadline();
  const deadlineReady = !proposingDeadline || proposedSchedule !== null;

  const queueSubmitChanges = () => {
    if (!deadlineReady || !amountReady) return;
    const proposedTerms: ProposedTermsInput = {};
    if (proposingDeadline && proposedSchedule) {
      proposedTerms.deadline = proposedSchedule;
    }
    if (proposedAmount !== null) {
      proposedTerms.money = { amount: proposedAmount, currency };
    }
    const comment = proposalComment.trim() || undefined;
    // Close the changes sheet before opening confirm — nested RN Modals drop
    // the confirm action / payload on later renegotiation attempts.
    setChangesOpen(false);
    setConfirm({
      title: 'Request Changes?',
      message:
        'Your proposed terms will be sent to the other party for review.',
      confirmLabel: 'Send Changes',
      successKey: 'changesRequested',
      landingOverride: { tab: jobsTab, section: 'requests' },
      run: () => requestChanges(request.id, proposedTerms, comment),
    });
  };

  return (
    <ScreenContainer padded={false} backgroundColor={colors.white}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {terms.title || request.title}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.text }]}>
            {presentation.primaryLabel}
          </Text>
        </View>
        {overflow.visible ? (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={styles.menuButton}
            hitSlop={8}
            accessibilityLabel="More actions"
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.menuButton} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>
              {SOURCE_BADGE_LABEL[request.source]}
            </Text>
          </View>
          <Text style={styles.directionText}>
            {isSender ? 'You sent this' : 'Sent to you'}
          </Text>
        </View>
        {presentation.requestLabel || presentation.applicationLabel ? (
          <Text style={styles.directionText}>
            {presentation.requestLabel ? `Request: ${presentation.requestLabel}` : ''}
            {presentation.requestLabel && presentation.applicationLabel ? ' · ' : ''}
            {presentation.applicationLabel ? `Application: ${presentation.applicationLabel}` : ''}
          </Text>
        ) : null}

        <View style={styles.partiesCard}>
          <PartyRow
            label="From"
            name={request.sender.displayName}
            hint={request.senderUserId === viewerId ? 'You' : undefined}
            onPress={() =>
              openUserProfile(navigation, request.senderUserId, me.id)
            }
          />
          <PartyRow
            label="To"
            name={request.recipient.displayName}
            hint={request.recipientUserId === viewerId ? 'You' : undefined}
            onPress={() =>
              openUserProfile(navigation, request.recipientUserId, me.id)
            }
          />
          <View style={styles.rolesRow}>
            <Text style={styles.rolesText}>
              Client:{' '}
              {isClient
                ? 'You'
                : request.clientUserId === request.senderUserId
                  ? request.sender.displayName
                  : request.recipient.displayName}
            </Text>
            <Text style={styles.rolesText}>
              Provider:{' '}
              {isProvider
                ? 'You'
                : request.providerUserId === request.senderUserId
                  ? request.sender.displayName
                  : request.recipient.displayName}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            Requested {formatDateTime(request.createdAt)}
          </Text>
        </View>

        {request.jobListingId ? (
          <TouchableOpacity
            style={styles.listingLink}
            onPress={() =>
              navigation.navigate('JobListingDetail', {
                listingId: request.jobListingId!,
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
            <Text style={styles.listingLinkText}>View job posting</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Original terms</Text>
        <TermsBlock
          terms={request.terms}
          compareWith={
            request.status === 'changes_requested'
              ? request.proposedTerms
              : null
          }
          variant={
            request.status === 'changes_requested' ? 'original' : 'plain'
          }
        />

        {request.status === 'changes_requested' && request.proposedTerms ? (
          <>
            <Text style={styles.sectionTitle}>Proposed terms</Text>
            <TermsBlock
              terms={request.proposedTerms}
              compareWith={request.terms}
              variant="proposed"
            />
            {request.proposalComment ? (
              <View style={styles.commentCard}>
                <Text style={styles.rowLabel}>Comment</Text>
                <Text style={styles.blockValue}>{request.proposalComment}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {request.agreedTerms ? (
          <>
            <Text style={styles.sectionTitle}>Accepted terms</Text>
            <TermsBlock terms={request.agreedTerms} />
          </>
        ) : null}

        <PriceBreakdown
          terms={terms}
          isJobPosting={request.source === 'job_posting'}
        />

        {request.rejectionComment ? (
          <View style={[styles.commentCard, styles.rejectionCard]}>
            <Text style={styles.rowLabel}>Reason</Text>
            <Text style={styles.blockValue}>{request.rejectionComment}</Text>
          </View>
        ) : null}

        {ownerSelectedNotice ? (
          <View style={styles.noticeCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2E6AC5" />
            <Text style={styles.noticeText}>
              You selected this applicant. They need to accept the request
              before it moves to Pending Payment.
            </Text>
          </View>
        ) : null}

        {isPendingPayment ? (
          <View style={styles.noticeCard}>
            <Ionicons name="time-outline" size={18} color="#2E6AC5" />
            <Text style={styles.noticeText}>
              {isClient
                ? 'Pending Payment — complete payment to start the work.'
                : 'Pending Payment — waiting for the client.'}
            </Text>
          </View>
        ) : null}

        {request.status === 'changes_declined' ? (
          <View style={[styles.noticeCard, styles.declineNotice]}>
            <Ionicons name="return-down-back-outline" size={18} color="#C2410C" />
            <Text style={[styles.noticeText, styles.declineNoticeText]}>
              {isRecipient
                ? 'Proposed changes were declined. You can Accept, Request Changes, or Reject Request.'
                : 'You declined the proposed changes. Waiting for the other party to respond.'}
              {(() => {
                const last = [...request.events]
                  .reverse()
                  .find((e) => e.type === 'changes_declined' && e.note);
                return last?.note ? `\n\n“${last.note}”` : '';
              })()}
            </Text>
          </View>
        ) : null}

        {pendingChangesNote ? (
          <View style={[styles.noticeCard, styles.declineNotice]}>
            <Ionicons name="create-outline" size={18} color="#C2410C" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeText, styles.declineNoticeText]}>
                Changes requested
              </Text>
              {pendingChangesNote.note?.trim() ? (
                <Text style={[styles.noticeText, styles.declineNoticeText]}>
                  {'\n'}“{pendingChangesNote.note.trim()}”
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {request.workEngagementStatus === 'disputed' ? (
          <View style={[styles.noticeCard, styles.declineNotice]}>
            <Ionicons name="alert-circle-outline" size={18} color="#C2410C" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeText, styles.declineNoticeText]}>
                Delivery declined
              </Text>
              {disputeNote ? (
                <Text style={[styles.noticeText, styles.declineNoticeText]}>
                  {'\n'}Reason:{'\n'}“{disputeNote}”
                </Text>
              ) : (
                <Text style={[styles.noticeText, styles.declineNoticeText]}>
                  {'\n'}The parties should resolve this through the work
                  conversation.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.termsCard}>
          {timelineEntries.length === 0 ? (
            <Text style={styles.rowValue}>No activity yet.</Text>
          ) : (
            timelineEntries.map((entry) => (
              <View key={entry.key} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{entry.title}</Text>
                  {entry.summary ? (
                    <Text style={styles.eventSummary}>{entry.summary}</Text>
                  ) : null}
                  {entry.note ? (
                    <Text style={styles.eventNote}>{entry.note}</Text>
                  ) : null}
                  <Text style={styles.eventTime}>
                    {formatDateTime(entry.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {attachments.length > 0 || canAddAttachments ? (
          <>
            <View style={styles.attachmentsHeader}>
              <Text style={[styles.sectionTitle, styles.attachmentsTitle]}>
                Supporting documents
              </Text>
              {canAddAttachments ? (
                <TouchableOpacity
                  onPress={addAttachment}
                  disabled={uploadingAttachment || busy}
                  hitSlop={8}
                  accessibilityLabel="Add attachment"
                >
                  <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {attachments.length === 0 ? (
              <Text style={styles.reviewPlaceholder}>
                No files attached. Tap + to add a PDF, JPG or PNG.
              </Text>
            ) : (
              attachments.map((file) => (
                <TouchableOpacity
                  key={file.id}
                  style={styles.attachmentRow}
                  activeOpacity={0.8}
                  disabled={openingAttachmentId !== null}
                  onPress={() => openAttachment(file)}
                >
                  <Ionicons
                    name={attachmentIcon(file.mimeType || file.originalFileName)}
                    size={22}
                    color={colors.primary}
                  />
                  <View style={styles.attachmentMeta}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {file.originalFileName}
                    </Text>
                    <Text style={styles.attachmentSize}>
                      {formatBytes(file.byteSize)}
                    </Text>
                  </View>
                  {openingAttachmentId === file.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.attachmentAction}>Open</Text>
                  )}
                  {canRemoveAttachment(file) ? (
                    <TouchableOpacity
                      hitSlop={8}
                      disabled={busy}
                      accessibilityLabel={`Remove ${file.originalFileName}`}
                      onPress={() => queueRemoveAttachment(file)}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </>
        ) : null}

        {documentedInvoices.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Invoice</Text>
            {documentedInvoices.map((invoice) => (
              <TouchableOpacity
                key={invoice.id}
                style={styles.attachmentRow}
                activeOpacity={0.8}
                disabled={openingInvoiceId !== null}
                onPress={() => openInvoice(invoice)}
              >
                <Ionicons name="receipt-outline" size={22} color={colors.primary} />
                <View style={styles.attachmentMeta}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {invoice.invoiceNumber}
                  </Text>
                  <Text style={styles.attachmentSize}>
                    {invoice.isTestDocument ? 'Test document · ' : ''}
                    {formatMoney({
                      amount: Number(invoice.total),
                      currency: invoice.currency,
                    })}
                  </Text>
                </View>
                {openingInvoiceId === invoice.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.attachmentAction}>View</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {isCompletedEngagement &&
        request.workEngagementId &&
        !!request.reviewState?.eligible ? (
          <View style={styles.reviewCard}>
            <EngagementReviewPrompt
              otherName={request.counterparty?.displayName ?? 'the other party'}
              existingRating={
                request.reviewState?.myReview?.rating ?? reviewJob?.rating
              }
              canSubmit={request.reviewState?.canSubmit}
              windowClosesAt={request.reviewState?.windowClosesAt}
              published={request.reviewState?.published}
              onSelectRating={(rating) =>
                openEngagementReview(navigation, {
                  jobId: request.id,
                  engagementId: request.workEngagementId!,
                  workRequestId: request.id,
                  initialRating: rating,
                })
              }
            />
          </View>
        ) : null}
      </ScrollView>

      {hasFooterActions ? (
        <View style={styles.footer}>
          {waitingMessage ? (
            <View style={styles.waitingCard}>
              <Ionicons
                name="hourglass-outline"
                size={18}
                color={colors.textSecondary}
              />
              <Text style={styles.waitingText}>{waitingMessage}</Text>
            </View>
          ) : null}

          {primaryAction ? (
            <Button
              title={primaryAction.title}
              fullWidth
              disabled={busy}
              onPress={primaryAction.onPress}
            />
          ) : null}

          {hasSecondaryActions ? (
            <View style={styles.secondaryActions}>
              {secondaryNegotiation.map((action) => {
                const label = negotiationActionLabel(action);
                const danger = action === 'reject_request';
                return (
                  <Button
                    key={action}
                    title={label}
                    variant="secondary"
                    style={danger ? styles.rejectHalfBtn : styles.halfBtn}
                    textStyle={
                      danger ? styles.rejectBtnText : styles.requestChangesText
                    }
                    numberOfLines={1}
                    disabled={busy}
                    onPress={() => queueNegotiationAction(action)}
                  />
                );
              })}
              {canDeclineDelivery ? (
                <>
                  <Button
                    title="Request changes"
                    variant="secondary"
                    style={styles.halfBtn}
                    textStyle={styles.requestChangesText}
                    numberOfLines={1}
                    disabled={busy}
                    onPress={() => {
                      setDeclineText('');
                      setDeliveryNoteMode('changes');
                    }}
                  />
                  <Button
                    title="Dispute"
                    variant="secondary"
                    style={styles.halfBtn}
                    textStyle={styles.rejectBtnText}
                    disabled={busy}
                    onPress={() => {
                      setDeclineText('');
                      setDeliveryNoteMode('dispute');
                    }}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {canMessageWork ? (
            <Button
              title={
                request.workEngagementStatus === 'completed'
                  ? 'View work chat'
                  : 'Message'
              }
              fullWidth
              variant={primaryAction ? 'secondary' : 'primary'}
              disabled={busy || !workConversationId}
              onPress={openWorkChat}
            />
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={changesOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setChangesOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setChangesOpen(false)}
        >
          <Pressable
            style={styles.changesSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <ScrollView
              contentContainerStyle={styles.changesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Propose changes</Text>

              <Text style={styles.fieldLabel}>Deadline</Text>
              <View style={styles.modeToggle}>
                {DEADLINE_MODES.map((mode) => {
                  const active = deadlineMode === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[styles.modeBtn, active && styles.modeBtnActive]}
                      onPress={() => chooseDeadlineMode(mode.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.modeBtnText,
                          active && styles.modeBtnTextActive,
                        ]}
                      >
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {deadlineMode === 'exact_date' ? (
                <View style={[styles.dateField, styles.dateFieldActive]}>
                  <Text style={styles.dateFieldValue}>
                    {exactDate ? formatPickedDate(exactDate) : 'Select date'}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
              ) : null}

              {deadlineMode === 'date_range' ? (
                <View style={styles.durationRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateField,
                      styles.durationField,
                      activeRangeField === 'from' && styles.dateFieldActive,
                    ]}
                    onPress={() => setActiveRangeField('from')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.durationFieldInner}>
                      <Text style={styles.durationLabel}>From</Text>
                      <Text style={styles.dateFieldValue}>
                        {rangeFrom ? formatPickedDate(rangeFrom) : 'Select'}
                      </Text>
                    </View>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateField,
                      styles.durationField,
                      activeRangeField === 'to' && styles.dateFieldActive,
                    ]}
                    onPress={() => setActiveRangeField('to')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.durationFieldInner}>
                      <Text style={styles.durationLabel}>To</Text>
                      <Text style={styles.dateFieldValue}>
                        {rangeTo ? formatPickedDate(rangeTo) : 'Select'}
                      </Text>
                    </View>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              {deadlineMode === 'exact_date' || deadlineMode === 'date_range' ? (
                <CalendarPicker
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  onPickDay={onPickDay}
                  mode={deadlineMode === 'date_range' ? 'range' : 'single'}
                  selected={exactDate}
                  rangeStart={rangeFrom}
                  rangeEnd={rangeTo}
                  notBefore={
                    deadlineMode === 'date_range' &&
                    activeRangeField === 'to' &&
                    rangeFrom
                      ? rangeFrom
                      : null
                  }
                />
              ) : null}

              {deadlineMode === 'duration' ? (
                <View style={styles.durationRow}>
                  <TextInput
                    placeholder="1"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.singleLineInput, styles.durationValueInput]}
                    keyboardType="number-pad"
                    value={durationValue}
                    onChangeText={(text) =>
                      setDurationValue(text.replace(/[^\d]/g, '').slice(0, 4))
                    }
                  />
                  <View style={styles.unitToggle}>
                    {DURATION_UNITS.map((unit) => {
                      const active = durationUnit === unit;
                      return (
                        <TouchableOpacity
                          key={unit}
                          style={[styles.modeBtn, active && styles.modeBtnActive]}
                          onPress={() => setDurationUnit(unit)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.modeBtnText,
                              active && styles.modeBtnTextActive,
                            ]}
                          >
                            {unit}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {deadlineMode === 'flexible' ? (
                <Text style={styles.hintText}>
                  No fixed deadline — you agree on timing later.
                </Text>
              ) : null}

              <MoneyAmountField
                label="Package / Base Price"
                placeholder="0"
                value={amountText}
                onChangeText={(text) =>
                  setAmountText(normalizeMoneyInputEditing(text))
                }
                currency={
                  (currency as 'SAR' | 'AED' | undefined) ??
                  (terms?.money?.currency as 'SAR' | 'AED' | undefined) ??
                  null
                }
                containerStyle={styles.priceField}
                error={
                  amountText.trim().length > 0 && proposedAmount === null
                    ? 'Enter an amount greater than zero.'
                    : undefined
                }
              />
              {terms ? (
                <View style={styles.currentMoneySummary}>
                  {(() => {
                    const addonsSum = termsAddonsSum(terms);
                    const proposedBase =
                      proposedAmount !== null
                        ? {
                            amount: proposedAmount,
                            currency:
                              currency ||
                              terms.money?.currency ||
                              DEFAULT_CURRENCY,
                          }
                        : terms.money;
                    const previewTotal = termsTotal({
                      money: proposedBase,
                      addons: terms.addons,
                    });
                    return (
                      <>
                        {addonsSum ? (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>
                              Add-ons (unchanged)
                            </Text>
                            <MoneyAmount
                              amount={addonsSum.amount}
                              currency={addonsSum.currency}
                              size={13}
                            />
                          </View>
                        ) : null}
                        {previewTotal ? (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>
                              Total (base + add-ons)
                            </Text>
                            <MoneyAmount
                              amount={previewTotal.amount}
                              currency={previewTotal.currency}
                              size={13}
                              emphasized
                            />
                          </View>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              ) : null}
              {!(amountText.trim().length > 0 && proposedAmount === null) ? (
                <Text style={styles.hintText}>
                  Edits the package/base price only. Add-ons stay attached; total
                  = base + add-ons. Leave blank to keep the current base price.
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Comment (optional)</Text>
              <TextInput
                placeholder="Explain what you changed…"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                multiline
                value={proposalComment}
                onChangeText={setProposalComment}
              />

              <Button
                title="Send Changes"
                fullWidth
                disabled={busy || !deadlineReady || !amountReady}
                onPress={queueSubmitChanges}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={styles.menuSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.menuTitle}>Actions</Text>
            {overflow.items.map((item) => {
              const danger =
                item === 'cancel_request' || item === 'withdraw_change_request';
              return (
                <TouchableOpacity
                  key={item}
                  style={styles.menuItem}
                  disabled={busy}
                  onPress={() => queueOverflowAction(item)}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      danger ? styles.menuItemDanger : null,
                    ]}
                  >
                    {overflowMenuActionLabel(item)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Button
              title="Close"
              variant="secondary"
              fullWidth
              onPress={() => setMenuOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={reportOpen}
        transparent
        animationType="slide"
        onRequestClose={closeReportSheet}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={closeReportSheet}
        >
          <Pressable
            style={styles.reportSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Report Request</Text>
            <Text style={styles.reportDescription}>
              Choose a reason. Add details if you want.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {REPORT_REASONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setReportReason(item.id)}
                  disabled={reportSubmitting}
                  style={{
                    borderWidth: 1,
                    borderColor: reportReason === item.id ? '#E60076' : '#D9E2EC',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              placeholder="Describe what happened..."
              placeholderTextColor={colors.textSecondary}
              style={styles.reportInput}
              multiline
              value={reportText}
              onChangeText={setReportText}
              editable={!reportSubmitting}
            />
            {reportNotice ? <Text style={styles.reportHint}>{reportNotice}</Text> : null}
            <View style={styles.reportActions}>
              <Button
                title="Cancel"
                variant="secondary"
                style={styles.halfBtn}
                disabled={reportSubmitting}
                onPress={closeReportSheet}
              />
              <Button
                title="Send Report"
                style={styles.halfBtn}
                disabled={reportSubmitting || !reportCanSend(reportReason, reportText)}
                onPress={() => void submitReport()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deliveryNoteMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDeliveryNoteMode(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDeliveryNoteMode(null)}
        >
          <Pressable
            style={styles.reportSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>
              {deliveryNoteMode === 'changes'
                ? 'Request changes'
                : 'Dispute Delivery'}
            </Text>
            <Text style={styles.reportDescription}>
              {deliveryNoteMode === 'changes'
                ? 'Tell the provider what to change. The job goes back to In Progress and they can deliver again.'
                : 'Explain what is wrong with the delivery so the provider can address it.'}
            </Text>
            <TextInput
              placeholder={
                deliveryNoteMode === 'changes'
                  ? 'What needs to change...'
                  : 'Describe the issue...'
              }
              placeholderTextColor={colors.textSecondary}
              style={styles.reportInput}
              multiline
              value={declineText}
              onChangeText={setDeclineText}
              editable={!busy}
              maxLength={1000}
            />
            <View style={styles.reportActions}>
              <Button
                title="Cancel"
                variant="secondary"
                style={styles.halfBtn}
                disabled={busy}
                onPress={() => setDeliveryNoteMode(null)}
              />
              <Button
                title="Send"
                style={styles.halfBtn}
                disabled={busy || !declineText.trim()}
                onPress={submitDeliveryNote}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmActionModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        cancelLabel={confirm?.cancelLabel}
        danger={confirm?.danger}
        commentPlaceholder={confirm?.commentPlaceholder}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={(comment) => {
          if (!confirm) return;
          const pending = confirm;
          setConfirm(null);
          void runAction(
            pending.run,
            pending.successKey,
            pending.landingOverride,
            comment,
          );
        }}
      />

      <DocumentViewerModal
        source={viewerSource}
        onClose={() => setViewerSource(null)}
      />

      <ActionBusyOverlay
        visible={busy || uploadingAttachment}
        message={uploadingAttachment ? 'Uploading file…' : 'Updating request…'}
      />

      <SuccessConfirmationModal
        visible={successVisible}
        title={successTitle}
        message={successMessage}
        onDone={() => void completeSuccess()}
      />

      <SuccessConfirmationModal
        visible={reportSuccessOpen}
        title={reportSuccessTitle}
        message={reportNotice ?? 'Mawahib staff can review this report.'}
        onDone={() => setReportSuccessOpen(false)}
      />
    </ScreenContainer>
  );
}

function PartyRow({
  label,
  name,
  hint,
  onPress,
}: {
  label: string;
  name: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.partyValue}>
        <Ionicons
          name="person-circle-outline"
          size={20}
          color={colors.textSecondary}
        />
        <Text style={styles.rowValue}>{hint ? `${name} (${hint})` : name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1 },
  statusPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.button,
  },
  statusPillText: { ...typography.caption, fontWeight: '500' },
  menuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  menuTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  menuItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemText: { ...typography.body, color: colors.text, fontWeight: '600' },
  menuItemDanger: { color: colors.error },
  reportSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    maxHeight: '88%',
  },
  reportDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reportBeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reportBetaMark: {
    ...typography.bodySmall,
    fontFamily: fontFamily.semiBold,
    color: colors.text,
  },
  reportInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    ...typography.bodySmall,
    color: colors.text,
    textAlignVertical: 'top',
  },
  reportHint: { ...typography.caption, color: colors.error },
  reportActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: '#EEF2F6',
  },
  sourceBadgeText: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  directionText: { ...typography.caption, color: colors.textSecondary },
  partiesCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rolesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rolesText: { ...typography.caption, color: colors.textSecondary },
  timestamp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  listingLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  termsCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  proposedTermsCard: {
    borderColor: colors.primaryLight,
    borderWidth: 1.5,
    backgroundColor: colors.primary + '06',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 26,
  },
  rowLabel: { ...typography.caption, color: colors.textSecondary },
  rowValue: {
    ...typography.bodySmall,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  struckValue: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  emphasizedValue: {
    color: colors.primary,
    fontWeight: '700',
  },
  partyValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  block: { gap: 2, paddingTop: spacing.xs },
  blockValue: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  commentCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 2,
  },
  rejectionCard: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#E0ECFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  declineNotice: { backgroundColor: '#FFEDD5' },
  noticeText: { ...typography.bodySmall, color: '#2E6AC5', flex: 1, lineHeight: 20 },
  declineNoticeText: { color: '#9A3412' },
  reviewCard: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitleInline: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 0,
  },
  reviewPlaceholder: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  reviewHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.button,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  attachmentMeta: { flex: 1 },
  attachmentName: { ...typography.label, color: colors.text },
  attachmentSize: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  attachmentsTitle: { marginTop: 0, marginBottom: 0 },
  attachmentAction: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  eventRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  eventBody: { flex: 1, gap: 1 },
  eventTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  eventSummary: { ...typography.caption, color: colors.text },
  eventNote: { ...typography.caption, color: colors.textSecondary },
  eventTime: { ...typography.caption, color: colors.textSecondary },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  waitingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  halfBtn: { flex: 1, paddingHorizontal: spacing.md },
  requestChangesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rejectHalfBtn: {
    flex: 1,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.error + '18',
  },
  rejectBtnText: {
    color: colors.error,
    fontWeight: '600',
  },
  footerHint: { ...typography.caption, color: colors.textSecondary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  changesSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  changesContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  modalHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textSecondary },
  hintText: { ...typography.caption, color: colors.textTertiary },
  priceField: { marginBottom: spacing.sm },
  currentMoneySummary: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  moneyAmountAlign: {
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  summaryValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: radius.button,
    padding: 2,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.button - 2,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeBtnTextActive: { color: colors.white },
  dateField: {
    minHeight: 42,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
  },
  dateFieldActive: { borderColor: colors.primary },
  dateFieldValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
  },
  durationRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  durationField: { flex: 1 },
  durationFieldInner: { flex: 1, gap: 1 },
  durationLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  durationValueInput: { width: 72, textAlign: 'center' },
  unitToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: radius.button,
    padding: 2,
  },
  singleLineInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 42,
    ...typography.bodySmall,
    color: colors.text,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    padding: spacing.md,
    textAlignVertical: 'top',
    ...typography.bodySmall,
    color: colors.text,
  },
  dangerBtn: { backgroundColor: colors.error },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  missingText: { ...typography.body, color: colors.text, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  retryText: { ...typography.button, color: colors.white },
  linkText: { ...typography.bodySmall, color: colors.primary },
});
