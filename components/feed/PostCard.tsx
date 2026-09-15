import { Image } from 'expo-image';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Avatar } from '@/components/common/Avatar';
import { IconButton } from '@/components/common/IconButton';
import { Chip } from '@/components/common/Primitives';
import { Text } from '@/components/common/Text';
import { BookmarkIcon, CommentIcon, EyeIcon, HeartIcon, MoreLinesIcon, MusicNoteIcon, MuteIcon, RepostIcon, ShareIcon, SoundIcon, VerifiedIcon } from '@/components/icons';
import { radius, spacing } from '@/constants/theme';
import { useSimulationIndicators } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { usePlaybackStore } from '@/store/playbackStore';
import type { AppMedia } from '@/types/app';
import { formatPostDate } from '@/utils/date';
import { formatCompact } from '@/utils/format';

import { MediaVideo } from './MediaVideo';

interface PostCardProps {
  media: AppMedia;
  /** Verified badge next to username */
  verified?: boolean;
  avatarUrl?: string;
  onPress?: (media: AppMedia) => void;
  onPressMore?: (media: AppMedia) => void;
  onPressInsights?: (media: AppMedia) => void;
  /** Opens the comments sheet. Falls back to `onPress`. */
  onPressComments?: (media: AppMedia) => void;
  /** "Gönderiyi Öne Çıkar" on your own posts. */
  onPressPromote?: (media: AppMedia) => void;
  /** Shows Instagram's "Takip Et" pill next to the username (accounts you do not own). */
  showFollow?: boolean;
  /**
   * Your own post as Instagram shows it under "Gönderiler": the "👁 N · İstatistikleri gör"
   * row with the promote button between the media and the action row.
   */
  own?: boolean;
  /** View count for the own-post row (post insights); falls back to the media's public play count. */
  viewCount?: number;
  /** Full caption (detail screen) instead of 2-line truncation. */
  expanded?: boolean;
  /** Share (send) count shown next to the paper-plane icon when the source knows it. */
  shareCount?: number;
  /** Small "liked by" facepile under the action row (only when the source has real likers). */
  likerAvatars?: readonly string[];
  /** Whether this card is the one on screen: only the active card mounts a video player. */
  active?: boolean;
  simulated?: boolean;
}

const BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
const PROMOTE_COLOR = '#4C5BF0';

function clampAspect(ratio: number | undefined): number {
  // Instagram feed shows at most 4:5 (0.8) and at least 1.91:1
  const r = ratio ?? 0.8;
  return Math.min(1.91, Math.max(0.8, r));
}

interface Slide {
  id: string;
  uri: string;
  videoUri?: string;
}

