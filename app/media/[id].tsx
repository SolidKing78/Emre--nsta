import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ViewToken } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { PostSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { CommentsSheet } from '@/components/feed/CommentsSheet';
import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { SimulationBadge } from '@/components/simulation/SimulationBadge';
import { spacing } from '@/constants/theme';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useMediaFeed, useSession } from '@/features/instagram/hooks';
import { useMediaDetail } from '@/features/instagram/useMediaDetail';
import { useEffectiveAccount, useEffectiveMedia, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useT } from '@/i18n';
import { mockStories } from '@/mocks/mockData';
import type { AppMedia } from '@/types/app';

// "Covers at least 40% of the screen" — works for tall reels on small phones and short landscape posts alike.
const VIEWABILITY = { viewAreaCoveragePercentThreshold: 40, minimumViewTime: 80 };

/**
 * Instagram "Gönderiler": the tapped post at the top, older posts below, each with
 * the "👁 N · İstatistikleri gör" row and the promote button. Only the post on
 * screen plays its video. Insights open their own screen (Gönderi istatistikleri).
 */
export default function PostsScreen() {
  const { id, insights: insightsParam } = useLocalSearchParams<{ id: string; insights?: string }>();
  const router = useRouter();
  const t = useT();
  const session = useSession();
  const indicators = useSimulationIndicators();
  const [options, setOptions] = useState<AppMedia | null>(null);
  const [commentsFor, setCommentsFor] = useState<AppMedia | null>(null);
  const [promoteFor, setPromoteFor] = useState<AppMedia | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>(id);

  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const feed = useMediaFeed();
  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  // Fallback for posts the feed has not loaded (deep links) — the list then holds just that post.
  const detail = useMediaDetail(id);

  const list = useMemo<AppMedia[]>(() => {
    const index = media.findIndex((m) => m.id === id);
    if (index >= 0) return media.slice(index);
    return detail.media ? [detail.media] : [];
  }, [media, id, detail.media]);

  const performance = useContentPerformance(list, effectiveAccount);
  const statsById = useMemo(() => Object.fromEntries(performance.items.map((p) => [p.media.id, { views: p.views, shares: p.shares }])), [performance.items]);
  // Likers are only shown where the source has real people behind them (the demo data set).
  const likerAvatars = useMemo(() => (session?.source === 'demo' ? mockStories.filter((s) => !s.isSelf).slice(0, 3).map((s) => s.avatarUrl) : undefined), [session?.source]);

  // Older links used `?insights=1` on this screen; the insights now live on their own screen.
  useEffect(() => {
    if (insightsParam && id) router.push(`/insights/post/${id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kept in state so the pair never changes identity (FlatList forbids that), even across Fast Refresh.
  const [viewabilityConfigCallbackPairs] = useState(() => [
    {
      viewabilityConfig: VIEWABILITY,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<AppMedia>[] }) => {
        const first = viewableItems.find((v) => v.isViewable);
        if (first?.item) setActiveId(first.item.id);
      },
    },
  ]);

  const openInsights = useCallback((item: AppMedia) => router.push(`/insights/post/${item.id}`), [router]);

  const renderItem = useCallback(
    ({ item }: { item: AppMedia }) => (
      <PostCard
        media={item}
        avatarUrl={effectiveAccount?.profilePictureUrl}
        verified={effectiveAccount?.isVerified}
        own
        active={item.id === activeId}
        viewCount={statsById[item.id]?.views}
        shareCount={statsById[item.id]?.shares}
        likerAvatars={likerAvatars}
        onPressMore={setOptions}
        onPressComments={setCommentsFor}
        onPressInsights={openInsights}
        onPressPromote={setPromoteFor}
      />
    ),
    [effectiveAccount?.profilePictureUrl, effectiveAccount?.isVerified, activeId, statsById, likerAvatars, openInsights],
  );

  const first = list[0];
  const title = first?.type === 'REEL' ? t('feed.reel') : t('media.title');

  if (detail.error && list.length === 0) {
    return (
      <Screen>
        <AppHeader title={title} showBack centered={false} />
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={title} showBack centered={false} right={indicators ? <SimulationBadge style={{ marginRight: spacing.sm }} /> : undefined} />
      {list.length === 0 ? (
        <PostSkeleton />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        />
      )}

      <PostOptionsSheet media={options} onClose={() => setOptions(null)} />
      <CommentsSheet media={commentsFor} onClose={() => setCommentsFor(null)} />

      <BottomSheet visible={Boolean(promoteFor)} onClose={() => setPromoteFor(null)} title={t('media.promote')}>
        <View style={styles.promote}>
          <Text variant="title">{t('dashboard.igOnlyTitle')}</Text>
          <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
            {t('media.promoteBody')}
          </Text>
          <Button
            title={t('dashboard.openInstagram')}
            variant="secondary"
            onPress={() => {
              const url = promoteFor?.permalink || 'https://www.instagram.com/';
              setPromoteFor(null);
              void Linking.openURL(url);
            }}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Instagram puts only air between posts under "Gönderiler" — no divider line.
  separator: { height: spacing.sm },
  promote: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
