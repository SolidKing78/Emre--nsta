import type {
  InstagramApiAccount,
  InstagramApiMedia,
  InstagramApiMetric,
  PublicWebMediaNode,
  PublicWebUser,
} from '@/schemas/instagram';
import type { AccountType, AppAccount, AppMedia, AppMediaChild, AppMetric, DataSource, MediaType, MetricKey } from '@/types/app';
import { createRng } from '@/utils/random';

import { shortcodeFromMediaId, timestampFromMediaId, type ParsedEmbed, type ParsedProfilePage, type ParsedPublicUser, type ParsedTimelineNode } from './publicWebParser';

/* ------------------------------------------------------------------ */
/* Meta Graph API → App types                                           */
/* ------------------------------------------------------------------ */

export function normalizeMediaType(mediaType?: string, productType?: string): MediaType {
  const product = (productType ?? '').toUpperCase();
  const type = (mediaType ?? '').toUpperCase();
  if (product === 'REELS' || product === 'CLIPS') return 'REEL';
  if (type === 'IMAGE') return 'IMAGE';
  if (type === 'VIDEO') return 'VIDEO';
  if (type === 'CAROUSEL_ALBUM') return 'CAROUSEL_ALBUM';
  return 'UNKNOWN';
}

export function normalizeAccountType(raw?: string): AccountType {
  const value = (raw ?? '').toUpperCase();
  if (value === 'BUSINESS') return 'BUSINESS';
  if (value === 'MEDIA_CREATOR' || value === 'CREATOR') return 'CREATOR';
  if (value === 'PERSONAL') return 'PERSONAL';
  return 'UNKNOWN';
}

export function normalizeAccount(
  raw: InstagramApiAccount & { token_expires_at?: string; connected_at?: string; last_sync_at?: string },
  source: DataSource = 'live',
): AppAccount {
  return {
    id: raw.id,
    username: raw.username,
    name: raw.name ?? raw.username,
    biography: raw.biography ?? '',
    website: raw.website || undefined,
    profilePictureUrl: raw.profile_picture_url ?? '',
    accountType: normalizeAccountType(raw.account_type),
    followersCount: raw.followers_count ?? 0,
    followsCount: raw.follows_count ?? 0,
    mediaCount: raw.media_count ?? 0,
    isVerified: false,
    isPrivate: false,
    source,
    connectedAt: raw.connected_at,
    lastSyncAt: raw.last_sync_at ?? new Date().toISOString(),
    tokenExpiresAt: raw.token_expires_at,
  };
}

export function normalizeMedia(raw: InstagramApiMedia, username: string, source: DataSource = 'live'): AppMedia {
  const type = normalizeMediaType(raw.media_type, raw.media_product_type);
  const children: AppMediaChild[] | undefined = raw.children?.data.map((child) => {
    const childType = normalizeMediaType(child.media_type);
    return {
      id: child.id,
      type: childType,
      mediaUrl: child.media_url ?? child.thumbnail_url ?? '',
      thumbnailUrl: child.thumbnail_url ?? child.media_url ?? '',
      // The Graph API's media_url for a video IS the mp4.
      videoUrl: childType === 'VIDEO' || childType === 'REEL' ? child.media_url : undefined,
    };
  });
  const isVideo = type === 'VIDEO' || type === 'REEL';
  const thumbnail = raw.thumbnail_url ?? (type === 'IMAGE' || type === 'CAROUSEL_ALBUM' ? raw.media_url : undefined) ?? children?.[0]?.thumbnailUrl ?? '';
  return {
    id: raw.id,
    type,
    permalink: raw.permalink ?? '',
    mediaUrl: raw.media_url ?? thumbnail,
    thumbnailUrl: thumbnail,
    caption: raw.caption ?? '',
    timestamp: raw.timestamp,
    likeCount: raw.like_count ?? 0,
    commentCount: raw.comments_count ?? 0,
    videoUrl: isVideo ? raw.media_url : undefined,
    children,
    username: raw.username ?? username,
    source,
  };
}