export const PostCard = memo(function PostCard({
  media,
  verified,
  avatarUrl,
  onPress,
  onPressMore,
  onPressInsights,
  onPressComments,
  onPressPromote,
  showFollow = false,
  own = false,
  viewCount,
  expanded = false,
  shareCount,
  likerAvatars,
  active = true,
  simulated,
}: PostCardProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const { width } = useWindowDimensions();
  const indicators = useSimulationIndicators();
  const feedMuted = usePlaybackStore((s) => s.feedMuted);
  const toggleFeedMuted = usePlaybackStore((s) => s.toggleFeedMuted);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState(0);
  const [captionOpen, setCaptionOpen] = useState(expanded);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const likeBounce = useSharedValue(1);
  const pagerRef = useRef<FlatList<Slide>>(null);

  const isVideo = media.type === 'VIDEO' || media.type === 'REEL';
  const aspect = clampAspect(media.aspectRatio ?? 0.8);
  const height = Math.round(width / aspect);

  const slides = useMemo<Slide[]>(() => {
    if (media.type === 'CAROUSEL_ALBUM' && media.children && media.children.length > 0) {
      return media.children.map((c) => ({ id: c.id, uri: c.thumbnailUrl || c.mediaUrl, videoUri: c.videoUrl }));
    }
    // A video's mediaUrl may itself be the mp4 (Graph API); the cover frame is always the thumbnail.
    return [{ id: media.id, uri: isVideo ? media.thumbnailUrl || media.mediaUrl : media.mediaUrl || media.thumbnailUrl, videoUri: media.videoUrl }];
  }, [media, isVideo]);
  const currentSlide = slides[page] ?? slides[0];
  const playing = Boolean(active && currentSlide?.videoUri);
  const hasVideo = slides.some((s) => Boolean(s.videoUri)) || isVideo;

  const showBigHeart = useCallback(() => {
    heartOpacity.value = 1;
    heartScale.value = 0;
    heartScale.value = withSequence(withSpring(1.1, { damping: 10, stiffness: 300 }), withTiming(1, { duration: 80 }));
    heartOpacity.value = withDelay(650, withTiming(0, { duration: 200 }));
  }, [heartOpacity, heartScale]);

  const like = useCallback(() => {
    setLiked((prev) => {
      if (!prev) {
        likeBounce.value = withSequence(withTiming(0.8, { duration: 80 }), withSpring(1, { damping: 8, stiffness: 300 }));
      }
      return true;
    });
  }, [likeBounce]);

  const toggleLike = useCallback(() => {
    triggerHaptic('light');
    setLiked((prev) => !prev);
    likeBounce.value = withSequence(withTiming(0.8, { duration: 80 }), withSpring(1, { damping: 8, stiffness: 300 }));
  }, [likeBounce]);

  // Instagram: a single tap on a playing feed video toggles the sound; on a photo it opens the post.
  const onSingleTap = useCallback(() => {
    if (playing) {
      triggerHaptic('selection');
      toggleFeedMuted();
      return;
    }
    onPress?.(media);
  }, [playing, toggleFeedMuted, onPress, media]);

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(240)
        .onEnd((_e, success) => {
          if (success) {
            runOnJS(showBigHeart)();
            runOnJS(like)();
            runOnJS(triggerHaptic)('medium');
          }
        }),
    [showBigHeart, like],
  );
  const singleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .onEnd((_e, success) => {
          if (success) runOnJS(onSingleTap)();
        }),
    [onSingleTap],
  );
  const tapGesture = useMemo(() => Gesture.Exclusive(doubleTap, singleTap), [doubleTap, singleTap]);

  const bigHeartStyle = useAnimatedStyle(() => ({ opacity: heartOpacity.value, transform: [{ scale: heartScale.value }] }));
  const likeIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeBounce.value }] }));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
      triggerHaptic('selection');
    }
  };

  const likeCount = media.likeCount + (liked ? 1 : 0);
  const shares = shareCount ?? media.shareCount;
  const views = viewCount ?? media.viewCount;
  const caption = media.caption.trim();
  const captionTruncated = !expanded && !captionOpen && caption.length > 40;

  const renderSlide = (slide: Slide, isCurrent: boolean) =>
    slide.videoUri && active && isCurrent ? (
      <MediaVideo media={media} uri={slide.videoUri} poster={slide.uri} width={width} height={height} muted={feedMuted} />
    ) : (
      <Image
        source={{ uri: slide.uri }}
        style={{ width, height }}
        contentFit="cover"
        transition={200}
        placeholder={{ blurhash: BLURHASH }}
        cachePolicy="memory-disk"
        recyclingKey={slide.id}
        accessibilityIgnoresInvertColors
      />
    );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => onPress?.(media)} style={styles.headerLeft} accessibilityRole="button" accessibilityLabel={media.username}>
          <Avatar uri={avatarUrl ?? media.ownerAvatarUrl} size={32} name={media.username} />
          <View style={styles.headerText}>
            <View style={styles.usernameRow}>
              <Text variant="feedStrong" numberOfLines={1}>
                {media.username}
              </Text>
              {verified ? <VerifiedIcon size={12} /> : null}
              {indicators && (media.isSimulated || simulated) ? <Chip label={t('sim.badge')} tone="simulation" small style={{ marginLeft: spacing.xs }} /> : null}
            </View>
            {media.music ? (
              <View style={styles.musicRow}>
                <MusicNoteIcon size={12} color={colors.text} />
                <Text variant="small" numberOfLines={1} style={styles.subline}>
                  {media.music}
                </Text>
              </View>
            ) : media.location ? (
              <Text variant="small" numberOfLines={1} style={styles.subline}>
                {media.location}
              </Text>
            ) : media.type === 'REEL' ? (
              <Text variant="small" color="secondary" numberOfLines={1} style={styles.subline}>
                {t('feed.reel')}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {showFollow ? (
          <Pressable style={[styles.follow, { borderColor: colors.borderStrong }]} accessibilityRole="button" accessibilityLabel={t('feed.follow')}>
            <Text variant="feedStrong">{t('feed.follow')}</Text>
          </Pressable>
        ) : null}
        <IconButton accessibilityLabel="more" onPress={() => onPressMore?.(media)} size={36}>
          <MoreLinesIcon color={colors.text} size={24} />
        </IconButton>
      </View>

      {/* Media */}
      <GestureDetector gesture={tapGesture}>
        <View style={{ width, height, backgroundColor: colors.skeleton }}>
          {slides.length > 1 ? (
            <FlatList
              ref={pagerRef}
              data={slides}
              keyExtractor={(s) => s.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              initialNumToRender={2}
              windowSize={3}
              extraData={`${page}:${active ? 1 : 0}:${feedMuted ? 1 : 0}`}
              renderItem={({ item, index }) => renderSlide(item, index === page)}
            />
          ) : currentSlide ? (
            renderSlide(currentSlide, true)
          ) : null}
          {slides.length > 1 ? (
            <View style={styles.counter}>
              <Text variant="small" style={styles.counterText}>
                {page + 1}/{slides.length}
              </Text>
            </View>
          ) : null}
          {hasVideo ? (
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                toggleFeedMuted();
              }}
              hitSlop={8}
              style={styles.muteBadge}
              accessibilityRole="button"
              accessibilityLabel={feedMuted ? t('feed.soundOn') : t('feed.soundOff')}
            >
              {feedMuted || !playing ? <MuteIcon size={16} color="#fff" /> : <SoundIcon size={16} color="#fff" />}
            </Pressable>
          ) : null}
          <Animated.View style={[styles.bigHeart, bigHeartStyle]} pointerEvents="none">
            <HeartIcon filled color="#fff" size={96} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Own post: "👁 531 · İstatistikleri gör" + "Gönderiyi Öne Çıkar" */}
      {own ? (
        <View style={styles.ownRow}>
          <Pressable onPress={() => onPressInsights?.(media)} style={styles.insightsLink} accessibilityRole="button" accessibilityLabel={t('media.viewInsightsShort')}>
            <EyeIcon size={18} color={colors.text} strokeWidth={1.8} />
            <Text variant="feedStrong" style={{ marginLeft: 6 }} numberOfLines={1}>
              {views !== undefined ? `${formatCompact(views, language)} · ` : ''}
              {t('media.viewInsightsShort')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onPressPromote?.(media)}
            style={({ pressed }) => [styles.promote, { backgroundColor: PROMOTE_COLOR, opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t('media.promote')}
          >
            <Text variant="feedStrong" style={styles.promoteText} numberOfLines={1}>
              {t('media.promote')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Actions — counts sit next to the icons and only appear when there is something to count */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <Pressable onPress={toggleLike} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('metric.likes')} style={styles.actionItem}>
            <Animated.View style={likeIconStyle}>
              <HeartIcon filled={liked} color={liked ? colors.like : colors.text} size={26} strokeWidth={1.8} />
            </Animated.View>
            {likeCount > 0 ? (
              <Text variant="feedStrong" style={styles.actionCount}>
                {formatCompact(likeCount, language)}
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={() => (onPressComments ?? onPress)?.(media)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('metric.comments')} style={styles.actionItem}>
            <CommentIcon color={colors.text} size={26} strokeWidth={1.8} />
            {media.commentCount > 0 ? (
              <Text variant="feedStrong" style={styles.actionCount}>
                {formatCompact(media.commentCount, language)}
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={() => onPressInsights?.(media)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('feed.repost')} style={styles.actionItem}>
            <RepostIcon color={colors.text} size={26} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => onPressInsights?.(media)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.share')} style={styles.actionItem}>
            <ShareIcon color={colors.text} size={26} strokeWidth={1.8} />
            {shares !== undefined && shares > 0 ? (
              <Text variant="feedStrong" style={styles.actionCount}>
                {formatCompact(shares, language)}
              </Text>
            ) : null}
          </Pressable>
        </View>
        {slides.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {slides.slice(0, 7).map((s, i) => (
              <View key={s.id} style={[styles.dot, { backgroundColor: i === page ? colors.primary : colors.borderStrong }]} />
            ))}
          </View>
        ) : null}
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            setSaved((prev) => !prev);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('metric.saves')}
        >
          <BookmarkIcon filled={saved} color={colors.text} size={26} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Liked-by facepile, caption, date */}
      <View style={styles.meta}>
        {likerAvatars && likerAvatars.length > 0 ? (
          <View style={styles.facepile} accessibilityLabel={t('feed.liked')}>
            {likerAvatars.slice(0, 3).map((uri, i) => (
              <View key={`${uri}-${i}`} style={[styles.facepileItem, { borderColor: colors.background, marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }]}>
                <Avatar uri={uri} size={22} />
              </View>
            ))}
          </View>
        ) : null}
        {caption ? (
          <Pressable onPress={() => (expanded ? undefined : setCaptionOpen((v) => !v))} accessibilityRole="text">
            <Text variant="feed" numberOfLines={captionTruncated ? 1 : undefined} style={styles.caption}>
              <Text variant="feedStrong">{media.username} </Text>
              {captionTruncated ? caption.slice(0, 40).trimEnd() + '… ' : caption}
              {captionTruncated ? (
                <Text variant="feed" color="secondary">
                  {t('feed.more')}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        ) : null}
        <Text variant="small" color="secondary" style={styles.date}>
          {formatPostDate(media.timestamp, language)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { paddingBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, paddingRight: spacing.xs, height: 56 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerText: { marginLeft: spacing.sm + 2, flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  subline: { fontSize: 12, flexShrink: 1 },
  follow: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginRight: 4 },
  counter: { position: 'absolute', top: spacing.md, right: spacing.md, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  counterText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  muteBadge: { position: 'absolute', bottom: spacing.md, right: spacing.md, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  bigHeart: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs, gap: spacing.md },
  insightsLink: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  promote: { paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radius.md },
  promoteText: { color: '#fff' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, paddingBottom: spacing.xs },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.lg },
  actionItem: { flexDirection: 'row', alignItems: 'center' },
  actionCount: { marginLeft: 6 },
  dots: { position: 'absolute', left: 0, right: 0, top: spacing.sm + 8, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { paddingHorizontal: spacing.md, paddingTop: 2 },
  facepile: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: 2 },
  facepileItem: { borderWidth: 2, borderRadius: 13 },
  caption: { marginTop: 2 },
  date: { marginTop: 4, fontSize: 12 },
});
