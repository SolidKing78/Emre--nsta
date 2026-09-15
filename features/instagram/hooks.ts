import {
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { CACHE_TIMES } from '@/constants/config';
import { getInstagramProvider, invalidateProvider } from '@/services/instagram/providerFactory';
import { useAuthStore, type AppSession } from '@/store/authStore';
import type {
  AppAccount,
  AppAudience,
  AppComment,
  AppHighlight,
  AppInsight,
  AppMedia,
  AppMediaInsight,
  AppStory,
  DateRange,
  PaginatedMedia,
} from '@/types/app';
import { isAppError } from '@/types/errors';

/* ------------------------------------------------------------------ */
/* Session helpers                                                      */
/* ------------------------------------------------------------------ */

export function useSession(): AppSession | null {
  return useAuthStore((s) => s.session);
}

export function useAccountKey(): string {
  return useAuthStore((s) => s.session?.accountKey ?? 'none');
}

function useProvider() {
  const session = useSession();
  return useMemo(() => (session ? getInstagramProvider(session) : null), [session]);
}

/** Live sessions whose token died must bounce to the reconnect screen. */
function handleAuthError(err: unknown): void {
  if (isAppError(err) && err.code === 'auth_expired') {
    const store = useAuthStore.getState();
    if (store.session?.source === 'live') store.markExpired();
  }
}

function retryPolicy(failureCount: number, error: unknown): boolean {
  if (isAppError(error) && !error.retryable) return false;
  return failureCount < 1;
}

/* ------------------------------------------------------------------ */
/* Query keys                                                           */
/* ------------------------------------------------------------------ */

export const queryKeys = {
  account: (key: string) => ['account', key] as const,
  media: (key: string) => ['media', key] as const,
  mediaById: (key: string, id: string) => ['media', key, id] as const,
  insights: (key: string, range: DateRange) => ['insights', key, range.since, range.until] as const,
  mediaInsights: (key: string, id: string) => ['mediaInsights', key, id] as const,
  stories: (key: string) => ['stories', key] as const,
  highlights: (key: string) => ['highlights', key] as const,
  comments: (key: string, id: string) => ['comments', key, id] as const,
  audience: (key: string) => ['audience', key] as const,
};

/* ------------------------------------------------------------------ */
/* Queries                                                              */
/* ------------------------------------------------------------------ */

export function useAccount() {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppAccount, Error>({
    queryKey: queryKeys.account(accountKey),
    queryFn: async () => {
      if (!provider) throw new Error('No provider');
      try {
        return await provider.getAccount();
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    enabled: Boolean(provider),
    staleTime: CACHE_TIMES.profile,
    gcTime: 24 * 60 * 60 * 1000,
    retry: retryPolicy,
  });
}

export function useMediaFeed() {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useInfiniteQuery<PaginatedMedia, Error>({
    queryKey: queryKeys.media(accountKey),
    queryFn: async ({ pageParam }) => {
      if (!provider) throw new Error('No provider');
      try {
        return await provider.getMedia(typeof pageParam === 'string' ? pageParam : undefined);
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(provider),
    staleTime: CACHE_TIMES.media,
    gcTime: 24 * 60 * 60 * 1000,
    retry: retryPolicy,
  });
}

export function flattenMedia(pages: PaginatedMedia[] | undefined): AppMedia[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const out: AppMedia[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

export function useMediaById(id: string | undefined) {
  const provider = useProvider();
  const accountKey = useAccountKey();
  const client = useQueryClient();
  return useQuery<AppMedia, Error>({
    queryKey: queryKeys.mediaById(accountKey, id ?? ''),
    queryFn: async () => {
      if (!provider || !id) throw new Error('No provider');
      return provider.getMediaById(id);
    },
    enabled: Boolean(provider && id),
    staleTime: CACHE_TIMES.media,
    retry: retryPolicy,
    initialData: () => {
      if (!id) return undefined;
      const cached = client.getQueryData<{ pages: PaginatedMedia[] }>(queryKeys.media(accountKey));
      return flattenMedia(cached?.pages).find((m) => m.id === id);
    },
  });
}

export function useAccountInsights(range: DateRange) {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppInsight, Error>({
    queryKey: queryKeys.insights(accountKey, range),
    queryFn: async () => {
      if (!provider) throw new Error('No provider');
      try {
        return await provider.getAccountInsights(range);
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
    },
    enabled: Boolean(provider),
    staleTime: CACHE_TIMES.insights,
    gcTime: 24 * 60 * 60 * 1000,
    retry: retryPolicy,
    placeholderData: (prev) => prev,
  });
}

export function useMediaInsights(id: string | undefined) {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppMediaInsight, Error>({
    queryKey: queryKeys.mediaInsights(accountKey, id ?? ''),
    queryFn: async () => {
      if (!provider || !id) throw new Error('No provider');
      return provider.getMediaInsights(id);
    },
    enabled: Boolean(provider && id),
    staleTime: CACHE_TIMES.insights,
    retry: retryPolicy,
  });
}

/** Insights for many media at once (Top Content, Growth Lab). */
export function useMediaInsightsBatch(ids: string[]) {
  const provider = useProvider();
  const accountKey = useAccountKey();
  const queries = useMemo(
    () =>
      ids.map(
        (id): UseQueryOptions<AppMediaInsight, Error> => ({
          queryKey: queryKeys.mediaInsights(accountKey, id),
          queryFn: async () => {
            if (!provider) throw new Error('No provider');
            return provider.getMediaInsights(id);
          },
          enabled: Boolean(provider),
          staleTime: CACHE_TIMES.insights,
          retry: retryPolicy,
        }),
      ),
    [ids, accountKey, provider],
  );
  return useQueries({
    queries,
    combine: (results) => ({
      byId: Object.fromEntries(results.map((r, i) => [ids[i] ?? '', r.data])) as Record<string, AppMediaInsight | undefined>,
      isLoading: results.some((r) => r.isLoading),
      isFetched: results.every((r) => r.isFetched),
    }),
  });
}

export function useStories() {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppStory[], Error>({
    queryKey: queryKeys.stories(accountKey),
    queryFn: async () => (provider?.getStories ? provider.getStories() : []),
    enabled: Boolean(provider),
    staleTime: CACHE_TIMES.profile,
    retry: false,
  });
}

export function useHighlights() {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppHighlight[], Error>({
    queryKey: queryKeys.highlights(accountKey),
    queryFn: async () => (provider?.getHighlights ? provider.getHighlights() : []),
    enabled: Boolean(provider),
    staleTime: CACHE_TIMES.profile,
    retry: false,
  });
}

export function useComments(mediaId: string | undefined) {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppComment[], Error>({
    queryKey: queryKeys.comments(accountKey, mediaId ?? ''),
    queryFn: async () => (provider?.getComments && mediaId ? provider.getComments(mediaId) : []),
    enabled: Boolean(provider && mediaId),
    staleTime: CACHE_TIMES.media,
    retry: false,
  });
}

export function useAudience() {
  const provider = useProvider();
  const accountKey = useAccountKey();
  return useQuery<AppAudience | null, Error>({
    queryKey: queryKeys.audience(accountKey),
    queryFn: async () => (provider?.getAudience ? provider.getAudience() : null),
    enabled: Boolean(provider),
    staleTime: CACHE_TIMES.insights,
    retry: false,
  });
}

/** Pull-to-refresh helper: drops provider caches and refetches everything for the account. */
export function useRefreshAll() {
  const client = useQueryClient();
  const session = useSession();
  return useCallback(async () => {
    await invalidateProvider(session);
    await client.invalidateQueries();
    useAuthStore.getState().touchSync();
  }, [client, session]);
}
