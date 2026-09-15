import type {
  AppAccount,
  AppActivityItem,
  AppComment,
  AppHighlight,
  AppInsight,
  AppMedia,
  AppMediaInsight,
  AppMetric,
  AppStory,
  DateRange,
  MediaType,
} from '@/types/app';
import { addDays, daysBetween, eachDay, previousRange, toISODate } from '@/utils/date';
import { buildSeries, createRng, hashString } from '@/utils/random';

/* ------------------------------------------------------------------ */
/* Account                                                              */
/* ------------------------------------------------------------------ */

const NOW = new Date();

const avatar = (seed: string, size = 256) => `https://picsum.photos/seed/${seed}/${size}/${size}`;
const photo = (seed: string, w = 1080, h = 1350) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const MOCK_USERNAME = 'zmtprefabrik';
/** Instagram "note" bubble above the avatar on your own profile. */
export const MOCK_NOTE = 'Yeni projeler yolda 🏗️';

export const mockAccount: AppAccount = {
  id: '17841400000000001',
  username: MOCK_USERNAME,
  name: 'ZMT Prefabrik',
  biography:
    'Prefabrik ev, çelik villa ve konteyner çözümleri 🏡\nTürkiye geneli anahtar teslim üretim & montaj\n📞 Teklif için DM',
  website: 'https://zmtprefabrik.com',
  profilePictureUrl: avatar('zmt-avatar'),
  accountType: 'BUSINESS',
  category: 'İnşaat şirketi',
  followersCount: 11_369,
  followsCount: 15,
  mediaCount: 284,
  isVerified: false,
  isPrivate: false,
  source: 'demo',
  connectedAt: addDays(NOW, -212).toISOString(),
  lastSyncAt: new Date(NOW.getTime() - 14 * 60 * 1000).toISOString(),
};

/* ------------------------------------------------------------------ */
/* Media (14 posts, 9 reels, 5 carousels)                                */
/* ------------------------------------------------------------------ */

interface MediaSeed {
  type: MediaType;
  caption: string;
  daysAgo: number;
  hour: number;
  likes: number;
  comments: number;
  views?: number;
  location?: string;
  children?: number;
  pinned?: boolean;
  performance: number; // 0.5 .. 2.5 multiplier used for insights
}

/**
 * Sample clips for the demo reels (10-second Blender open-movie excerpts from test-videos.co.uk,
 * ~1–2 MB each) so the video path can be seen without a real Instagram account.
 */
const SAMPLE_VIDEOS = [
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4',
  'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4',
  'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4',
];

/** "Artist · Song" lines shown under the username on reels (like Instagram's audio attribution). */
const REEL_AUDIO = ['zmtprefabrik · Orijinal ses', 'Kenan Doğulu · Tutamıyorum Zamanı', 'Duman · Senden Daha Güzel', 'zmtprefabrik · Orijinal ses', 'Sezen Aksu · Kaybolan Yıllar', 'Tarkan · Kuzu Kuzu', 'zmtprefabrik · Orijinal ses', 'Mabel Matiz · Ya Bu İşler Ne', 'Ceza · Suspus'];

