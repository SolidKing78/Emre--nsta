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

/**
 * The ONLY contract the UI knows about. Mock / Public / Meta / Manual providers
 * implement it so screens never learn whether data is demo or live.
 */
export interface InstagramProvider {
  readonly kind: 'mock' | 'meta' | 'public' | 'manual';

  getAccount(): Promise<AppAccount>;
  getMedia(cursor?: string): Promise<PaginatedMedia>;
  getMediaById(id: string): Promise<AppMedia>;
  getAccountInsights(range: DateRange): Promise<AppInsight>;
  getMediaInsights(id: string): Promise<AppMediaInsight>;

  /** Optional extras — screens must handle empty results gracefully. */
  getStories?(): Promise<AppStory[]>;
  getHighlights?(): Promise<AppHighlight[]>;
  getComments?(mediaId: string): Promise<AppComment[]>;
  /** Follower demographics; estimated for sources that cannot provide them. */
  getAudience?(): Promise<AppAudience>;
  /** Discard any cached data so the next call hits the source again. */
  invalidate?(): Promise<void>;
}
