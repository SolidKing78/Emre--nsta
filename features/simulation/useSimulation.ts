import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useAccountKey, useSession } from '@/features/instagram/hooks';
import { boostPercentFor } from '@/services/simulation/boost';
import { resolveMetric, type ResolvedMetric } from '@/services/simulation/resolve';
import { useSettingsStore } from '@/store/settingsStore';
import {
  countPostEdits,
  EMPTY_OVERRIDES,
  EMPTY_PROFILE_OVERRIDES,
  EMPTY_SIMULATED_MEDIA,
  selectActiveProfile,
  selectAudienceMix,
  selectBoosts,
  selectGrowthPercent,
  selectAccountStats,
  selectMediaAudienceMix,
  selectMediaStats,
  useSimulationStore,
} from '@/store/simulationStore';
import type { AppAccount, AppMedia, AppMediaInsight, AppMetric, MetricKey } from '@/types/app';
import {
  overrideKey,
  type AudienceMix,
  type BoostKey,
  type BoostMap,
  type MediaAudienceMix,
  type MediaAudienceMixMap,
  type MediaStatOverrides,
  type OverrideKey,
  type ProfileOverrides,
  type SimulatedMedia,
  type SimulationProfile,
  type SimulationScope,
} from '@/types/simulation';

export const ACCOUNT_SCOPE: SimulationScope = { kind: 'account' };

export function mediaScope(mediaId: string): SimulationScope {
  return { kind: 'media', mediaId };
}

/** Seed for per-post deviation; account-level metrics get none (undefined). */
export function growthSeed(scope: SimulationScope, metric: MetricKey): string | undefined {
  return scope.kind === 'media' ? `${scope.mediaId}:${metric}` : undefined;
}

export function useSimulationEnabled(): boolean {
  return useSimulationStore((s) => s.enabled);
}

/**
 * Whether simulation UI markers (badges, banners, purple accents, edit icons) should render.
 * Off by default: scenario values look exactly like the real Instagram UI.
 */
export function useSimulationIndicators(): boolean {
  const enabled = useSimulationEnabled();
  const show = useSettingsStore((s) => s.showSimulationBadge);
  return enabled && show;
}

export function useOverrides(): Record<OverrideKey, number> {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => {
    const account = s.accounts[accountKey];
    if (!account) return EMPTY_OVERRIDES;
    return selectActiveProfile(s, accountKey).overrides;
  });
}

export function useGrowthPercent(): number {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => selectGrowthPercent(s, accountKey));
}

/** "Etkileşimi artır" dials of the active scenario (empty object when none). */
export function useBoosts(): BoostMap {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => selectBoosts(s, accountKey));
}

export function useActiveScenario(): SimulationProfile | null {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => (s.accounts[accountKey] ? selectActiveProfile(s, accountKey) : null));
}

export function useScenarios(): SimulationProfile[] {
  const accountKey = useAccountKey();
  return useSimulationStore(useShallow((s) => s.accounts[accountKey]?.profiles ?? []));
}

export function useSimulatedMedia(): readonly SimulatedMedia[] {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => s.accounts[accountKey]?.simulatedMedia ?? EMPTY_SIMULATED_MEDIA);
}

/** Account-wide follower / non-follower and women / men splits. */
export function useAudienceMix(): AudienceMix {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => selectAudienceMix(s, accountKey));
}

/** Hand-set audience splits, by media id. */
export function useMediaAudienceMixMap(): MediaAudienceMixMap {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => selectMediaAudienceMix(s, accountKey));
}

/** Hand-set percentages on one post's insights screen (empty object when none). */
export function useMediaStats(mediaId: string | undefined): MediaStatOverrides {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => selectMediaStats(s, accountKey, mediaId ?? ''));
}

/**
 * How many values the user pinned on a post — its numbers, its audience split and its
 * percentages. Subscribing to the whole account slice is deliberate: the count has to move
 * the moment any of the three does.
 */
export function usePostEditCount(): (mediaId: string) => number {
  const accountKey = useAccountKey();
  const account = useSimulationStore((s) => s.accounts[accountKey]);
  return useCallback(
    (mediaId: string) => (account ? countPostEdits(useSimulationStore.getState(), accountKey, mediaId) : 0),
    [account, accountKey],
  );
}

/** Hand-set percentages on the account insights screen. */
export function useAccountStats(): MediaStatOverrides {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => selectAccountStats(s, accountKey));
}

export function useProfileOverrides(): ProfileOverrides {
  const accountKey = useAccountKey();
  return useSimulationStore((s) => s.accounts[accountKey]?.profileOverrides ?? EMPTY_PROFILE_OVERRIDES);
}

