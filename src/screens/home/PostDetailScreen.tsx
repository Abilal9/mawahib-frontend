import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  type ScrollViewInstance,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  Modal,
  Pressable,
  Share,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { toImageSource } from '../../utils/image';
import { Ionicons } from '@expo/vector-icons';
import ContentReportSheet from '../../components/report/ContentReportSheet';
import {
  REPORT_REASONS,
  reportCanSend,
  reportResultMessage,
  submitContentReport,
  type ReportReasonId,
} from '../../lib/contentReports';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import ScreenContainer from '../../components/ui/ScreenContainer';
import UserAvatar from '../../components/ui/UserAvatar';
import Button from '../../components/ui/Button';
import SuccessConfirmationModal from '../../components/ui/SuccessConfirmationModal';
import PostLikesModal from '../../components/ui/PostLikesModal';
import { colors, spacing, radius, typography, fontFamily } from '../../theme';
import { Comment, Post } from '../../data/types';
import { useMyProfile } from '../../context/ProfileContext';
import { usePosts } from '../../context/PostsContext';
import { useSaved } from '../../context/SavedContext';
import BookmarkButton from '../../components/ui/BookmarkButton';
import { openUserProfile } from '../../utils/openUserProfile';
import { ScreenProps } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REPORT_MAX_CHARS = 1000;

