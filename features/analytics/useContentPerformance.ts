import { useMemo } from 'react';

import { useMediaInsightsBatch } from '@/features/instagram/hooks';
import {
  mediaScope,
  resolveWithGrowth,
  syntheticInsightForSimulated,
  useBoosts,
  useGrowthPercent,
  useOverrides,
  useSimulationEnabled,
} from '@/features/simulation/useSimulation';
import { buildPerformance, type ContentPerformance } from '@/services/analytics/content';
import { estimateReposts } from '@/services/analytics/postInsights';
import { useSettingsStore } from '@/store/settingsStore';
import type { AppAccount, AppMedia, AppMediaInsight } from '@/types/app';
import { overrideKey, type BoostMap, type OverrideKey } from '@/types/simulation';

/** Applies per-post overrides, the engagement dials and the scenario growth rate to an insight (returns a new object; never mutates). */
export function applyMediaOverrides(
  insight: AppMediaInsight | undefined,
  overrides: Record<OverrideKey, number>,
  enabled: boolean,
  growthPercent = 0,
  boosts?: BoostMap,
): AppMediaInsight | undefined {
  if (!insight || !enabled) return insight;
  const scope = mediaScope(insight.mediaId);
  let changed = false;
  // Reposts get their own seed like every other metric, so the content tab and the
  // post-insights screen resolve them to the same number.
  const base = insight.metrics.some((m) => m.key === 'reposts')
    ? insight.metrics
    : [...insight.metrics, { key: 'reposts' as const, value: estimateReposts(insight.mediaId, insight.metrics.find((m) => m.key === 'shares')?.value ?? 0), source: 'estimated' as const }];
  const metrics = base.map((m) => {
    const resolved = resolveWithGrowth(scope, m.key, m.value, overrides, enabled, growthPercent, boosts);
    if (!resolved.isSimulated) return m;
    changed = true;
    return { ...m, value: resolved.displayValue, source: 'manual' as const };
  });
  if (!changed) return insight;
  // Keep interactions consistent when its components moved but it was not edited explicitly.
  const interactionsEdited = overrides[overrideKey(scope, 'interactions')] !== undefined;
  const withTotals = interactionsEdited
    ? metrics
    : metrics.map((m) => {
        if (m.key !== 'interactions') return m;
        const sum = ['likes', 'comments', 'saves', 'shares'].reduce((acc, key) => acc + (metrics.find((x) => x.key === key)?.value ?? 0), 0);
        return sum > 0 ? { ...m, value: sum } : m;
      });
  return { ...insight, metrics: withTotals };
}

interface Options {
  /** false → real data only (Growth Lab). */
  applySimulation?: boolean;
  /** true → preview the active scenario even while the switch is off (Compare). */
  forceSimulation?: boolean;
}

export function useContentPerformance(media: readonly AppMedia[], account: AppAccount | undefined, options: Options = {}) {
  const applySimulation = options.applySimulation ?? true;
  const ids = useMemo(() => media.filter((m) => !m.isSimulated).map((m) => m.id), [media]);
  const batch = useMediaInsightsBatch(ids);
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const boosts = useBoosts();
  const switchOn = useSimulationEnabled();
  const enabled = (switchOn || options.forceSimulation === true) && applySimulation;
  const formula = useSettingsStore((s) => s.engagementFormula);
  const followers = account?.followersCount ?? 0;

  const items = useMemo<ContentPerformance[]>(() => {
    const denominator = (perf: { reach: number }) => (formula === 'reach' ? perf.reach : followers);
    return media.map((m) => {
      if (m.isSimulated) {
        return buildPerformance(m, applyMediaOverrides(syntheticInsightForSimulated(m), overrides, enabled, growth, boosts), denominator);
      }
      return buildPerformance(m, applyMediaOverrides(batch.byId[m.id], overrides, enabled, growth, boosts), denominator);
    });
  }, [media, batch.byId, overrides, enabled, growth, boosts, formula, followers]);

  const insightsById = useMemo(() => {
    const out: Record<string, AppMediaInsight | undefined> = {};
    for (const id of ids) out[id] = applyMediaOverrides(batch.byId[id], overrides, enabled, growth, boosts);
    return out;
  }, [ids, batch.byId, overrides, enabled, growth, boosts]);

  return { items, insightsById, isLoading: batch.isLoading, isFetched: batch.isFetched };
}