/** Bound actions for the current account. */
export function useSimulationActions() {
  const accountKey = useAccountKey();
  const store = useSimulationStore;
  return useMemo(
    () => ({
      accountKey,
      setEnabled: (enabled: boolean) => store.getState().setEnabled(enabled),
      toggle: () => store.getState().toggle(),
      setOverride: (scope: SimulationScope, metric: MetricKey, value: number) =>
        store.getState().setOverride(accountKey, scope, metric, value),
      clearOverride: (scope: SimulationScope, metric: MetricKey) => store.getState().clearOverride(accountKey, scope, metric),
      resetAll: () => store.getState().resetAll(accountKey),
      setGrowthPercent: (percent: number) => store.getState().setGrowthPercent(accountKey, percent),
      setBoost: (key: BoostKey, percent: number) => store.getState().setBoost(accountKey, key, percent),
      setBoosts: (boosts: BoostMap) => store.getState().setBoosts(accountKey, boosts),
      clearBoosts: () => store.getState().clearBoosts(accountKey),
      applyFactor: (entries: { scope: SimulationScope; metric: MetricKey; realValue: number }[], factor: number) =>
        store
          .getState()
          .applyFactorToKeys(
            accountKey,
            entries.map((e) => ({ key: overrideKey(e.scope, e.metric), realValue: e.realValue })),
            factor,
          ),
      createScenario: (name: string) => store.getState().createProfile(accountKey, name),
      renameScenario: (id: string, name: string) => store.getState().renameProfile(accountKey, id, name),
      duplicateScenario: (id: string) => store.getState().duplicateProfile(accountKey, id),
      deleteScenario: (id: string) => store.getState().deleteProfile(accountKey, id),
      setActiveScenario: (id: string) => store.getState().setActiveProfile(accountKey, id),
      addSimulatedMedia: (media: SimulatedMedia) => store.getState().addSimulatedMedia(accountKey, media),
      updateSimulatedMedia: (id: string, patch: Partial<SimulatedMedia>) =>
        store.getState().updateSimulatedMedia(accountKey, id, patch),
      removeSimulatedMedia: (id: string) => store.getState().removeSimulatedMedia(accountKey, id),
      setProfileOverrides: (patch: ProfileOverrides) => store.getState().setProfileOverrides(accountKey, patch),
      clearProfileOverrides: () => store.getState().clearProfileOverrides(accountKey),
      setAudienceMix: (patch: Partial<AudienceMix>) => store.getState().setAudienceMix(accountKey, patch),
      resetAudienceMix: () => store.getState().resetAudienceMix(accountKey),
      setMediaAudienceMix: (mediaId: string, patch: MediaAudienceMix) => store.getState().setMediaAudienceMix(accountKey, mediaId, patch),
      clearMediaAudienceMix: (mediaId: string) => store.getState().clearMediaAudienceMix(accountKey, mediaId),
      setMediaStat: (mediaId: string, key: string, value: number | undefined) => store.getState().setMediaStat(accountKey, mediaId, key, value),
      clearMediaStats: (mediaId: string) => store.getState().clearMediaStats(accountKey, mediaId),
      setAccountStat: (key: string, value: number | undefined) => store.getState().setAccountStat(accountKey, key, value),
      clearAccountStats: () => store.getState().clearAccountStats(accountKey),
    }),
    [accountKey, store],
  );
}

/* ------------------------------------------------------------------ */
/* Display-value resolution                                             */
/* ------------------------------------------------------------------ */

export function resolveWithGrowth(
  scope: SimulationScope,
  metric: MetricKey,
  realValue: number,
  overrides: Record<OverrideKey, number>,
  enabled: boolean,
  growthPercent: number,
  boosts?: BoostMap,
): ResolvedMetric {
  return resolveMetric(realValue, overrides[overrideKey(scope, metric)], enabled, {
    percent: growthPercent,
    metric,
    seed: growthSeed(scope, metric),
    boostPercent: boostPercentFor(boosts, scope, metric, growthPercent),
  });
}

export function useDisplayValue(scope: SimulationScope, metric: MetricKey, realValue: number): ResolvedMetric {
  const enabled = useSimulationEnabled();
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const boosts = useBoosts();
  return useMemo(
    () => resolveWithGrowth(scope, metric, realValue, overrides, enabled, growth, boosts),
    [enabled, overrides, growth, boosts, scope, metric, realValue],
  );
}

export interface DisplayMetric extends AppMetric {
  realValue: number;
  isSimulated: boolean;
}

/** Applies the overlay to a list of metrics. Series are scaled proportionally so charts follow the scenario. */
export function useDisplayMetrics(scope: SimulationScope, metrics: readonly AppMetric[] | undefined): DisplayMetric[] {
  const enabled = useSimulationEnabled();
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const boosts = useBoosts();
  return useMemo(() => {
    if (!metrics) return [];
    return metrics.map((metric) => {
      const resolved = resolveWithGrowth(scope, metric.key, metric.value, overrides, enabled, growth, boosts);
      const ratio = metric.value > 0 ? resolved.displayValue / metric.value : 1;
      const series =
        resolved.isSimulated && metric.series
          ? metric.series.map((p) => ({ date: p.date, value: Math.round(p.value * ratio) }))
          : metric.series;
      return {
        ...metric,
        value: resolved.displayValue,
        series,
        realValue: metric.value,
        isSimulated: resolved.isSimulated,
        source: resolved.isSimulated ? ('manual' as const) : metric.source,
      };
    });
  }, [metrics, overrides, enabled, growth, boosts, scope]);
}