const METRIC_NAME_MAP: Record<string, MetricKey> = {
  views: 'views',
  impressions: 'views',
  plays: 'views',
  reach: 'reach',
  total_interactions: 'interactions',
  interactions: 'interactions',
  follower_count: 'followers',
  followers: 'followers',
  follows_and_unfollows: 'new_followers',
  new_followers: 'new_followers',
  profile_views: 'profile_visits',
  profile_visits: 'profile_visits',
  website_clicks: 'website_clicks',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  saved: 'saves',
  saves: 'saves',
  accounts_engaged: 'accounts_engaged',
  ig_reels_avg_watch_time: 'avg_watch_time',
  avg_watch_time: 'avg_watch_time',
  replays: 'replays',
  follows: 'follows_from_post',
  reposts: 'reposts',
};

/** Unknown metric names are dropped instead of breaking the UI. */
export function normalizeMetrics(raw: InstagramApiMetric[], source: AppMetric['source'] = 'api'): AppMetric[] {
  const out: AppMetric[] = [];
  for (const entry of raw) {
    const key = METRIC_NAME_MAP[entry.name];
    if (!key) continue;
    const series = entry.values
      ?.filter((v) => typeof v.value === 'number')
      .map((v) => ({ date: (v.end_time ?? '').slice(0, 10), value: v.value }));
    const total = entry.total_value?.value ?? (series ? series.reduce((acc, p) => acc + p.value, 0) : undefined);
    if (total === undefined) continue;
    const value = key === 'followers' && series && series.length > 0 ? (series[series.length - 1]?.value ?? total) : total;
    out.push({ key, value, series: series && series.length > 1 ? series : undefined, source });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Instagram public web profile → App types                              */
/* ------------------------------------------------------------------ */

function publicMediaType(node: PublicWebMediaNode): MediaType {
  if ((node.product_type ?? '').toLowerCase() === 'clips') return 'REEL';
  if (node.__typename === 'GraphSidecar' || node.__typename === 'XDTGraphSidecar') return 'CAROUSEL_ALBUM';
  if (node.is_video || node.__typename === 'GraphVideo' || node.__typename === 'XDTGraphVideo') return 'VIDEO';
  if (node.__typename === 'GraphImage' || node.__typename === 'XDTGraphImage') return 'IMAGE';
  return node.display_url ? 'IMAGE' : 'UNKNOWN';
}

export function normalizePublicMedia(node: PublicWebMediaNode, username: string, avatarUrl?: string, followers = 0): AppMedia {
  const type = publicMediaType(node);
  const estimated = node.counts_estimated ? estimatePublicCounts(node.id, type, followers) : undefined;
  const image = node.display_url ?? node.thumbnail_src ?? '';
  const children: AppMediaChild[] | undefined = node.edge_sidecar_to_children?.edges.map((edge) => ({
    id: edge.node.id,
    type: edge.node.is_video ? 'VIDEO' : 'IMAGE',
    mediaUrl: edge.node.display_url ?? image,
    thumbnailUrl: edge.node.display_url ?? image,
    videoUrl: edge.node.is_video ? edge.node.video_url : undefined,
  }));
  const likes = estimated?.likeCount ?? node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0;
  const viewCount = node.video_play_count ?? node.video_view_count ?? estimated?.viewCount;
  return {
    id: node.id,
    type,
    permalink: node.shortcode ? `https://www.instagram.com/p/${node.shortcode}/` : '',
    mediaUrl: image,
    thumbnailUrl: node.thumbnail_src ?? image,
    caption: node.edge_media_to_caption?.edges[0]?.node.text ?? '',
    timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
    likeCount: Math.max(0, likes),
    commentCount: estimated?.commentCount ?? node.edge_media_to_comment?.count ?? 0,
    viewCount: viewCount ?? undefined,
    videoUrl: node.video_url,
    durationSec: node.video_duration,
    countsEstimated: node.counts_estimated || undefined,
    children,
    username,
    ownerAvatarUrl: avatarUrl,
    location: node.location?.name ?? undefined,
    aspectRatio: node.dimensions && node.dimensions.height > 0 ? node.dimensions.width / node.dimensions.height : undefined,
    isPinned: (node.pinned_for_users?.length ?? 0) > 0,
    source: 'public',
  };
}

export function normalizePublicAccount(user: PublicWebUser): AppAccount {
  const professional = user.is_business_account || user.is_professional_account;
  return {
    id: user.id,
    username: user.username,
    name: user.full_name || user.username,
    biography: user.biography ?? '',
    website: user.external_url || undefined,
    profilePictureUrl: user.profile_pic_url_hd ?? user.profile_pic_url ?? '',
    accountType: user.is_business_account ? 'BUSINESS' : professional ? 'CREATOR' : 'PERSONAL',
    category: user.category_name || undefined,
    followersCount: user.edge_followed_by?.count ?? 0,
    followsCount: user.edge_follow?.count ?? 0,
    mediaCount: user.edge_owner_to_timeline_media?.count ?? user.edge_owner_to_timeline_media?.edges.length ?? 0,
    isVerified: user.is_verified ?? false,
    isPrivate: user.is_private ?? false,
    source: 'public',
    lastSyncAt: new Date().toISOString(),
  };
}

export function normalizePublicProfile(user: PublicWebUser): { account: AppAccount; media: AppMedia[]; nextCursor?: string } {
  const account = normalizePublicAccount(user);
  const edges = user.edge_owner_to_timeline_media?.edges ?? [];
  const media = edges.map((edge) => normalizePublicMedia(edge.node, account.username, account.profilePictureUrl, account.followersCount));
  const pageInfo = user.edge_owner_to_timeline_media?.page_info;
  const nextCursor = pageInfo?.has_next_page && pageInfo.end_cursor ? pageInfo.end_cursor : undefined;
  return { account, media, nextCursor };
}

/* ------------------------------------------------------------------ */
/* Instagram public web PAGES (HTML) → App types                         */
/* ------------------------------------------------------------------ */

export function normalizeParsedAccount(user: ParsedPublicUser): AppAccount {
  return {
    id: user.pk,
    username: user.username,
    name: user.fullName || user.username,
    biography: user.biography,
    website: user.externalUrl || undefined,
    profilePictureUrl: user.profilePicUrl,
    accountType: user.category ? 'CREATOR' : 'PERSONAL',
    category: user.category,
    followersCount: user.followerCount,
    followsCount: user.followingCount,
    mediaCount: user.mediaCount ?? 0,
    isVerified: user.isVerified,
    isPrivate: user.isPrivate,
    source: 'public',
    lastSyncAt: new Date().toISOString(),
  };
}

/**
 * Deterministic like / comment / view estimates for a post whose numbers the
 * source did not expose. Engagement rate shrinks as the audience grows, the way
 * it does on Instagram; the per-post jitter is seeded by the post id so the
 * figures never jump between renders.
 */
export function estimatePublicCounts(pk: string, kind: MediaType, followers: number): { likeCount: number; commentCount: number; viewCount?: number } {
  const rng = createRng(`public-counts-${pk}`);
  const isVideo = kind === 'REEL' || kind === 'VIDEO';
  // ~9% at 1K followers, ~1.4% at 100K, ~0.6% at 1M, ~0.06% at 250M — matches what public accounts actually get.
  const baseRate = followers < 1_000 ? 0.1 : 0.09 * Math.pow(followers / 1_000, -0.4);
  const jitter = 0.55 + rng() * 1.1;
  const likeCount = Math.max(0, Math.round(Math.max(followers, 40) * baseRate * (isVideo ? 1.3 : kind === 'CAROUSEL_ALBUM' ? 1.1 : 1) * jitter));
  const commentCount = Math.round(likeCount * (0.006 + rng() * 0.014));
  const viewCount = isVideo ? Math.round(likeCount * (14 + rng() * 10)) : undefined;
  return { likeCount, commentCount, viewCount };
}

function parsedMediaType(node: ParsedTimelineNode): MediaType {
  if (node.kind === 'carousel') return 'CAROUSEL_ALBUM';
  if (node.kind === 'video') return node.productType.toLowerCase() === 'clips' ? 'REEL' : 'VIDEO';
  return 'IMAGE';
}

export function normalizeParsedMedia(node: ParsedTimelineNode, account: AppAccount): AppMedia {
  const type = parsedMediaType(node);
  const code = node.code || shortcodeFromMediaId(node.pk);
  const takenAtMs = node.takenAt !== undefined ? node.takenAt * 1000 : timestampFromMediaId(node.pk);
  const hasCounts = node.likeCount !== undefined;
  const estimated = hasCounts ? undefined : estimatePublicCounts(node.pk, type, account.followersCount);
  return {
    id: node.pk,
    type,
    permalink: code ? `https://www.instagram.com/${type === 'REEL' ? 'reel' : 'p'}/${code}/` : '',
    mediaUrl: node.imageUrl,
    thumbnailUrl: node.imageUrl,
    caption: node.caption,
    timestamp: new Date(takenAtMs ?? Date.now()).toISOString(),
    likeCount: node.likeCount ?? estimated?.likeCount ?? 0,
    commentCount: node.commentCount ?? estimated?.commentCount ?? 0,
    viewCount: node.viewCount ?? estimated?.viewCount,
    username: account.username,
    ownerAvatarUrl: account.profilePictureUrl,
    aspectRatio: node.width && node.height ? node.width / node.height : undefined,
    isPinned: node.isPinned,
    countsEstimated: !hasCounts,
    source: 'public',
  };
}

export function normalizeParsedProfile(page: Extract<ParsedProfilePage, { status: 'ok' }>): { account: AppAccount; media: AppMedia[]; nextCursor?: string } {
  const account = normalizeParsedAccount(page.user);
  const media = page.media.map((node) => normalizeParsedMedia(node, account));
  if (!page.user.mediaCount && media.length > 0) account.mediaCount = media.length;
  return { account, media, nextCursor: page.endCursor };
}

/** Merges the real numbers (and video details) from an embed page into a post. */
export function applyEmbedDetails(media: AppMedia, embed: ParsedEmbed): AppMedia {
  const children: AppMediaChild[] | undefined = embed.children?.map((child) => ({
    id: child.id,
    type: child.isVideo ? 'VIDEO' : 'IMAGE',
    mediaUrl: child.displayUrl ?? media.mediaUrl,
    thumbnailUrl: child.displayUrl ?? media.thumbnailUrl,
    videoUrl: child.isVideo ? child.videoUrl : undefined,
  }));
  const isVideo = media.type === 'REEL' || media.type === 'VIDEO';
  return {
    ...media,
    likeCount: embed.likeCount ?? media.likeCount,
    commentCount: embed.commentCount ?? media.commentCount,
    viewCount: isVideo ? (embed.viewCount ?? media.viewCount) : media.viewCount,
    caption: media.caption || embed.caption || '',
    timestamp: embed.takenAt !== undefined ? new Date(embed.takenAt * 1000).toISOString() : media.timestamp,
    aspectRatio: embed.width && embed.height ? embed.width / embed.height : media.aspectRatio,
    children: children && children.length > 0 ? children : media.children,
    videoUrl: embed.videoUrl ?? media.videoUrl,
    durationSec: embed.videoDuration ?? media.durationSec,
    music: embed.music ?? media.music,
    countsEstimated: embed.likeCount === undefined && embed.commentCount === undefined,
  };
}