const MEDIA_SEEDS: MediaSeed[] = [
  { type: 'REEL', caption: '120 m² çelik villa 18 günde teslim 🏡 Zemin hazırlığından anahtar teslime kadar tüm süreç bu videoda. #prefabrik #çelikvilla', daysAgo: 1, hour: 20, likes: 1_284, comments: 68, views: 24_500, performance: 1.6, pinned: true },
  { type: 'CAROUSEL_ALBUM', caption: 'Bodrum projemizin öncesi / sonrası. Kaydırarak inceleyin ➡️ 3 yatak odalı, 95 m², tamamı yalıtımlı.', daysAgo: 3, hour: 19, likes: 842, comments: 41, children: 5, location: 'Bodrum, Muğla', performance: 1.4 },
  { type: 'IMAGE', caption: 'Sabah 07:00, şantiye hazır. Bugün çatı montajı var ☀️', daysAgo: 4, hour: 8, likes: 396, comments: 12, performance: 0.8 },
  { type: 'REEL', caption: 'Konteyner ofis kurulumu — 4 saatte hazır 🔧', daysAgo: 6, hour: 21, likes: 1_920, comments: 104, views: 61_300, performance: 2.4 },
  { type: 'IMAGE', caption: 'Panel üretim hattımızdan bir kare. Her panel tek tek kalite kontrolden geçiyor ✔️', daysAgo: 8, hour: 12, likes: 288, comments: 9, performance: 0.6 },
  { type: 'CAROUSEL_ALBUM', caption: 'Müşterimizden gelen kareler 🙏 Sakarya projesi tamamlandı. 1/4', daysAgo: 10, hour: 19, likes: 731, comments: 37, children: 4, location: 'Sakarya', performance: 1.3 },
  { type: 'REEL', caption: 'Prefabrik ev fiyatları nasıl belirlenir? 60 saniyede anlattık 💬', daysAgo: 12, hour: 20, likes: 1_105, comments: 152, views: 38_900, performance: 1.8 },
  { type: 'IMAGE', caption: 'Çift katlı prefabrik villa — Kocaeli. Dış cephe boyaları tamamlandı 🎨', daysAgo: 14, hour: 17, likes: 512, comments: 23, location: 'Kocaeli', performance: 1.0 },
  { type: 'VIDEO', caption: 'Çelik konstrüksiyon montajı time-lapse ⏱️', daysAgo: 16, hour: 18, likes: 644, comments: 31, views: 19_800, performance: 1.1 },
  { type: 'REEL', caption: 'Yalıtım neden bu kadar önemli? Kışın ısı kaybını %60 azaltan detay ❄️', daysAgo: 18, hour: 21, likes: 973, comments: 88, views: 33_100, performance: 1.5 },
  { type: 'IMAGE', caption: 'Tek katlı 75 m² model evimiz. Detaylar için DM 📩', daysAgo: 20, hour: 13, likes: 421, comments: 19, performance: 0.9 },
  { type: 'CAROUSEL_ALBUM', caption: 'İç mekân seçenekleri: mutfak, banyo, salon. Hangisi favoriniz? 1 / 2 / 3?', daysAgo: 22, hour: 19, likes: 903, comments: 76, children: 3, performance: 1.6 },
  { type: 'REEL', caption: 'Yeni ekipman geldi 🚜 Şantiye günlüğü #3', daysAgo: 24, hour: 22, likes: 566, comments: 27, views: 15_400, performance: 0.9 },
  { type: 'IMAGE', caption: 'Ekibimizle birlikte. 2016’dan beri 900+ proje 💪', daysAgo: 27, hour: 11, likes: 1_040, comments: 64, performance: 1.4 },
  { type: 'IMAGE', caption: 'Gece çekimi — Antalya villa projesi ✨', daysAgo: 30, hour: 21, likes: 688, comments: 29, location: 'Antalya', performance: 1.2 },
  { type: 'REEL', caption: 'Konteyner mi, prefabrik mi? Farkları 45 saniyede anlattık', daysAgo: 33, hour: 20, likes: 1_312, comments: 121, views: 47_200, performance: 2.0 },
  { type: 'CAROUSEL_ALBUM', caption: 'Teknik çizimlerden gerçeğe: 3D render vs teslim edilen ev 📐', daysAgo: 36, hour: 18, likes: 655, comments: 33, children: 6, performance: 1.2 },
  { type: 'IMAGE', caption: 'Bahçeli prefabrik ev keyfi 🌿', daysAgo: 39, hour: 16, likes: 377, comments: 14, performance: 0.7 },
  { type: 'VIDEO', caption: 'Fabrika turu — üretim nasıl yapılıyor?', daysAgo: 42, hour: 14, likes: 498, comments: 22, views: 12_600, performance: 0.8 },
  { type: 'REEL', caption: 'Zemin betonundan anahtar teslime: 21 gün 🏗️', daysAgo: 45, hour: 20, likes: 1_540, comments: 97, views: 52_800, performance: 2.1 },
  { type: 'IMAGE', caption: 'Kış aylarında montaj devam ediyor ❄️🔨', daysAgo: 49, hour: 10, likes: 302, comments: 8, performance: 0.6 },
  { type: 'IMAGE', caption: 'Bugün 3 proje teslim ettik 🎉 Teşekkürler!', daysAgo: 52, hour: 19, likes: 734, comments: 45, performance: 1.1 },
  { type: 'REEL', caption: 'Prefabrik evde deprem güvenliği — mühendisimiz anlatıyor', daysAgo: 56, hour: 21, likes: 2_210, comments: 188, views: 84_100, performance: 2.5 },
  { type: 'CAROUSEL_ALBUM', caption: 'Renk seçenekleri 🎨 Kaydır ve seç', daysAgo: 60, hour: 17, likes: 412, comments: 26, children: 4, performance: 0.8 },
  { type: 'IMAGE', caption: 'Tiny house serimiz yakında 👀', daysAgo: 64, hour: 20, likes: 892, comments: 71, performance: 1.5 },
  { type: 'VIDEO', caption: 'Vinçle panel yerleşimi', daysAgo: 68, hour: 15, likes: 356, comments: 11, views: 9_900, performance: 0.6 },
  { type: 'REEL', caption: 'Müşteri yorumu: “18 günde taşındık” 🙌', daysAgo: 72, hour: 19, likes: 1_128, comments: 83, views: 36_400, performance: 1.6 },
  { type: 'IMAGE', caption: 'Şantiye güvenliği önce gelir 🦺', daysAgo: 78, hour: 9, likes: 241, comments: 6, performance: 0.5 },
];

