import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { MediaVideo } from '@/components/feed/MediaVideo';
import { BookmarkIcon, CameraIcon, CommentIcon, HeartIcon, MoreIcon, MusicNoteIcon, ReelsIcon, ShareIcon } from '@/components/icons';
import { spacing, touch } from '@/constants/theme';
import { flattenMedia, useAccount, useMediaFeed } from '@/features/instagram/hooks';
import { useEffectiveAccount, useEffectiveMedia } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { AppMedia } from '@/types/app';
import { formatCompact } from '@/utils/format';

const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 60 };

/**
 * Instagram Reels tab: full-screen vertical pager with the right-hand action rail.
 * The page on screen plays its video with sound; a tap pauses it, the others show
 * their cover frame.
 */
export default function ReelsTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { height: windowHeight, width } = useWindowDimensions();
  const pageHeight = windowHeight - touch.tabBarHeight - insets.bottom;
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [paused, setPaused] = useState(false);

  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const feed = useMediaFeed();
  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  const reels = useMemo(() => media.filter((m) => m.type === 'REEL' || m.type === 'VIDEO'), [media]);
  const currentId = activeId ?? reels[0]?.id;

  // Kept in state so the pair never changes identity (FlatList forbids that), even across Fast Refresh.
  const [viewabilityConfigCallbackPairs] = useState(() => [
    {
      viewabilityConfig: VIEWABILITY,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<AppMedia>[] }) => {
        const first = viewableItems.find((v) => v.isViewable);
        if (first?.item) {
          setActiveId(first.item.id);
          setPaused(false);
        }
      },
    },
  ]);

  const renderItem = useCallback(
    ({ item }: { item: AppMedia }) => {
      const isLiked = liked[item.id] ?? false;
      const likes = item.likeCount + (isLiked ? 1 : 0);
      const cover = item.thumbnailUrl || item.mediaUrl;
      const playing = focused && item.id === currentId && Boolean(item.videoUrl);
      return (
        <View style={{ width, height: pageHeight, backgroundColor: '#000' }}>
          <Pressable
            onPress={() => {
              if (!playing) return;
              triggerHaptic('selection');
              setPaused((p) => !p);
            }}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={item.caption.slice(0, 40) || t('feed.reel')}
          >
            {playing && item.videoUrl ? (
              <MediaVideo media={item} uri={item.videoUrl} poster={cover} width={width} height={pageHeight} muted={false} paused={paused} contentFit="cover" />
            ) : (
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} />
            )}
          </Pressable>
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={styles.shade} pointerEvents="none" />
          {/* right rail */}
          <View style={[styles.rail, { bottom: spacing.xxl }]}>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                setLiked((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
              }}
              style={styles.railItem}
              accessibilityRole="button"
              accessibilityLabel={t('metric.likes')}
            >
              <HeartIcon size={28} color={isLiked ? colors.like : '#fff'} filled={isLiked} />
              <Text variant="captionStrong" style={styles.railText}>
                {formatCompact(likes, language)}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/media/${item.id}`)} style={styles.railItem} accessibilityRole="button" accessibilityLabel={t('metric.comments')}>
              <CommentIcon size={28} color="#fff" />
              <Text variant="captionStrong" style={styles.railText}>
                {formatCompact(item.commentCount, language)}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/insights/post/${item.id}`)} style={styles.railItem} accessibilityRole="button" accessibilityLabel={t('common.share')}>
              <ShareIcon size={28} color="#fff" />
            </Pressable>
            <Pressable style={styles.railItem} accessibilityRole="button" accessibilityLabel={t('metric.saves')}>
              <BookmarkIcon size={28} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.push(`/media/${item.id}`)} style={styles.railItem} accessibilityRole="button" accessibilityLabel="more">
              <MoreIcon size={26} color="#fff" />
            </Pressable>
          </View>
          {/* bottom info */}
          <View style={[styles.info, { bottom: spacing.xl }]} pointerEvents="box-none">
            <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.userRow} accessibilityRole="button" accessibilityLabel={item.username}>
              <Avatar uri={effectiveAccount?.profilePictureUrl} size={34} name={item.username} />
              <Text variant="feedStrong" style={styles.white}>
                {item.username}
              </Text>
            </Pressable>
            {item.caption ? (
              <Text variant="feed" style={[styles.white, { marginTop: spacing.sm }]} numberOfLines={2}>
                {item.caption}
              </Text>
            ) : null}
            <View style={styles.audioRow}>
              {item.music ? <MusicNoteIcon size={14} color="#fff" /> : <ReelsIcon size={14} color="#fff" strokeWidth={1.8} />}
              <Text variant="small" style={[styles.white, { marginLeft: 6 }]} numberOfLines={1}>
                {item.music ?? `${item.username} · ${t('reels.audio')}`}
              </Text>
            </View>
            {item.viewCount !== undefined ? (
              <Text variant="small" style={[styles.white, { marginTop: 6, opacity: 0.8 }]}>
                {t('feed.views', { n: formatCompact(item.viewCount, language) })}
              </Text>
            ) : null}
          </View>
        </View>
      );
    },
    [liked, width, pageHeight, colors.like, effectiveAccount?.profilePictureUrl, language, router, t, currentId, paused, focused],
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {reels.length === 0 ? (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <EmptyState title={t('profile.noReelsTitle')} body={t('reels.empty2')} icon={<ReelsIcon color="#fff" size={32} strokeWidth={1.5} />} />
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
          initialNumToRender={2}
          windowSize={3}
          removeClippedSubviews
        />
      )}
      <View style={[styles.header, { top: insets.top }]} pointerEvents="box-none">
        <Text variant="heading" weight="700" style={styles.white}>
          {t('tabs.reels')}
        </Text>
        <Pressable onPress={() => router.push('/create')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('tabs.create')}>
          <CameraIcon size={26} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  rail: { position: 'absolute', right: spacing.md, alignItems: 'center', gap: spacing.lg },
  railItem: { alignItems: 'center' },
  railText: { color: '#fff', marginTop: 4 },
  info: { position: 'absolute', left: spacing.md, right: 72 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  audioRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  white: { color: '#fff' },
  header: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
});
