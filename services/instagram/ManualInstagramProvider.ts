import { estimateAudience } from '@/services/analytics/audienceEstimator';
import { estimateAccountInsights, estimateMediaInsights } from '@/services/analytics/insightsEstimator';
import { useManualProfileStore, type ManualProfile } from '@/store/manualProfileStore';
import type { AppAccount, AppAudience, AppInsight, AppMedia, AppMediaInsight, AppStory, DateRange, PaginatedMedia } from '@/types/app';
import { AppError } from '@/types/errors';

import type { InstagramProvider } from './InstagramProvider';

/** Serves a profile that was created by hand on the device. Insights are estimated. */
export class ManualInstagramProvider implements InstagramProvider {
  readonly kind = 'manual' as const;

  constructor(private readonly profileId: string) {}

  private profile(): ManualProfile {
    const profile = useManualProfileStore.getState().profiles[this.profileId];
    if (!profile) throw new AppError('not_found', 'Manual profile no longer exists');
    return profile;
  }

  async getAccount(): Promise<AppAccount> {
    return { ...this.profile().account, lastSyncAt: new Date().toISOString() };
  }

  async getMedia(): Promise<PaginatedMedia> {
    return { items: this.profile().media };
  }

  async getMediaById(id: string): Promise<AppMedia> {
    const media = this.profile().media.find((m) => m.id === id);
    if (!media) throw new AppError('not_found');
    return media;
  }

  async getAccountInsights(range: DateRange): Promise<AppInsight> {
    const profile = this.profile();
    return estimateAccountInsights(profile.account, profile.media, range);
  }

  async getMediaInsights(id: string): Promise<AppMediaInsight> {
    const profile = this.profile();
    const media = profile.media.find((m) => m.id === id);
    if (!media) throw new AppError('not_found');
    return estimateMediaInsights(media, profile.account);
  }

  async getStories(): Promise<AppStory[]> {
    const account = this.profile().account;
    return [{ id: 'self', username: account.username, avatarUrl: account.profilePictureUrl, seen: false, isSelf: true }];
  }

  async getAudience(): Promise<AppAudience> {
    return estimateAudience(this.profile().account.username, 'manual');
  }
}