function mediaIdFor(index: number): string {
  return `1795${(1_000_000 + hashString(`media-${index}`) % 9_000_000).toString()}${index.toString().padStart(2, '0')}`;
}

export const mockMedia: AppMedia[] = MEDIA_SEEDS.map((seed, index) => {
  const id = mediaIdFor(index);
  const date = addDays(NOW, -seed.daysAgo);
  date.setHours(seed.hour, (hashString(id) % 50) + 5, 0, 0);
  const isVertical = seed.type === 'REEL' || seed.type === 'VIDEO';
  const mediaUrl = photo(`zmt-${index}`, 1080, isVertical ? 1920 : 1350);
  const children =
    seed.type === 'CAROUSEL_ALBUM'
      ? Array.from({ length: seed.children ?? 3 }, (_, i) => ({
          id: `${id}_${i}`,
          type: 'IMAGE' as const,
          mediaUrl: photo(`zmt-${index}-${i}`, 1080, 1350),
          thumbnailUrl: photo(`zmt-${index}-${i}`, 1080, 1350),
        }))
      : undefined;
  return {
    id,
    type: seed.type,
    permalink: `https://www.instagram.com/p/${id.slice(-8)}/`,
    mediaUrl,
    thumbnailUrl: mediaUrl,
    caption: seed.caption,
    timestamp: date.toISOString(),
    likeCount: seed.likes,
    commentCount: seed.comments,
    viewCount: seed.views,
    videoUrl: isVertical ? SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length] : undefined,
    durationSec: isVertical ? 10 : undefined,
    children,
    username: MOCK_USERNAME,
    ownerAvatarUrl: mockAccount.profilePictureUrl,
    location: seed.location,
    music: seed.type === 'REEL' ? (REEL_AUDIO[index % REEL_AUDIO.length] ?? undefined) : undefined,
    aspectRatio: isVertical ? 9 / 16 : 4 / 5,
    isPinned: seed.pinned,
    source: 'demo',
  };
});

const seedByMediaId = new Map(mockMedia.map((m, i) => [m.id, MEDIA_SEEDS[i] as MediaSeed]));

/* ------------------------------------------------------------------ */
/* Account insights                                                     */
/* ------------------------------------------------------------------ */

const BASE_30D = {
  views: 1_478_200,
  reach: 227_139,
  interactions: 18_240,
  profile_visits: 4_824,
  website_clicks: 362,
  new_followers: 1_186,
  accounts_engaged: 9_870,
} as const;

/** Growth vs previous equal period, per metric (demo). */
const GROWTH = {
  views: 0.212,
  reach: 0.184,
  interactions: 0.097,
  profile_visits: 0.146,
  website_clicks: -0.052,
  new_followers: 0.318,
  accounts_engaged: 0.121,
} as const;

function scaleForRange(range: DateRange): number {
  const days = daysBetween(range.since, range.until);
  if (days <= 7) return (days / 30) * 1.08;
  if (days <= 30) return days / 30;
  return (days / 30) * 0.93;
}

