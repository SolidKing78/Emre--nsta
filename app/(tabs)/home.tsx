import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ViewToken } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { IconButton } from '@/components/common/IconButton';
import { Screen } from '@/components/common/Screen';
import { PostSkeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { CommentsSheet } from '@/components/feed/CommentsSheet';
import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { StoriesRow } from '@/components/feed/StoriesRow';
import { Wordmark } from '@/components/feed/Wordmark';
import { HeartIcon, ShareIcon } from '@/components/icons';
import { SimulationBanner } from '@/components/simulation/SimulationBadge';
import { spacing } from '@/constants/theme';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useMediaFeed, useRefreshAll, useSession, useStories } from '@/features/instagram/hooks';
import { useEffectiveAccount, useEffectiveMedia, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { mockStories } from '@/mocks/mockData';
import { useAuthStore } from '@/store/authStore';
import type { AppMedia } from '@/types/app';

// "Covers at least 40% of the screen" — works for tall reels on small phones and short landscape posts alike.
const VIEWABILITY = { viewAreaCoveragePercentThreshold: 40, minimumViewTime: 80 };

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const feed = useMediaFeed();
  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const { data: stories } = useStories();
  const refreshAll = useRefreshAll();
  const simulation = useSimulationIndicators();
  const [refreshing, setRefreshing] = useState(false);
  const [options, setOptions] = useState<AppMedia | null>(null);
  const [commentsFor, setCommentsFor] = useState<AppMedia | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const session = useSession();

  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  // Repost counts next to the ↻ icon come from the same per-post insights the profile grid uses.
  const performance = useContentPerformance(media, effectiveAccount);
  const statsById = useMemo(() => Object.fromEntries(performance.items.map((p) => [p.media.id, { views: p.views, shares: p.shares }])), [performance.items]);
  const showFollow = effectiveAccount?.source === 'public';
  // Likers are only shown where the source has real people behind them (the demo data set).
  const likerAvatars = useMemo(() => (session?.source === 'demo' ? mockStories.filter((s) => !s.isSelf).slice(0, 3).map((s) => s.avatarUrl) : undefined), [session?.source]);

  // Only the post on screen plays its video (Instagram autoplays one at a time). FlatList
  // requires the config/callback pair to keep its identity for the list's whole life, so it
  // lives in state (which even survives Fast Refresh).
  const [viewabilityConfigCallbackPairs] = useState(() => [
    {
      viewabilityConfig: VIEWABILITY,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<AppMedia>[] }) => {
        const first = viewableItems.find((v) => v.isViewable);
        setActiveId(first?.item?.id);
      },
    },
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const openDetail = useCallback((item: AppMedia) => router.push(`/media/${item.id}`), [router]);
  const openInsights = useCallback((item: AppMedia) => router.push(`/insights/post/${item.id}`), [router]);

  const renderItem = useCallback(
    ({ item }: { item: AppMedia }) => (
      <PostCard
        media={item}
        avatarUrl={effectiveAccount?.profilePictureUrl}
        verified={effectiveAccount?.isVerified}
        onPress={openDetail}
        onPressMore={setOptions}
        onPressInsights={openInsights}
        onPressComments={setCommentsFor}
        onPressPromote={openInsights}
        own={!showFollow}
        active={item.id === activeId}
        viewCount={statsById[item.id]?.views}
        shareCount={statsById[item.id]?.shares}
        likerAvatars={likerAvatars}
        showFollow={showFollow}
      />
    ),
    [effectiveAccount?.profilePictureUrl, effectiveAccount?.isVerified, openDetail, openInsights, statsById, showFollow, activeId, likerAvatars],
  );

  const header = (
    <>
      {simulation ? <SimulationBanner /> : null}
      <StoriesRow stories={stories ?? []} onPressStory={(s) => (s.isSelf ? router.push('/(tabs)/profile') : undefined)} />
    </>
  );

  let body: React.ReactNode;
  if (feed.isLoading) {
    body = (
      <View>
        {header}
        <PostSkeleton />
        <PostSkeleton />
      </View>
    );
  } else if (feed.isError && realMedia.length === 0) {
    body = (
      <ErrorState
        error={feed.error}
        onRetry={() => feed.refetch()}
        onReconnect={() => {
          useAuthStore.getState().markExpired();
        }}
      />
    );
  } else {
    body = (
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title={t('feed.emptyTitle')} body={t('feed.emptyBody')} />}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : (
            <View style={styles.footer} />
          )
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
      />
    );
  }

  return (
    <Screen>
      <AppHeader
        centered={false}
        titleNode={<Wordmark />}
        right={
          <>
            <IconButton accessibilityLabel={t('activity.title')} onPress={() => router.push('/(tabs)/activity')}>
              <HeartIcon color={colors.text} size={26} />
            </IconButton>
            <IconButton accessibilityLabel={t('tabs.messages')} onPress={() => router.push('/(tabs)/activity')}>
              <ShareIcon color={colors.text} size={26} />
            </IconButton>
          </>
        }
      />
      {body}
      <PostOptionsSheet media={options} onClose={() => setOptions(null)} />
      <CommentsSheet media={commentsFor} onClose={() => setCommentsFor(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: spacing.xl, alignItems: 'center' },
});
