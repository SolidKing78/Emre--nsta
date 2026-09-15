import { useMemo } from 'react';

import { applyMediaOverrides } from '@/features/analytics/useContentPerformance';
import { useAccount, useMediaById, useMediaInsights } from '@/features/instagram/hooks';
import {
  mediaScope,
  simulatedToAppMedia,
  syntheticInsightForSimulated,
  useBoosts,
  useEffectiveAccount,
  useEffectiveMedia,
  useGrowthPercent,
  useOverrides,
  useSimulatedMedia,
  useSimulationEnabled,
} from '@/features/simulation/useSimulation';
import type { AppMedia, AppMediaInsight } from '@/types/app';
import { AppError } from '@/types/errors';

/**
 * Media + insights for the detail screens, transparently handling simulated posts
 * (which exist only in the overlay) and applying simulation overrides.
 */
export function useMediaDetail(id: string | undefined) {
  const simulated = useSimulatedMedia();
  const simulatedItem = useMemo(() => simulated.find((s) => s.id === id), [simulated, id]);
  const { data: account } = useAccount();
  const effectiveAccount = useEffectiveAccount(account);
  const overrides = useOverrides();
  const growth = useGrowthPercent();
  const boosts = useBoosts();
  const enabled = useSimulationEnabled();

  const mediaQuery = useMediaById(simulatedItem ? undefined : id);
  const insightsQuery = useMediaInsights(simulatedItem ? undefined : id);

  const realMedia = useMemo<AppMedia | undefined>(() => {
    if (simulatedItem) return simulatedToAppMedia(simulatedItem, effectiveAccount?.username ?? '', effectiveAccount?.profilePictureUrl);
    return mediaQuery.data;
  }, [simulatedItem, mediaQuery.data, effectiveAccount]);

  const effectiveList = useEffectiveMedia(realMedia && !simulatedItem ? [realMedia] : [], effectiveAccount);
  const media = simulatedItem ? realMedia : effectiveList.find((m) => m.id === id) ?? realMedia;

  const realInsight = simulatedItem && realMedia ? syntheticInsightForSimulated(realMedia) : insightsQuery.data;
  const insight = useMemo<AppMediaInsight | undefined>(
    () => applyMediaOverrides(realInsight, overrides, enabled, growth, boosts),
    [realInsight, overrides, enabled, growth, boosts],
  );

  const isLoading = simulatedItem ? false : mediaQuery.isLoading;
  const error = simulatedItem ? undefined : mediaQuery.error ?? (!id ? new AppError('not_found') : undefined);
  const scope = useMemo(() => mediaScope(id ?? ''), [id]);

  return {
    media,
    realMedia,
    insight,
    realInsight,
    account: effectiveAccount,
    realAccount: account,
    isLoading,
    insightsLoading: simulatedItem ? false : insightsQuery.isLoading,
    insightsError: simulatedItem ? undefined : insightsQuery.error,
    error,
    scope,
    isSimulatedPost: Boolean(simulatedItem),
    refetch: () => {
      void mediaQuery.refetch();
      void insightsQuery.refetch();
    },
  };
}