export function buildMockAccountInsights(range: DateRange): AppInsight {
  const scale = scaleForRange(range);
  const dates = eachDay(range);
  const prev = previousRange(range);
  const metrics: AppMetric[] = (Object.keys(BASE_30D) as (keyof typeof BASE_30D)[]).map((key) => {
    const value = Math.round(BASE_30D[key] * scale);
    const growth = GROWTH[key];
    const previousValue = Math.round(value / (1 + growth));
    return {
      key,
      value,
      previousValue,
      series: buildSeries(dates, value, `${key}-${range.since}-${range.until}`, { trend: 0.3 }),
      source: 'mock',
    };
  });

  // followers: cumulative series ending at the current follower count
  const newFollowers = metrics.find((m) => m.key === 'new_followers')?.value ?? 0;
  const start = mockAccount.followersCount - newFollowers;
  const daily = buildSeries(dates, newFollowers, `followers-${range.since}`, { trend: 0.2, noise: 0.5 });
  let running = start;
  const followerSeries = daily.map((p) => {
    running += p.value;
    return { date: p.date, value: running };
  });
  metrics.push({
    key: 'followers',
    value: mockAccount.followersCount,
    previousValue: start,
    series: followerSeries,
    source: 'mock',
  });
  metrics.push({ key: 'following', value: mockAccount.followsCount, source: 'mock' });
  metrics.push({ key: 'media_count', value: mockAccount.mediaCount, source: 'mock' });

  void prev;
  return { range, metrics, source: 'mock', generatedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Media insights                                                       */
/* ------------------------------------------------------------------ */

export function buildMockMediaInsights(mediaId: string): AppMediaInsight | null {
  const media = mockMedia.find((m) => m.id === mediaId);
  const seed = seedByMediaId.get(mediaId);
  if (!media || !seed) return null;
  const rng = createRng(`insights-${mediaId}`);
  const p = seed.performance;
  const isVideo = media.type === 'REEL' || media.type === 'VIDEO';
  const views = media.viewCount ?? Math.round(media.likeCount * (media.type === 'CAROUSEL_ALBUM' ? 11 : 9) * (0.9 + rng() * 0.4));
  const reach = Math.round(views * (isVideo ? 0.58 : 0.82) * (0.9 + rng() * 0.2));
  const saves = Math.round(media.likeCount * (media.type === 'CAROUSEL_ALBUM' ? 0.16 : 0.07) * p);
  const shares = Math.round(media.likeCount * (isVideo ? 0.06 : 0.025) * p);
  const follows = Math.round(reach * 0.0035 * p);
  const interactions = media.likeCount + media.commentCount + saves + shares;

  const metrics: AppMetric[] = [
    { key: 'views', value: views, source: 'mock' },
    { key: 'reach', value: reach, source: 'mock' },
    { key: 'likes', value: media.likeCount, source: 'mock' },
    { key: 'comments', value: media.commentCount, source: 'mock' },
    { key: 'shares', value: shares, source: 'mock' },
    { key: 'saves', value: saves, source: 'mock' },
    { key: 'interactions', value: interactions, source: 'mock' },
    { key: 'follows_from_post', value: follows, source: 'mock' },
  ];

  let retention: number[] | undefined;
  if (media.type === 'REEL') {
    const seconds = 15 + Math.floor(rng() * 30);
    const hook = 0.55 + p * 0.12;
    retention = Array.from({ length: seconds }, (_, s) => {
      const t = s / seconds;
      return Math.max(0.04, Math.min(1, (1 - t * (1 - hook * 0.6)) * (1 - t * 0.35) + (rng() - 0.5) * 0.02));
    });
    retention[0] = 1;
    const avgWatch = retention.reduce((a, b) => a + b, 0);
    metrics.push({ key: 'avg_watch_time', value: Math.round(avgWatch * 10) / 10, source: 'mock' });
    metrics.push({ key: 'replays', value: Math.round(views * (0.08 + p * 0.03)), source: 'mock' });
  }

  return { mediaId, metrics, source: 'mock', retention };
}

/* ------------------------------------------------------------------ */
/* Stories, highlights, comments, activity                              */
/* ------------------------------------------------------------------ */

const STORY_USERS = ['betonarme.ustasi', 'mimar.selin', 'yapi.market34', 'ev.dekor.fikir', 'insaat.gunlugu', 'celik.yapi.tr', 'villa.projeleri'];

export const mockStories: AppStory[] = [
  { id: 'self', username: MOCK_USERNAME, avatarUrl: mockAccount.profilePictureUrl, seen: false, isSelf: true },
  ...STORY_USERS.map((username, i) => ({
    id: `story-${i}`,
    username,
    avatarUrl: avatar(`story-${username}`, 128),
    seen: i > 3,
  })),
];

export const mockHighlights: AppHighlight[] = [
  { id: 'h1', title: 'Projeler', coverUrl: photo('zmt-h1', 300, 300) },
  { id: 'h2', title: 'Villa', coverUrl: photo('zmt-h2', 300, 300) },
  { id: 'h3', title: 'Konteyner', coverUrl: photo('zmt-h3', 300, 300) },
  { id: 'h4', title: 'Fabrika', coverUrl: photo('zmt-h4', 300, 300) },
  { id: 'h5', title: 'Yorumlar', coverUrl: photo('zmt-h5', 300, 300) },
  { id: 'h6', title: 'SSS', coverUrl: photo('zmt-h6', 300, 300) },
];

const COMMENT_TEXTS = [
  'Fiyat bilgisi alabilir miyim? 🙏',
  'Harika görünüyor 👏',
  'Kaç günde teslim ediyorsunuz?',
  'İzmir’e montaj yapıyor musunuz?',
  'Bayıldım 😍',
  'Yalıtım detayını merak ettim, DM attım.',
  'Kredi imkânı var mı?',
  'Çok temiz işçilik 👌',
  'Tiny house modeliniz ne zaman çıkıyor?',
  'Emeğinize sağlık',
];

export function buildMockComments(mediaId: string): AppComment[] {
  const media = mockMedia.find((m) => m.id === mediaId);
  if (!media) return [];
  const rng = createRng(`comments-${mediaId}`);
  const count = Math.min(6, media.commentCount);
  return Array.from({ length: count }, (_, i) => {
    const username = STORY_USERS[Math.floor(rng() * STORY_USERS.length)] ?? 'user';
    const text = COMMENT_TEXTS[Math.floor(rng() * COMMENT_TEXTS.length)] ?? '';
    const ts = new Date(new Date(media.timestamp).getTime() + (i + 1) * 3_600_000 * (1 + rng() * 5));
    const likeCount = Math.floor(rng() * 40);
    return { id: `${mediaId}-c${i}`, username, avatarUrl: avatar(`c-${username}`, 96), text, timestamp: ts.toISOString(), likeCount, replyCount: rng() > 0.55 ? 1 + Math.floor(rng() * 3) : 0 };
  });
}

export function buildMockActivity(): AppActivityItem[] {
  const rng = createRng('activity');
  const items: AppActivityItem[] = [];
  const top = [...mockMedia].sort((a, b) => b.likeCount - a.likeCount)[0];
  items.push({
    id: 'a-sync',
    kind: 'sync',
    title: 'sync',
    timestamp: mockAccount.lastSyncAt ?? NOW.toISOString(),
  });
  items.push({
    id: 'a-follow-batch',
    kind: 'follow',
    title: 'newFollowers',
    subtitle: '312',
    timestamp: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
    avatarUrl: avatar('follower-batch', 96),
  });
  if (top) {
    items.push({
      id: 'a-top',
      kind: 'milestone',
      title: 'topPost',
      timestamp: new Date(NOW.getTime() - 5 * 3_600_000).toISOString(),
      mediaThumbnailUrl: top.thumbnailUrl,
      route: `/media/${top.id}`,
    });
  }
  STORY_USERS.slice(0, 5).forEach((username, i) => {
    const media = mockMedia[Math.floor(rng() * 6)];
    const liked = rng() > 0.4;
    items.push({
      id: `a-${i}`,
      kind: liked ? 'like' : 'comment',
      title: username,
      subtitle: liked ? undefined : COMMENT_TEXTS[Math.floor(rng() * COMMENT_TEXTS.length)],
      timestamp: new Date(NOW.getTime() - (8 + i * 19) * 3_600_000).toISOString(),
      avatarUrl: avatar(`c-${username}`, 96),
      mediaThumbnailUrl: media?.thumbnailUrl,
      route: media ? `/media/${media.id}` : undefined,
    });
  });
  items.push({
    id: 'a-milestone-reach',
    kind: 'milestone',
    title: 'reach',
    subtitle: '200000',
    timestamp: addDays(NOW, -4).toISOString(),
  });
  items.push({
    id: 'a-reco',
    kind: 'recommendation',
    title: 'recommendation',
    timestamp: addDays(NOW, -6).toISOString(),
    route: '/growth',
  });
  STORY_USERS.slice(3).forEach((username, i) => {
    items.push({
      id: `a-f-${i}`,
      kind: 'follow',
      title: username,
      timestamp: addDays(NOW, -(9 + i * 4)).toISOString(),
      avatarUrl: avatar(`c-${username}`, 96),
    });
  });
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export const MOCK_TODAY = toISODate(NOW);
