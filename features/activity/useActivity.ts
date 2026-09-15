import { useMemo } from 'react';

import { flattenMedia, useAccount, useAccountInsights, useMediaFeed, useSession } from '@/features/instagram/hooks';
import { useActiveScenario } from '@/features/simulation/useSimulation';
import { buildMockActivity } from '@/mocks/mockData';
import { countBoosts } from '@/services/simulation/boost';
import { useSettingsStore } from '@/store/settingsStore';
import { useSimulationStore } from '@/store/simulationStore';
import type { AppActivityItem } from '@/types/app';
import { metricValue } from '@/types/app';
import { buildDateRange } from '@/utils/date';

/**
 * Activity feed. Demo uses the rich mock feed; other sources only show events
 * that can be derived from real data (never fabricated likes/comments).
 */
export function useActivity(): { items: AppActivityItem[]; isLoading: boolean } {
  const session = useSession();
  const { data: account, isLoading: accountLoading } = useAccount();
  const feed = useMediaFeed();
  const range = useMemo(() => buildDateRange('30d'), []);
  const insights = useAccountInsights(range);
  const scenario = useActiveScenario();
  const lastChangedAt = useSimulationStore((s) => s.lastChangedAt);
  const showScenarioEvents = useSettingsStore((s) => s.showSimulationBadge);

  const items = useMemo<AppActivityItem[]>(() => {
    const out: AppActivityItem[] = [];
    if (!session) return out;
    if (
      showScenarioEvents &&
      lastChangedAt &&
      scenario &&
      (Object.keys(scenario.overrides).length > 0 || (scenario.growthPercent ?? 0) !== 0 || countBoosts(scenario.boosts) > 0)
    ) {
      out.push({ id: 'sim-change', kind: 'simulation', title: scenario.name, timestamp: lastChangedAt, route: '/simulation' });
    }
    if (session.source === 'demo') {
      return [...out, ...buildMockActivity()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    if (account?.lastSyncAt) {
      out.push({ id: 'sync', kind: 'sync', title: 'sync', subtitle: session.source, timestamp: account.lastSyncAt, avatarUrl: account.profilePictureUrl });
    }
    const media = flattenMedia(feed.data?.pages);
    const top = [...media].sort((a, b) => b.likeCount - a.likeCount)[0];
    if (top) {
      out.push({ id: 'top', kind: 'milestone', title: 'topPost', timestamp: top.timestamp, mediaThumbnailUrl: top.thumbnailUrl, route: `/media/${top.id}` });
    }
    if (insights.data) {
      const newFollowers = metricValue(insights.data.metrics, 'new_followers');
      if (newFollowers > 0) {
        out.push({ id: 'followers', kind: 'follow', title: 'newFollowers', subtitle: String(Math.round(newFollowers / 4)), timestamp: new Date(Date.now() - 6 * 3_600_000).toISOString(), avatarUrl: account?.profilePictureUrl });
      }
      const reach = metricValue(insights.data.metrics, 'reach');
      const milestone = [1_000_000, 500_000, 200_000, 100_000, 50_000, 10_000, 1_000].find((m) => reach >= m);
      if (milestone) {
        out.push({ id: 'reach', kind: 'milestone', title: 'reach', subtitle: String(milestone), timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString() });
      }
    }
    if (media.length >= 3) {
      out.push({ id: 'reco', kind: 'recommendation', title: 'recommendation', timestamp: new Date(Date.now() - 3 * 86_400_000).toISOString(), route: '/growth' });
    }
    return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [session, account, feed.data, insights.data, scenario, lastChangedAt, showScenarioEvents]);

  return { items, isLoading: accountLoading || feed.isLoading };
}
