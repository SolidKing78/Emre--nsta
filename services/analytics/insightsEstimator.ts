import type { AppAccount, AppInsight, AppMedia, AppMediaInsight, AppMetric, DateRange } from '@/types/app';
import { daysBetween, eachDay, isWithinRange, previousRange } from '@/utils/date';
import { buildSeries, createRng } from '@/utils/random';

/**
 * ESTIMATED insights for sources that do not expose Instagram Insights
 * (public profiles and manual profiles).
 *
 * Every metric produced here is tagged `source: 'estimated'` so the UI can label
 * it clearly. The estimates are deterministic (seeded by username) so they stay
 * stable across renders and restarts, and can be overridden in Simulation Mode.
 */

const VIEWS_PER_LIKE_IMAGE = 9;
const VIEWS_PER_LIKE_CAROUSEL = 11;
const VIEWS_PER_LIKE_VIDEO = 18;

export function estimateMediaInsights(media: AppMedia, account?: AppAccount): AppMediaInsight {
  const rng = createRng(`est-${media.id}`);
  const isVideo = media.type === 'REEL' || media.type === 'VIDEO';
  const likes = media.likeCount;
  const comments = media.commentCount;
  const followers = account?.followersCount ?? 0;

  const viewsFromLikes =
    likes * (media.type === 'CAROUSEL_ALBUM' ? VIEWS_PER_LIKE_CAROUSEL : isVideo ? VIEWS_PER_LIKE_VIDEO : VIEWS_PER_LIKE_IMAGE);
  const views = Math.round(media.viewCount ?? Math.max(viewsFromLikes, likes + comments) * (0.9 + rng() * 0.3));
  const reachCap = followers > 0 ? followers * (isVideo ? 4 : 1.6) : Number.POSITIVE_INFINITY;
  const reach = Math.round(Math.min(views * (isVideo ? 0.62 : 0.84) * (0.9 + rng() * 0.2), reachCap));
  const saves = Math.round(likes * (media.type === 'CAROUSEL_ALBUM' ? 0.14 : 0.06) * (0.8 + rng() * 0.5));
  const shares = Math.round(likes * (isVideo ? 0.05 : 0.02) * (0.8 + rng() * 0.5));
  const interactions = likes + comments + saves + shares;
  const follows = Math.round(reach * 0.003 * (0.6 + rng() * 0.8));

  const metrics: AppMetric[] = [
    { key: 'views', value: views, source: media.viewCount !== undefined ? 'api' : 'estimated' },
    { key: 'reach', value: reach, source: 'estimated' },
    { key: 'likes', value: likes, source: 'api' },
    { key: 'comments', value: comments, source: 'api' },
    { key: 'shares', value: shares, source: 'estimated' },
    { key: 'saves', value: saves, source: 'estimated' },
    { key: 'interactions', value: interactions, source: 'estimated' },
    { key: 'follows_from_post', value: follows, source: 'estimated' },
  ];

  // Retention is NOT estimated — Instagram does not expose it publicly and inventing it would be misleading.
  return { mediaId: media.id, metrics, source: 'estimated' };
}

export function estimateAccountInsights(account: AppAccount, media: AppMedia[], range: DateRange): AppInsight {
  const seedBase = `${account.username}-${range.since}-${range.until}`;
  const rng = createRng(seedBase);
  const days = daysBetween(range.since, range.until);
  const dates = eachDay(range);

  const inRange = media.filter((m) => isWithinRange(m.timestamp, range));
  const sample = inRange.length > 0 ? inRange : media;
  const perMedia = sample.map((m) => estimateMediaInsights(m, account));
  const sum = (key: AppMetric['key']) => perMedia.reduce((acc, ins) => acc + (ins.metrics.find((x) => x.key === key)?.value ?? 0), 0);

  // If posts in range are few, extrapolate from the average cadence of the loaded media.
  const cadenceFactor = inRange.length > 0 ? 1 : Math.min(1, days / 30);
  const contentViews = Math.round(sum('views') * cadenceFactor);
  const contentReach = Math.round(sum('reach') * cadenceFactor);
  const contentInteractions = Math.round(sum('interactions') * cadenceFactor);

  // Profile / story traffic on top of content traffic, proportional to followers.
  const followers = account.followersCount;
  const baselineDaily = followers * 0.012;
  const views = Math.round(contentViews + baselineDaily * days * (1.6 + rng() * 0.4));
  const reach = Math.round(Math.max(contentReach, followers * 0.28 * Math.min(1, days / 30)) * (1 + rng() * 0.1));
  const interactions = Math.round(contentInteractions * (1.05 + rng() * 0.1));
  const profileVisits = Math.round(reach * (0.018 + rng() * 0.008));
  const websiteClicks = account.website ? Math.round(profileVisits * (0.06 + rng() * 0.03)) : 0;
  const newFollowers = Math.round(followers * (0.009 + rng() * 0.006) * (days / 30));
  const accountsEngaged = Math.round(reach * (0.045 + rng() * 0.02));

  const growth = () => 0.04 + rng() * 0.2;
  const build = (key: AppMetric['key'], value: number, opts: { trend?: number } = {}): AppMetric => {
    const previousValue = Math.round(value / (1 + growth()));
    return {
      key,
      value,
      previousValue,
      series: buildSeries(dates, value, `${seedBase}-${key}`, { trend: opts.trend ?? 0.25 }),
      source: 'estimated',
    };
  };

  const metrics: AppMetric[] = [
    build('views', views),
    build('reach', reach),
    build('interactions', interactions),
    build('profile_visits', profileVisits),
    { ...build('website_clicks', websiteClicks), source: 'estimated' },
    build('new_followers', newFollowers, { trend: 0.15 }),
    build('accounts_engaged', accountsEngaged),
  ];

  const start = followers - newFollowers;
  const daily = buildSeries(dates, newFollowers, `${seedBase}-followers`, { trend: 0.15, noise: 0.5 });
  let running = start;
  const followerSeries = daily.map((p) => {
    running += p.value;
    return { date: p.date, value: running };
  });
  metrics.push({ key: 'followers', value: followers, previousValue: start, series: followerSeries, source: 'api' });
  metrics.push({ key: 'following', value: account.followsCount, source: 'api' });
  metrics.push({ key: 'media_count', value: account.mediaCount, source: 'api' });

  void previousRange;
  return { range, metrics, source: 'estimated', generatedAt: new Date().toISOString() };
}
