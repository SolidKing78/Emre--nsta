import { useMemo } from 'react';

import { useAudience } from '@/features/instagram/hooks';
import { useAccountStats, useAudienceMix, useMediaAudienceMixMap } from '@/features/simulation/useSimulation';
import { accountGenderSplit, clampPercent, followerSplitFor, genderSplitFor, type FollowerSplit, type GenderSplit } from '@/services/analytics/audienceMix';
import { applyBucketOverrides } from '@/services/analytics/reelInsights';
import type { AppAudience, AudienceBucket } from '@/types/app';
import type { MediaStatOverrides } from '@/types/simulation';

/**
 * The audience every stats screen reads.
 *
 * Whatever the provider returned keeps its active hours; the two splits the user controls —
 * followers vs non-followers and women vs men — always come from the configured mix, and the
 * age / city / country bars honour anything set by hand on the account insights screen. So
 * the account screens and the per-post screens never disagree.
 */
export function useEffectiveAudience(): AppAudience | null {
  const query = useAudience();
  const mix = useAudienceMix();
  const stats = useAccountStats();
  const audience = query.data ?? null;
  return useMemo(() => {
    if (!audience) return null;
    return {
      ...audience,
      followerShare: clampPercent(mix.followerShare) / 100,
      gender: accountGenderSplit(mix),
      ages: withOverrides(audience.ages, 'age', stats),
      cities: withOverrides(audience.cities, 'city', stats),
      countries: withOverrides(audience.countries, 'country', stats),
    };
  }, [audience, mix, stats]);
}

/** Bars keep summing to 100 after a hand-set value: the rest are shared out again. */
function withOverrides(buckets: readonly AudienceBucket[], group: string, stats: MediaStatOverrides): AudienceBucket[] {
  const applied = applyBucketOverrides(
    buckets.map((b) => ({ key: b.label, label: b.label, percent: b.value })),
    group,
    stats,
  );
  return applied.map((b) => ({ label: b.label, value: b.percent }));
}

/** Which account-level bars the user pinned, so a screen can mark them. */
export function useIsAccountBucketCustom(): (group: string, label: string) => boolean {
  const stats = useAccountStats();
  return useMemo(() => (group: string, label: string) => stats[`${group}.${label}`] !== undefined, [stats]);
}

export interface PostAudienceSplits extends FollowerSplit, GenderSplit {
  /** True while this post's follower split was set by hand rather than derived from the mix. */
  followerIsCustom: boolean;
  genderIsCustom: boolean;
}

/** The follower and gender splits for one post: the mix, drifted per post unless set by hand. */
export function usePostAudienceSplits(mediaId: string | undefined): PostAudienceSplits {
  const mix = useAudienceMix();
  const perMedia = useMediaAudienceMixMap();
  return useMemo(() => {
    const id = mediaId ?? '';
    const override = perMedia[id];
    return {
      ...followerSplitFor(id, mix, override),
      ...genderSplitFor(id, mix, override),
      followerIsCustom: override?.followerShare !== undefined,
      genderIsCustom: override?.womenShare !== undefined,
    };
  }, [mediaId, mix, perMedia]);
}