export default function PostDetailScreen({
  route,
  navigation,
}: ScreenProps<'PostDetail'>) {
  const {
    posts: feedPosts,
    getPostById,
    fetchPostById,
    getComments,
    addComment,
    deleteComment,
    toggleLike,
    softDelete,
  } = usePosts();
  const saved = useSaved();
  const focusComments = route.params.focusComments === true;
  const postId = route.params.postId;
  const { user, removePostId } = useMyProfile();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const commentsY = useRef(0);
  const [post, setPost] = useState<Post | undefined>(() => getPostById(postId));
  const [loading, setLoading] = useState(!post);
  const [activeImage, setActiveImage] = useState(0);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [commentDeleteTarget, setCommentDeleteTarget] = useState<Comment | null>(
    null,
  );
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [reportTarget, setReportTarget] = useState<Comment | null>(null);
  const [reportReason, setReportReason] = useState<ReportReasonId | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const reportBusyRef = useRef(false);
  const [reportPostOpen, setReportPostOpen] = useState(false);
  const [reportSuccessOpen, setReportSuccessOpen] = useState(false);
  const [reportSuccessTitle, setReportSuccessTitle] = useState('Report sent');
  const [likesOpen, setLikesOpen] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    (async () => {
      const cached = getPostById(postId);
      if (cached) {
        setPost(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      const remote = await fetchPostById(postId);
      if (cancelled) return;
      if (remote) setPost(remote);
      setLoading(false);
      try {
        const list = await getComments(postId);
        if (!cancelled) setComments(list);
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, isFocused, getPostById, fetchPostById, getComments]);

  // Keep engagement in sync with PostsContext (source of truth for like/save/count).
  useEffect(() => {
    const fromFeed = feedPosts.find((p) => p.id === postId);
    if (!fromFeed) return;
    setPost((prev) => {
      if (!prev) return fromFeed;
      if (
        prev.isLiked === fromFeed.isLiked &&
        prev.likes === fromFeed.likes &&
        prev.isSaved === fromFeed.isSaved &&
        prev.comments === fromFeed.comments
      ) {
        return prev;
      }
      return {
        ...prev,
        isLiked: fromFeed.isLiked,
        likes: fromFeed.likes,
        isSaved: fromFeed.isSaved,
        comments: fromFeed.comments,
      };
    });
  }, [feedPosts, postId]);

  useEffect(() => {
    if (!focusComments || !post) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(commentsY.current - 12, 0),
        animated: true,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [focusComments, post]);

  const submitComment = useCallback(async () => {
    const text = comment.trim();
    if (!text || isSubmittingComment || !post) return;
    setIsSubmittingComment(true);
    try {
      const created = await addComment(post.id, text);
      setComments((prev) => {
        if (prev.some((c) => c.id === created.id)) return prev;
        return [...prev, created];
      });
      setComment('');
    } catch (e) {
      Alert.alert(
        'Could not comment',
        e instanceof Error ? e.message : 'Please try again',
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }, [addComment, comment, isSubmittingComment, post]);

  const confirmDeleteComment = useCallback(async () => {
    if (!commentDeleteTarget || !post || isDeletingComment) return;
    const target = commentDeleteTarget;
    setIsDeletingComment(true);
    setComments((prev) => prev.filter((c) => c.id !== target.id));
    setCommentDeleteTarget(null);
    try {
      await deleteComment(post.id, target.id);
    } catch (e) {
      setComments((prev) => {
        if (prev.some((c) => c.id === target.id)) return prev;
        return [...prev, target];
      });
      Alert.alert(
        'Could not delete',
        e instanceof Error ? e.message : 'Please try again',
      );
    } finally {
      setIsDeletingComment(false);
    }
  }, [commentDeleteTarget, deleteComment, isDeletingComment, post]);

  const openCommentReport = useCallback((target: Comment) => {
    setCommentMenuId(null);
    setReportReason(null);
    setReportText('');
    setReportNotice(null);
    setReportTarget(target);
  }, []);

  const closeCommentReport = useCallback(() => {
    if (reportBusyRef.current) return;
    setReportTarget(null);
    setReportReason(null);
    setReportText('');
    setReportNotice(null);
  }, []);

  const submitCommentReport = useCallback(async () => {
    if (reportBusyRef.current || !reportTarget || !post) return;
    const description = reportText.trim();
    if (!reportCanSend(reportReason, description) || !reportReason) return;
    reportBusyRef.current = true;
    setReportBusy(true);
    setReportNotice(null);
    try {
      const result = await submitContentReport({
        targetType: 'post_comment',
        targetId: reportTarget.id,
        reason: reportReason,
        details: description,
      });
      const message = reportResultMessage(result);
      if (message.confirmed || result.outcome === 'unavailable' || result.outcome === 'own') {
        setReportTarget(null);
        setReportReason(null);
        setReportText('');
        setReportSuccessTitle(message.title);
        setReportNotice(message.message);
        setReportSuccessOpen(true);
      } else {
        setReportNotice(message.message);
      }
    } finally {
      reportBusyRef.current = false;
      setReportBusy(false);
    }
  }, [post, reportReason, reportTarget, reportText]);

  if (loading && !post) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!post) {
    return (
      <ScreenContainer>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Post not found</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.missingBack}
          >
            <Text style={styles.missingBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const isOwnPost = post.author.id === user.id;
  const canSubmit = Boolean(comment.trim()) && !isSubmittingComment;
  const menuComment = comments.find((c) => c.id === commentMenuId) ?? null;
  const menuCanDelete = menuComment
    ? Boolean(
        menuComment.canDelete ||
          menuComment.userId === user.id ||
          post.author.id === user.id,
      )
    : false;
  const menuCanReport = menuComment ? menuComment.userId !== user.id : false;
  const reportTextTrimmed = reportText.trim();
  const canSendReport = reportCanSend(reportReason, reportTextTrimmed) && !reportBusy;

  const sharePost = async () => {
    setMenuOpen(false);
    const url = `https://mawahib.app/p/${post.id}`;
    const message = `Check out this post on Mawahib`;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message, url }
          : { message: `${message}\n${url}`, title: 'Mawahib' },
      );
    } catch {
      Alert.alert('Share unavailable', `${message}\n${url}`);
    }
  };

  const confirmDelete = async () => {
    try {
      await softDelete(post.id);
      removePostId(post.id);
      setDeleteOpen(false);
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        'Could not delete',
        e instanceof Error ? e.message : 'Please try again',
      );
    }
  };

  return (
    <ScreenContainer padded={false}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => openUserProfile(navigation, post.author.id, user.id)}
          activeOpacity={0.8}
        >
          <UserAvatar uri={post.author.avatar} size={44} style={styles.avatar} />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{post.author.name}</Text>
            {post.role || post.author.title ? (
              <Text style={styles.authorMeta}>
                {post.role ?? post.author.title}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {post.images.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setActiveImage(index);
            }}
          >
            {post.images.map((img, i) => (
              <Image
                key={i}
                source={toImageSource(img)}
                style={styles.postImage}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        ) : null}

        {post.images.length > 1 ? (
          <View style={styles.dots}>
            {post.images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeImage && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity
              onPress={() => {
                void toggleLike(post.id);
              }}
              style={styles.actionBtn}
            >
              <Ionicons
                name={post.isLiked ? 'heart' : 'heart-outline'}
                size={26}
                color={post.isLiked ? colors.primary : colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                scrollRef.current?.scrollTo({
                  y: Math.max(commentsY.current - 12, 0),
                  animated: true,
                })
              }
            >
              <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => void sharePost()}
            >
              <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <BookmarkButton
            kind="post"
            saved={saved.isSaved('post', post.id, post.isSaved)}
            size={24}
            idleColor={colors.text}
            onPress={() => {
              const shown = saved.isSaved('post', post.id, post.isSaved);
              void saved.setDesired('post', post.id, !shown, post.isSaved);
            }}
          />
        </View>

        {post.likes > 0 ? (
          <TouchableOpacity onPress={() => setLikesOpen(true)} hitSlop={6}>
            <Text style={styles.likes}>{post.likes.toLocaleString()} likes</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.likes}>0 likes</Text>
        )}
        {post.caption ? (
          <Text style={styles.caption}>
            <Text style={styles.captionAuthor}>{post.author.name} </Text>
            {post.caption}
          </Text>
        ) : null}

        <View
          style={styles.commentsSection}
          onLayout={(e) => {
            commentsY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.commentsTitle}>
            Comments{post.comments > 0 ? ` · ${post.comments}` : ''}
          </Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <TouchableOpacity
                onPress={() => openUserProfile(navigation, c.userId, user.id)}
                activeOpacity={0.8}
                hitSlop={4}
              >
                <UserAvatar uri={c.avatar} size={36} style={styles.commentAvatar} />
              </TouchableOpacity>
              <View style={styles.commentBody}>
                <View style={styles.commentHeader}>
                  <TouchableOpacity
                    onPress={() =>
                      openUserProfile(navigation, c.userId, user.id)
                    }
                    activeOpacity={0.8}
                    style={styles.commentUserWrap}
                  >
                    <Text style={styles.commentUser}>{c.user}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommentMenuId(c.id)}
                    hitSlop={8}
                    style={styles.commentMenuBtn}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.commentText}>{c.text}</Text>
                <Text style={styles.commentTime}>{c.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.inputBar}>
        <UserAvatar uri={user.avatar} size={32} style={styles.inputAvatar} />
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={colors.textSecondary}
          value={comment}
          onChangeText={setComment}
          editable={!isSubmittingComment}
        />
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={() => void submitComment()}
        >
          <Text
            style={[
              styles.postComment,
              !canSubmit && styles.postCommentDisabled,
            ]}
          >
            {isSubmittingComment ? 'Posting…' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => void sharePost()}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={22} color={colors.text} />
              <Text style={styles.sheetRowText}>Share</Text>
            </TouchableOpacity>
            {isOwnPost ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.sheetRowText, styles.sheetRowDanger]}>
                  Delete
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => {
                  setMenuOpen(false);
                  setReportPostOpen(true);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="flag-outline" size={22} color={colors.text} />
                <Text style={styles.sheetRowText}>Report post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.sheetRow, styles.sheetCancel]}
              onPress={() => setMenuOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(commentMenuId && menuComment)}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentMenuId(null)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setCommentMenuId(null)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {menuCanDelete ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => {
                  if (!menuComment) return;
                  setCommentMenuId(null);
                  setCommentDeleteTarget(menuComment);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.sheetRowText, styles.sheetRowDanger]}>
                  Delete comment
                </Text>
              </TouchableOpacity>
            ) : null}
            {menuCanReport ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => {
                  if (!menuComment) return;
                  openCommentReport(menuComment);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="flag-outline" size={22} color={colors.text} />
                <Text style={styles.sheetRowText}>Report</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.sheetRow, styles.sheetCancel]}
              onPress={() => setCommentMenuId(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <Pressable
          style={styles.modalBackdropCentered}
          onPress={() => setDeleteOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Delete post?</Text>
            <Text style={styles.modalBody}>
              Are you sure you want to delete this post? This can’t be undone.
            </Text>
            <TouchableOpacity
              style={styles.modalDangerBtn}
              onPress={() => void confirmDelete()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDangerText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setDeleteOpen(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(commentDeleteTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentDeleteTarget(null)}
      >
        <Pressable
          style={styles.modalBackdropCentered}
          onPress={() => setCommentDeleteTarget(null)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Delete comment?</Text>
            <Text style={styles.modalBody}>This comment will be removed.</Text>
            <TouchableOpacity
              style={styles.modalDangerBtn}
              onPress={() => void confirmDeleteComment()}
              activeOpacity={0.85}
              disabled={isDeletingComment}
            >
              <Text style={styles.modalDangerText}>
                {isDeletingComment ? 'Deleting…' : 'Delete'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setCommentDeleteTarget(null)}
              disabled={isDeletingComment}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(reportTarget)}
        transparent
        animationType="slide"
        onRequestClose={closeCommentReport}
      >
        <Pressable style={styles.modalBackdropSheet} onPress={closeCommentReport}>
          <Pressable
            style={styles.reportSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Report comment</Text>
            <Text style={styles.reportDescription}>
              Choose a reason. Add details if you want.
            </Text>
            <View style={styles.reportReasons}>
              {REPORT_REASONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setReportReason(item.id)}
                  disabled={reportBusy}
                  style={[styles.reportReason, reportReason === item.id && styles.reportReasonOn]}
                >
                  <Text style={styles.reportReasonText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textSecondary}
              style={styles.reportInput}
              multiline
              value={reportText}
              onChangeText={setReportText}
              editable={!reportBusy}
              maxLength={REPORT_MAX_CHARS}
            />
            {reportNotice ? <Text style={styles.reportHint}>{reportNotice}</Text> : null}
            <View style={styles.reportActions}>
              <Button
                title="Cancel"
                variant="secondary"
                style={styles.halfBtn}
                disabled={reportBusy}
                onPress={closeCommentReport}
              />
              <Button
                title="Send Report"
                style={styles.halfBtn}
                disabled={!canSendReport}
                onPress={() => void submitCommentReport()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ContentReportSheet
        visible={reportPostOpen}
        title="Report post"
        targetType="post"
        targetId={post.id}
        onClose={() => setReportPostOpen(false)}
      />

      <PostLikesModal
        visible={likesOpen}
        postId={likesOpen ? post.id : null}
        onClose={() => setLikesOpen(false)}
        onOpenProfile={(userId) => openUserProfile(navigation, userId, user.id)}
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  headerRight: { width: 40, alignItems: 'flex-end' },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.screen,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  authorInfo: { flex: 1 },
  authorName: { ...typography.label, color: colors.text },
  authorMeta: { ...typography.caption, color: colors.textSecondary },
  postImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    marginTop: spacing.md,
  },
  actionsLeft: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { padding: 4 },
  likes: {
    ...typography.label,
    color: colors.text,
    paddingHorizontal: spacing.screen,
    marginTop: spacing.sm,
  },
  caption: {
    ...typography.bodySmall,
    color: colors.text,
    paddingHorizontal: spacing.screen,
    marginTop: spacing.xs,
  },
  captionAuthor: { fontWeight: '700' },
  commentsSection: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  commentsTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  comment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentBody: { flex: 1 },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  commentUserWrap: { flexShrink: 1 },
  commentMenuBtn: { padding: 2 },
  commentUser: { ...typography.label, color: colors.text },
  commentText: { ...typography.bodySmall, color: colors.text },
  commentTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  inputAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentInput: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  postComment: { ...typography.label, color: colors.primary },
  postCommentDisabled: { color: colors.textTertiary },
  missingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  missingText: { ...typography.body, color: colors.textSecondary },
  missingBack: { padding: spacing.sm },
  missingBackText: { ...typography.label, color: colors.primary },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingBottom: spacing.xxl,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  sheetRowText: { ...typography.body, color: colors.text },
  sheetRowDanger: { color: colors.error },
  sheetCancel: { justifyContent: 'center' },
  sheetCancelText: { ...typography.label, color: colors.textSecondary },
  modalBackdropCentered: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalBackdropSheet: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.xl,
    width: '100%',
  },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  modalBody: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  modalDangerBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.button,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalDangerText: { ...typography.label, color: colors.white },
  modalCancelBtn: { padding: spacing.md, alignItems: 'center' },
  modalCancelText: { ...typography.label, color: colors.textSecondary },
  reportSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    maxHeight: '88%',
    width: '100%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
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
  reportReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  reportReason: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  reportReasonOn: { borderColor: colors.primary, backgroundColor: '#FDE7F2' },
  reportReasonText: { ...typography.caption, color: colors.text },
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
  halfBtn: { flex: 1 },
});
