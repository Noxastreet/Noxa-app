import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ReportModal } from "@/src/components/moderation/ReportModal";
import { NoxaButton, NoxaScreen } from "@/src/components/ui";
import { blockUser, type ReportTargetType } from "@/src/lib/moderation";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type PostRow = {
  id: string;
  author_id: string;
  vehicle_id: string | null;
  image_url: string;
  caption: string | null;
  location_name: string | null;
  is_public: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  reply_to_user_id: string | null;
  body: string;
  created_at: string;
};

type CommentViewModel = CommentRow & {
  author: Profile | null;
  replyTo: Profile | null;
  likeCount: number;
  likedByMe: boolean;
};

type ReportTarget = {
  id: string;
  label: string;
  type: Extract<ReportTargetType, "post" | "comment">;
};

const postImagesBucket = "post-images";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function profileName(profile: Profile | null) {
  return profile?.display_name?.trim() || profile?.username?.trim() || "NOXA driver";
}

function profileHandle(profile: Profile | null) {
  if (!profile?.username) return profile?.city || "NOXA member";
  return profile.username.startsWith("@") ? profile.username : `@${profile.username}`;
}

function initials(profile: Profile | null) {
  return (
    profileName(profile)
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NX"
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function ownedPostImagePath(publicUrl: string, userId: string) {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${postImagesBucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    return path.split("/")[0] === userId ? path : null;
  } catch {
    return null;
  }
}

function ProfileAvatar({ profile, size = 42 }: { profile: Profile | null; size?: number }) {
  if (profile?.avatar_url) {
    return (
      <Image
        accessibilityLabel={`${profileName(profile)} avatar`}
        source={{ uri: profile.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: Math.max(10, size * 0.27) }]}>
        {initials(profile)}
      </Text>
    </View>
  );
}

export default function PostDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = (Array.isArray(params.id) ? params.id[0] : params.id)?.trim() ?? "";
  const inputRef = useRef<TextInput>(null);
  const [post, setPost] = useState<PostRow | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [comments, setComments] = useState<CommentViewModel[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postActionBusy, setPostActionBusy] = useState(false);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<Profile | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);

  const isAuthor = useMemo(
    () => Boolean(post && currentUserId === post.author_id),
    [currentUserId, post],
  );

  const loadPost = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setError(null);
      setNotFound(false);

      if (!uuidPattern.test(postId)) {
        setPost(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      setCurrentUserId(userId);

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("id,author_id,vehicle_id,image_url,caption,location_name,is_public,created_at")
        .eq("id", postId)
        .maybeSingle();

      if (postError) {
        setError(postError.message);
        setLoading(false);
        return;
      }
      if (!postData) {
        setPost(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const loadedPost = postData as PostRow;
      const [authorResult, likesResult, myLikeResult, savedResult, commentsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,display_name,username,avatar_url,city")
            .eq("id", loadedPost.author_id)
            .maybeSingle(),
          supabase
            .from("post_likes")
            .select("post_id", { count: "exact", head: true })
            .eq("post_id", loadedPost.id),
          userId
            ? supabase
                .from("post_likes")
                .select("post_id")
                .eq("post_id", loadedPost.id)
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          userId
            ? supabase
                .from("saved_posts")
                .select("post_id")
                .eq("post_id", loadedPost.id)
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("post_comments")
            .select("id,post_id,author_id,reply_to_user_id,body,created_at")
            .eq("post_id", loadedPost.id)
            .order("created_at", { ascending: true })
            .limit(100),
        ]);

      const firstError =
        authorResult.error ||
        likesResult.error ||
        myLikeResult.error ||
        savedResult.error ||
        commentsResult.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const commentRows = (commentsResult.data ?? []) as CommentRow[];
      const profileIds = Array.from(
        new Set(
          commentRows.flatMap((comment) =>
            comment.reply_to_user_id
              ? [comment.author_id, comment.reply_to_user_id]
              : [comment.author_id],
          ),
        ),
      );
      const commentIds = commentRows.map((comment) => comment.id);
      const [profilesResult, commentLikesResult] = await Promise.all([
        profileIds.length
          ? supabase
              .from("profiles")
              .select("id,display_name,username,avatar_url,city")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
        commentIds.length
          ? supabase
              .from("post_comment_likes")
              .select("comment_id,user_id")
              .in("comment_id", commentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesResult.error || commentLikesResult.error) {
        setError((profilesResult.error || commentLikesResult.error)?.message ?? "Comments could not be loaded.");
        setLoading(false);
        return;
      }

      const profileMap = new Map(
        ((profilesResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]),
      );
      const commentLikeCounts = new Map<string, number>();
      const myCommentLikes = new Set<string>();
      for (const row of commentLikesResult.data ?? []) {
        commentLikeCounts.set(row.comment_id, (commentLikeCounts.get(row.comment_id) ?? 0) + 1);
        if (row.user_id === userId) myCommentLikes.add(row.comment_id);
      }

      setPost(loadedPost);
      setAuthor((authorResult.data as Profile | null) ?? null);
      setLikeCount(likesResult.count ?? 0);
      setLiked(Boolean(myLikeResult.data));
      setSaved(Boolean(savedResult.data));
      setComments(
        commentRows.map((comment) => ({
          ...comment,
          author: profileMap.get(comment.author_id) ?? null,
          replyTo: comment.reply_to_user_id
            ? profileMap.get(comment.reply_to_user_id) ?? null
            : null,
          likeCount: commentLikeCounts.get(comment.id) ?? 0,
          likedByMe: myCommentLikes.has(comment.id),
        })),
      );
      setLoading(false);
    },
    [postId],
  );

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  const toggleLike = useCallback(async () => {
    if (!post || !currentUserId || postActionBusy) return;
    setPostActionBusy(true);
    const result = liked
      ? await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId)
      : await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId });

    if (result.error) setError(result.error.message);
    else {
      setLiked(!liked);
      setLikeCount((count) => Math.max(0, count + (liked ? -1 : 1)));
    }
    setPostActionBusy(false);
  }, [currentUserId, liked, post, postActionBusy]);

  const toggleSaved = useCallback(async () => {
    if (!post || !currentUserId || postActionBusy) return;
    setPostActionBusy(true);
    const result = saved
      ? await supabase
          .from("saved_posts")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId)
      : await supabase.from("saved_posts").insert({ post_id: post.id, user_id: currentUserId });

    if (result.error) setError(result.error.message);
    else setSaved(!saved);
    setPostActionBusy(false);
  }, [currentUserId, post, postActionBusy, saved]);

  const toggleCommentLike = useCallback(
    async (comment: CommentViewModel) => {
      if (!currentUserId || commentActionId) return;
      setCommentActionId(comment.id);
      const result = comment.likedByMe
        ? await supabase
            .from("post_comment_likes")
            .delete()
            .eq("comment_id", comment.id)
            .eq("user_id", currentUserId)
        : await supabase
            .from("post_comment_likes")
            .insert({ comment_id: comment.id, user_id: currentUserId });

      if (result.error) setError(result.error.message);
      else {
        setComments((current) =>
          current.map((item) =>
            item.id === comment.id
              ? {
                  ...item,
                  likedByMe: !item.likedByMe,
                  likeCount: Math.max(0, item.likeCount + (item.likedByMe ? -1 : 1)),
                }
              : item,
          ),
        );
      }
      setCommentActionId(null);
    },
    [commentActionId, currentUserId],
  );

  const beginReply = useCallback((profile: Profile | null) => {
    if (!profile) return;
    setReplyTarget(profile);
    inputRef.current?.focus();
  }, []);

  const submitComment = useCallback(async () => {
    const body = commentBody.trim();
    if (!post || !currentUserId || submittingComment || !body) return;
    if (body.length > 1000) {
      setError("Comment must be 1,000 characters or less.");
      return;
    }

    setSubmittingComment(true);
    setError(null);
    const { error: commentError } = await supabase.from("post_comments").insert({
      post_id: post.id,
      author_id: currentUserId,
      reply_to_user_id: replyTarget?.id ?? null,
      body,
    });
    if (commentError) setError(commentError.message);
    else {
      setCommentBody("");
      setReplyTarget(null);
      await loadPost(false);
    }
    setSubmittingComment(false);
  }, [commentBody, currentUserId, loadPost, post, replyTarget, submittingComment]);

  const confirmDeleteComment = useCallback(
    (comment: CommentViewModel) => {
      if (!currentUserId || (comment.author_id !== currentUserId && !isAuthor)) return;
      Alert.alert("Delete comment?", "This comment will be removed from the post.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error: deleteError } = await supabase
              .from("post_comments")
              .delete()
              .eq("id", comment.id);
            if (deleteError) setError(deleteError.message);
            else setComments((current) => current.filter((item) => item.id !== comment.id));
          },
        },
      ]);
    },
    [currentUserId, isAuthor],
  );

  const sharePost = useCallback(async () => {
    if (!post || sharing) return;
    setSharing(true);
    try {
      const postUrl = Linking.createURL("/post-details", { queryParams: { id: post.id } });
      await Share.share({
        message: `${profileName(author)} on NOXA${post.caption ? `\n${post.caption}` : ""}\n${postUrl}`,
        title: "NOXA post",
        url: postUrl,
      });
    } catch {
      Alert.alert("Unable to share post", "Please try again.");
    } finally {
      setSharing(false);
    }
  }, [author, post, sharing]);

  const confirmDeletePost = useCallback(() => {
    if (!post || !currentUserId || !isAuthor || deleting) return;
    Alert.alert("Delete post?", "The image, comments, and likes will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Post",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          const { data, error: deleteError } = await supabase
            .from("posts")
            .delete()
            .eq("id", post.id)
            .eq("author_id", currentUserId)
            .select("id");
          if (deleteError || !data?.length) {
            setError(deleteError?.message ?? "Post was not deleted.");
            setDeleting(false);
            return;
          }

          const imagePath = ownedPostImagePath(post.image_url, currentUserId);
          if (imagePath) await supabase.storage.from(postImagesBucket).remove([imagePath]);
          router.replace("/(tabs)/profile");
        },
      },
    ]);
  }, [currentUserId, deleting, isAuthor, post]);

  const confirmBlockDriver = useCallback(
    (driverId: string, name: string) => {
      if (!currentUserId || driverId === currentUserId || blockingUserId) return;
      Alert.alert(
        `Block ${name}?`,
        "You will no longer see each other's profiles, content, follows, or Live Drive location. Existing follows will be removed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              setBlockingUserId(driverId);
              try {
                await blockUser(driverId);
                Alert.alert("Driver blocked", `${name} is now hidden from your NOXA account.`, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (blockError) {
                Alert.alert(
                  "Block failed",
                  blockError instanceof Error ? blockError.message : "Please try again.",
                );
              } finally {
                setBlockingUserId(null);
              }
            },
          },
        ],
      );
    },
    [blockingUserId, currentUserId],
  );

  const openPostActions = useCallback(() => {
    if (!post) return;
    if (isAuthor) {
      confirmDeletePost();
      return;
    }

    const buttons: AlertButton[] = [
      {
        text: "Report Post",
        onPress: () => setReportTarget({ id: post.id, label: "post", type: "post" }),
      },
    ];
    if (currentUserId && post.author_id !== currentUserId) {
      buttons.push({
        text: "Block Driver",
        style: "destructive",
        onPress: () => confirmBlockDriver(post.author_id, profileName(author)),
      });
    }
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Post actions", "Choose a safety action for this post.", buttons);
  }, [author, confirmBlockDriver, confirmDeletePost, currentUserId, isAuthor, post]);

  const openCommentActions = useCallback(
    (comment: CommentViewModel) => {
      if (!currentUserId) return;
      if (comment.author_id === currentUserId) {
        confirmDeleteComment(comment);
        return;
      }

      const name = profileName(comment.author);
      const buttons: AlertButton[] = [
        {
          text: "Report Comment",
          onPress: () =>
            setReportTarget({ id: comment.id, label: "comment", type: "comment" }),
        },
        {
          text: "Block Driver",
          style: "destructive",
          onPress: () => confirmBlockDriver(comment.author_id, name),
        },
      ];
      if (isAuthor) {
        buttons.push({
          text: "Delete Comment",
          style: "destructive",
          onPress: () => confirmDeleteComment(comment),
        });
      }
      buttons.push({ text: "Cancel", style: "cancel" });
      Alert.alert("Comment actions", "Choose an action for this comment.", buttons);
    },
    [confirmBlockDriver, confirmDeleteComment, currentUserId, isAuthor],
  );

  return (
    <NoxaScreen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
        style={styles.flex}>
        <View style={styles.header}>
          <HeaderButton icon="chevron-back" label="Go back" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>POST</Text>
          <View style={styles.headerActions}>
            <HeaderButton
              icon={sharing ? "checkmark" : "share-social-outline"}
              label="Share post"
              onPress={() => void sharePost()}
            />
            {post ? (
              <HeaderButton
                icon={blockingUserId ? "hourglass-outline" : "ellipsis-horizontal"}
                label="Post actions"
                onPress={openPostActions}
              />
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <StateCard loading message="Loading post…" />
          ) : notFound ? (
            <StateCard
              message="This post is unavailable or private."
              onPress={() => router.replace("/(tabs)/profile")}
              title="Post not found"
            />
          ) : post ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: "/driver-profile/[id]", params: { id: post.author_id } })
                }
                style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}>
                <ProfileAvatar profile={author} size={44} />
                <View style={styles.authorCopy}>
                  <Text style={styles.authorName}>{profileName(author)}</Text>
                  <Text numberOfLines={1} style={styles.authorMeta}>
                    {post.location_name || profileHandle(author)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textSubtle} />
              </Pressable>

              <Image source={{ uri: post.image_url }} style={styles.postImage} />

              <View style={styles.actionRow}>
                <View style={styles.actionLeft}>
                  <ActionButton
                    active={liked}
                    activeIcon="heart"
                    icon="heart-outline"
                    label={liked ? "Unlike post" : "Like post"}
                    onPress={() => void toggleLike()}
                  />
                  <ActionButton
                    icon="chatbubble-outline"
                    label="Write a comment"
                    onPress={() => inputRef.current?.focus()}
                  />
                  <ActionButton
                    icon="paper-plane-outline"
                    label="Share post"
                    onPress={() => void sharePost()}
                  />
                </View>
                <ActionButton
                  active={saved}
                  activeIcon="bookmark"
                  icon="bookmark-outline"
                  label={saved ? "Remove bookmark" : "Save post"}
                  onPress={() => void toggleSaved()}
                />
              </View>

              <View style={styles.postCopy}>
                <Text style={styles.metrics}>
                  {likeCount} {likeCount === 1 ? "like" : "likes"} · {comments.length}{" "}
                  {comments.length === 1 ? "comment" : "comments"}
                </Text>
                {post.caption ? (
                  <Text style={styles.caption}>
                    <Text style={styles.captionAuthor}>{profileName(author)} </Text>
                    {post.caption}
                  </Text>
                ) : null}
                <Text style={styles.postDate}>{formatDate(post.created_at).toUpperCase()}</Text>
              </View>

              <View style={styles.commentsSection}>
                <View style={styles.commentsHeading}>
                  <Text style={styles.sectionTitle}>COMMENTS</Text>
                  <Text style={styles.sectionCount}>{comments.length}</Text>
                </View>
                {comments.length ? (
                  <View style={styles.commentList}>
                    {comments.map((comment, index) => (
                      <CommentItem
                        busy={commentActionId === comment.id}
                        comment={comment}
                        index={index}
                        key={comment.id}
                        onDelete={() => openCommentActions(comment)}
                        onLike={() => void toggleCommentLike(comment)}
                        onOpenProfile={() =>
                          router.push({
                            pathname: "/driver-profile/[id]",
                            params: { id: comment.author_id },
                          })
                        }
                        onReply={() => beginReply(comment.author)}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyComments}>
                    <Ionicons name="chatbubbles-outline" size={25} color={colors.textSubtle} />
                    <Text style={styles.emptyTitle}>Start the conversation</Text>
                    <Text style={styles.emptyText}>Be the first driver to comment.</Text>
                  </View>
                )}
              </View>
            </>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              {post ? (
                <Pressable onPress={() => void loadPost(false)} style={styles.retryButton}>
                  <Text style={styles.retryText}>RETRY</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {post && !loading && !notFound ? (
          <View style={styles.composerShell}>
            {replyTarget ? (
              <View style={styles.replyingRow}>
                <Text style={styles.replyingText}>Replying to {profileName(replyTarget)}</Text>
                <Pressable accessibilityLabel="Cancel reply" onPress={() => setReplyTarget(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                maxLength={1000}
                multiline
                onChangeText={setCommentBody}
                placeholder="Add a comment…"
                placeholderTextColor={colors.textMuted}
                ref={inputRef}
                selectionColor={colors.primary}
                style={styles.composerInput}
                value={commentBody}
              />
              <Pressable
                accessibilityLabel="Post comment"
                accessibilityRole="button"
                disabled={!commentBody.trim() || submittingComment}
                onPress={() => void submitComment()}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!commentBody.trim() || submittingComment) && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                {submittingComment ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={19} color={colors.text} />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <ReportModal
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.id ?? null}
        targetLabel={reportTarget?.label ?? "content"}
        targetType={reportTarget?.type ?? "post"}
        visible={Boolean(reportTarget)}
      />
    </NoxaScreen>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={21} color={colors.text} />
    </Pressable>
  );
}

function ActionButton({
  active = false,
  activeIcon,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <Ionicons
        name={active && activeIcon ? activeIcon : icon}
        size={25}
        color={active ? colors.primaryHover : colors.text}
      />
    </Pressable>
  );
}

function CommentItem({
  busy,
  comment,
  index,
  onDelete,
  onLike,
  onOpenProfile,
  onReply,
}: {
  busy: boolean;
  comment: CommentViewModel;
  index: number;
  onDelete: () => void;
  onLike: () => void;
  onOpenProfile: () => void;
  onReply: () => void;
}) {
  return (
    <View style={[styles.commentRow, index > 0 && styles.commentBorder]}>
      <Pressable accessibilityRole="button" onPress={onOpenProfile}>
        <ProfileAvatar profile={comment.author} size={38} />
      </Pressable>
      <Pressable delayLongPress={450} onLongPress={onDelete} style={styles.commentMain}>
        <Text style={styles.commentBody}>
          <Text style={styles.commentAuthor}>{profileName(comment.author)} </Text>
          {comment.replyTo ? (
            <Text style={styles.replyMention}>{profileHandle(comment.replyTo)} </Text>
          ) : null}
          {comment.body}
        </Text>
        <View style={styles.commentMetaRow}>
          <Text style={styles.commentMeta}>{formatCommentTime(comment.created_at)}</Text>
          {comment.likeCount ? (
            <Text style={styles.commentMeta}>
              {comment.likeCount} {comment.likeCount === 1 ? "like" : "likes"}
            </Text>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onReply}>
            <Text style={styles.replyButtonText}>Reply</Text>
          </Pressable>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={comment.likedByMe ? "Unlike comment" : "Like comment"}
        accessibilityRole="button"
        disabled={busy}
        onPress={onLike}
        style={({ pressed }) => [styles.commentLike, pressed && styles.pressed]}>
        {busy ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : (
          <Ionicons
            name={comment.likedByMe ? "heart" : "heart-outline"}
            size={16}
            color={comment.likedByMe ? colors.primaryHover : colors.textMuted}
          />
        )}
      </Pressable>
    </View>
  );
}

function StateCard({
  loading = false,
  message,
  onPress,
  title,
}: {
  loading?: boolean;
  message: string;
  onPress?: () => void;
  title?: string;
}) {
  return (
    <View style={styles.stateCard}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {title ? <Text style={styles.stateTitle}>{title}</Text> : null}
      <Text style={styles.stateText}>{message}</Text>
      {onPress ? <NoxaButton onPress={onPress} size="md" title="Back to Profile" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.sectionTitle,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  headerActions: { minWidth: 88, flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs },
  content: { paddingBottom: 132 },
  authorRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  authorCopy: { flex: 1 },
  authorName: { color: colors.text, fontSize: 14, fontWeight: "900" },
  authorMeta: { marginTop: 2, color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primaryMuted,
  },
  avatarInitials: { color: colors.text, fontWeight: "900" },
  postImage: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceSoft },
  actionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  actionLeft: { flexDirection: "row" },
  actionButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  postCopy: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  metrics: { color: colors.text, fontSize: 13, fontWeight: "900" },
  caption: { color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  captionAuthor: { fontWeight: "900" },
  postDate: { color: colors.textSubtle, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  commentsSection: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  commentsHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontFamily: typography.fontFamily.display, fontSize: 17, fontWeight: "900", letterSpacing: 0.8 },
  sectionCount: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  commentList: {
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md },
  commentBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  commentMain: { flex: 1, minWidth: 0 },
  commentBody: { color: colors.text, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  commentAuthor: { fontWeight: "900" },
  replyMention: { color: colors.primaryHover, fontWeight: "800" },
  commentMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  commentMeta: { color: colors.textSubtle, fontSize: 9, fontWeight: "800" },
  replyButtonText: { color: colors.textMuted, fontSize: 9, fontWeight: "900" },
  commentLike: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  emptyComments: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  emptyText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  composerShell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.glass,
    ...shadows.control,
  },
  replyingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xs },
  replyingText: { color: colors.textMuted, fontSize: 10, fontWeight: "800" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  composerInput: {
    minHeight: 46,
    maxHeight: 100,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  sendButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.42 },
  errorCard: {
    margin: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  errorText: { flex: 1, color: colors.primaryHover, fontSize: 11, fontWeight: "700", lineHeight: 17 },
  retryButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  retryText: { color: colors.text, fontSize: 9, fontWeight: "900" },
  stateCard: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateTitle: { color: colors.text, fontSize: typography.title, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.textMuted, fontSize: 13, fontWeight: "700", lineHeight: 20, textAlign: "center" },
  pressed: { opacity: 0.82, transform: [{ translateY: 1 }, { scale: 0.99 }] },
});
