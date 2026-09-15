import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/common/AppHeader';
import { IconButton } from '@/components/common/IconButton';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { ChevronDownIcon, LockIcon, MenuIcon, PlusSquareIcon, ReelsIcon, TaggedIcon, ThreadsIcon } from '@/components/icons';
import { HighlightsRow } from '@/components/profile/HighlightsRow';
import { chunkRows, useGridRowRenderer } from '@/components/profile/MediaGrid';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '@/components/profile/ProfileTabs';
import { EngagementBoostSheet } from '@/components/simulation/EngagementBoostEditor';
import { SimulationBadge } from '@/components/simulation/SimulationBadge';
import { spacing } from '@/constants/theme';
import { useContentPerformance } from '@/features/analytics/useContentPerformance';
import { flattenMedia, useAccount, useAccountInsights, useHighlights, useMediaFeed, useRefreshAll, useStories } from '@/features/instagram/hooks';
import { ACCOUNT_SCOPE, useDisplayMetrics, useEffectiveAccount, useEffectiveMedia, useSimulationEnabled, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { MOCK_NOTE } from '@/mocks/mockData';
import type { AppMedia } from '@/types/app';
import { buildDateRange } from '@/utils/date';

/** Instagram profile: + · username ▾ · ≡ / stats / bio / Profesyonel pano / Profili düzenle · Profili paylaş / highlights / grid · reels · tagged */
export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const [tab, setTab] = useState<ProfileTab>('grid');
  const [refreshing, setRefreshing] = useState(false);
  // Long-press on "Profesyonel pano" → the scenario dials for the whole page (followers, every post's views / likes…).
  const [boostOpen, setBoostOpen] = useState(false);
  const simulation = useSimulationEnabled();
  const indicators = useSimulationIndicators();

  const accountQuery = useAccount();
  const feed = useMediaFeed();
  const { data: highlights } = useHighlights();
  const { data: stories } = useStories();
  const range = useMemo(() => buildDateRange('30d'), []);
  const insights = useAccountInsights(range);
  const refreshAll = useRefreshAll();

  const account = accountQuery.data;
  const effectiveAccount = useEffectiveAccount(account);
  const realMedia = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const media = useEffectiveMedia(realMedia, effectiveAccount);
  const performance = useContentPerformance(media, effectiveAccount);
  const viewsById = useMemo(() => Object.fromEntries(performance.items.map((p) => [p.media.id, p.views])), [performance.items]);
  const displayMetrics = useDisplayMetrics(ACCOUNT_SCOPE, insights.data?.metrics);
  const viewsLast30 = displayMetrics.find((m) => m.key === 'views')?.value;

  const visible = useMemo(() => (tab === 'reels' ? media.filter((m) => m.type === 'REEL' || m.type === 'VIDEO') : tab === 'tagged' ? [] : media), [media, tab]);
  const rows = useMemo(() => chunkRows(visible), [visible]);
  const openMedia = useCallback((item: AppMedia) => router.push(`/media/${item.id}`), [router]);
  const renderRow = useGridRowRenderer(openMedia, tab === 'reels', viewsById);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const hasStory = Boolean(stories?.some((s) => s.isSelf && !s.seen)) && account?.source === 'demo';
  // Someone else's public profile is shown as Instagram shows it to a visitor; everything else is "your" profile.
  const own = account?.source !== 'public';

  const listHeader = (
    <View>
      {account && effectiveAccount ? (
        <ProfileHeader
          account={effectiveAccount}
          realAccount={account}
          viewsLast30={viewsLast30}
          hasStory={hasStory}
          own={own}
          note={account.source === 'demo' ? MOCK_NOTE : undefined}
          onPressDashboard={() => router.push('/dashboard')}
          onLongPressDashboard={() => setBoostOpen(true)}
          onPressShare={() => router.push('/share')}
          onPressEditProfile={() => router.push('/simulation/profile')}
        />
      ) : (
        <View style={styles.headerSkeleton}>
          <View style={styles.headerSkeletonRow}>
            <Skeleton width={86} height={86} radius={43} />
            <View style={{ flex: 1, marginLeft: spacing.xl, flexDirection: 'row', justifyContent: 'space-around' }}>
              <Skeleton width={44} height={36} />
              <Skeleton width={44} height={36} />
              <Skeleton width={44} height={36} />
            </View>
          </View>
          <Skeleton width={140} height={14} style={{ marginTop: spacing.lg }} />
          <Skeleton width="80%" height={12} style={{ marginTop: spacing.sm }} />
          <Skeleton width="100%" height={32} style={{ marginTop: spacing.lg }} />
        </View>
      )}
      {highlights && highlights.length > 0 ? <HighlightsRow highlights={highlights} showNew /> : <HighlightsRow highlights={[]} showNew />}
      <ProfileTabs value={tab} onChange={setTab} />
    </View>
  );

  const renderEmpty = () => {
    if (tab === 'tagged') {
      return <EmptyState title={t('profile.taggedTitle')} body={t('profile.taggedBody')} icon={<TaggedIcon color={colors.text} size={34} strokeWidth={1.4} />} compact />;
    }
    if (account?.isPrivate) {
      return <EmptyState title={t('profile.privateTitle')} body={t('profile.privateBody')} icon={<LockIcon color={colors.text} size={32} strokeWidth={1.5} />} compact />;
    }
    if (feed.isLoading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      );
    }
    if (feed.isError) {
      return <ErrorState error={feed.error} onRetry={() => feed.refetch()} compact />;
    }
    return (
      <EmptyState
        title={tab === 'reels' ? t('profile.noReelsTitle') : t('profile.noPostsTitle')}
        icon={tab === 'reels' ? <ReelsIcon color={colors.text} size={32} strokeWidth={1.5} /> : undefined}
        compact
        actionLabel={simulation ? t('sim.addPost') : undefined}
        onAction={simulation ? () => router.push('/simulation/new-post') : undefined}
      />
    );
  };

  return (
    <Screen>
      <AppHeader
        left={
          <IconButton accessibilityLabel={t('tabs.create')} onPress={() => router.push('/create')}>
            <PlusSquareIcon color={colors.text} size={26} />
          </IconButton>
        }
        titleNode={
          <Pressable onPress={() => router.push('/(auth)/connect')} style={styles.usernameRow} accessibilityRole="button" accessibilityLabel={effectiveAccount?.username ?? ''}>
            <Text variant="heading" weight="700" numberOfLines={1} style={{ maxWidth: 200 }}>
              {effectiveAccount?.username ?? ''}
            </Text>
            <ChevronDownIcon size={16} color={colors.text} />
          </Pressable>
        }
        right={
          <>
            {indicators ? <SimulationBadge style={{ marginRight: spacing.xs }} /> : null}
            {own && effectiveAccount ? (
              <IconButton accessibilityLabel={t('profile.threads')} onPress={() => void Linking.openURL(`https://www.threads.net/@${effectiveAccount.username}`)}>
                <ThreadsIcon color={colors.text} size={26} />
              </IconButton>
            ) : null}
            <IconButton accessibilityLabel={t('settings.title')} onPress={() => router.push('/settings')}>
              <MenuIcon color={colors.text} size={26} />
            </IconButton>
          </>
        }
      />
      {accountQuery.isError && !account ? (
        <ErrorState error={accountQuery.error} onRetry={() => accountQuery.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.map((m) => m.id).join('-')}
          renderItem={({ item }) => renderRow(item)}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmpty()}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : (
              <View style={{ height: spacing.xxl }} />
            )
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.8}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          windowSize={9}
          removeClippedSubviews
        />
      )}
      <EngagementBoostSheet visible={boostOpen} onClose={() => setBoostOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerSkeleton: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerSkeletonRow: { flexDirection: 'row', alignItems: 'center' },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
});
