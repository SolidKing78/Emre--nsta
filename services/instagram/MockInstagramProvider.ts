import {
  buildMockAccountInsights,
  buildMockComments,
  buildMockMediaInsights,
  mockAccount,
  mockHighlights,
  mockMedia,
  mockStories,
} from '@/mocks/mockData';
import { DEMO_AUDIENCE } from '@/services/analytics/audienceEstimator';
import type { AppAccount, AppAudience, AppComment, AppHighlight, AppInsight, AppMedia, AppMediaInsight, AppStory, DateRange, PaginatedMedia } from '@/types/app';
import { AppError } from '@/types/errors';

import type { InstagramProvider } from './InstagramProvider';

const PAGE_SIZE = 12;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Demo / Expo Go provider. Simulates small network latency for realistic loading states. */
export class MockInstagramProvider implements InstagramProvider {
  readonly kind = 'mock' as const;

  async getAccount(): Promise<AppAccount> {
    await delay(220);
    return { ...mockAccount, lastSyncAt: new Date().toISOString() };
  }

  async getMedia(cursor?: string): Promise<PaginatedMedia> {
    await delay(cursor ? 500 : 320);
    const start = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
    const items = mockMedia.slice(start, start + PAGE_SIZE);
    const nextIndex = start + PAGE_SIZE;
    return { items, nextCursor: nextIndex < mockMedia.length ? String(nextIndex) : undefined };
  }

  async getMediaById(id: string): Promise<AppMedia> {
    await delay(120);
    const media = mockMedia.find((m) => m.id === id);
    if (!media) throw new AppError('not_found');
    return media;
  }

  async getAccountInsights(range: DateRange): Promise<AppInsight> {
    await delay(380);
    return buildMockAccountInsights(range);
  }

  async getMediaInsights(id: string): Promise<AppMediaInsight> {
    await delay(200);
    const insight = buildMockMediaInsights(id);
    if (!insight) throw new AppError('not_found');
    return insight;
  }

  async getStories(): Promise<AppStory[]> {
    return mockStories;
  }

  async getHighlights(): Promise<AppHighlight[]> {
    return mockHighlights;
  }

  async getComments(mediaId: string): Promise<AppComment[]> {
    await delay(150);
    return buildMockComments(mediaId);
  }

  async getAudience(): Promise<AppAudience> {
    await delay(180);
    return DEMO_AUDIENCE;
  }
}