/** Account with profile edits + count overrides / growth applied (only while simulation is on). */
export function useEffectiveAccount(account: AppAccount | undefined): AppAccount | undefined {
  const enabled = useSimulationEnabled();
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const boosts = useBoosts();
  const profile = useProfileOverrides();
  return useMemo(() => {
    if (!account || !enabled) return account;
    const pick = (metric: MetricKey, real: number) => resolveWithGrowth(ACCOUNT_SCOPE, metric, real, overrides, true, growth, boosts).displayValue;
    return {
      ...account,
      name: profile.name ?? account.name,
      biography: profile.biography ?? account.biography,
      website: profile.website ?? account.website,
      category: profile.category ?? account.category,
      profilePictureUrl: profile.profilePictureUri ?? account.profilePictureUrl,
      isVerified: profile.isVerified ?? account.isVerified,
      followersCount: pick('followers', account.followersCount),
      followsCount: pick('following', account.followsCount),
      mediaCount: pick('media_count', account.mediaCount),
    };
  }, [account, enabled, overrides, growth, boosts, profile]);
}

export function simulatedToAppMedia(item: SimulatedMedia, username: string, avatar?: string): AppMedia {
  return {
    id: item.id,
    type: item.type,
    permalink: '',
    mediaUrl: item.localUri,
    thumbnailUrl: item.localUri,
    caption: item.caption,
    timestamp: item.timestamp,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    viewCount: item.viewCount,
    username,
    ownerAvatarUrl: avatar,
    aspectRatio: item.type === 'REEL' || item.type === 'VIDEO' ? 9 / 16 : 4 / 5,
    isSimulated: true,
    source: 'manual',
  };
}

/** Simulated posts have no source insights: derive a consistent set from their own counts. */
export function syntheticInsightForSimulated(media: AppMedia): AppMediaInsight {
  const views = media.viewCount ?? media.likeCount * 12;
  const saves = Math.round(media.likeCount * 0.08);
  const shares = Math.round(media.likeCount * 0.03);
  return {
    mediaId: media.id,
    source: 'manual',
    metrics: [
      { key: 'views', value: views, source: 'manual' },
      { key: 'reach', value: Math.round(views * 0.8), source: 'manual' },
      { key: 'likes', value: media.likeCount, source: 'manual' },
      { key: 'comments', value: media.commentCount, source: 'manual' },
      { key: 'shares', value: shares, source: 'manual' },
      { key: 'saves', value: saves, source: 'manual' },
      { key: 'interactions', value: media.likeCount + media.commentCount + saves + shares, source: 'manual' },
    ],
  };
}

/**
 * Media list with per-post overrides / growth applied and simulated posts merged in
 * (only while simulation is on). Real items are never mutated — new objects are returned.
 */
export function useEffectiveMedia(media: AppMedia[], account?: AppAccount): AppMedia[] {
  const enabled = useSimulationEnabled();
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const boosts = useBoosts();
  const simulated = useSimulatedMedia();
  const session = useSession();
  return useMemo(() => {
    if (!enabled) return media;
    const apply = (item: AppMedia): AppMedia => {
      const scope = mediaScope(item.id);
      const likes = resolveWithGrowth(scope, 'likes', item.likeCount, overrides, true, growth, boosts);
      const comments = resolveWithGrowth(scope, 'comments', item.commentCount, overrides, true, growth, boosts);
      const views = item.viewCount !== undefined ? resolveWithGrowth(scope, 'views', item.viewCount, overrides, true, growth, boosts) : undefined;
      if (!likes.isSimulated && !comments.isSimulated && !views?.isSimulated) return item;
      return {
        ...item,
        likeCount: likes.displayValue,
        commentCount: comments.displayValue,
        viewCount: views ? views.displayValue : item.viewCount,
      };
    };
    const applied = media.map(apply);
    if (simulated.length === 0) return applied;
    // Scenario posts follow the dials / growth rate too, so the feed and the insights agree.
    const username = account?.username ?? session?.username ?? '';
    const extras = simulated.map((s) => apply(simulatedToAppMedia(s, username, account?.profilePictureUrl)));
    return [...extras, ...applied].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [media, enabled, overrides, growth, boosts, simulated, account, session]);
}

/** Convenience for screens that need to know whether a metric is overridden explicitly. */
export function useIsOverridden() {
  const overrides = useOverrides();
  const enabled = useSimulationEnabled();
  return useCallback(
    (scope: SimulationScope, metric: MetricKey) => enabled && overrides[overrideKey(scope, metric)] !== undefined,
    [overrides, enabled],
  );
}
