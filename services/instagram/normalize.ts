import type {
  InstagramApiAccount,
  InstagramApiMedia,
  InstagramApiMetric,
  PublicWebMediaNode,
  PublicWebUser,
} from '@/schemas/instagram';
import type { AccountType, AppAccount, AppMedia, AppMediaChild, AppMetric, DataSource, MediaType, MetricKey } from '@/types/app';

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
  const children: AppMediaChild[] | undefined = raw.children?.data.map((child) => ({
    id: child.id,
    type: normalizeMediaType(child.media_type),
    mediaUrl: child.media_url ?? child.thumbnail_url ?? '',
    thumbnailUrl: child.thumbnail_url ?? child.media_url ?? '',
  }));
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

export function normalizePublicMedia(node: PublicWebMediaNode, username: string, avatarUrl?: string): AppMedia {
  const type = publicMediaType(node);
  const image = node.display_url ?? node.thumbnail_src ?? '';
  const children: AppMediaChild[] | undefined = node.edge_sidecar_to_children?.edges.map((edge) => ({
    id: edge.node.id,
    type: edge.node.is_video ? 'VIDEO' : 'IMAGE',
    mediaUrl: edge.node.display_url ?? image,
    thumbnailUrl: edge.node.display_url ?? image,
  }));
  const likes = node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0;
  const viewCount = node.video_play_count ?? node.video_view_count;
  return {
    id: node.id,
    type,
    permalink: node.shortcode ? `https://www.instagram.com/p/${node.shortcode}/` : '',
    mediaUrl: image,
    thumbnailUrl: node.thumbnail_src ?? image,
    caption: node.edge_media_to_caption?.edges[0]?.node.text ?? '',
    timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
    likeCount: Math.max(0, likes),
    commentCount: node.edge_media_to_comment?.count ?? 0,
    viewCount: viewCount ?? undefined,
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
  const media = edges.map((edge) => normalizePublicMedia(edge.node, account.username, account.profilePictureUrl));
  const pageInfo = user.edge_owner_to_timeline_media?.page_info;
  const nextCursor = pageInfo?.has_next_page && pageInfo.end_cursor ? pageInfo.end_cursor : undefined;
  return { account, media, nextCursor };
}
