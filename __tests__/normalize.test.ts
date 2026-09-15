import { InstagramMediaSchema, PublicWebProfileResponseSchema } from '@/schemas/instagram';
import { normalizeAccount, normalizeMedia, normalizeMediaType, normalizeMetrics, normalizePublicProfile } from '@/services/instagram/normalize';

describe('normalizeMediaType', () => {
  it('maps Graph API types and reels', () => {
    expect(normalizeMediaType('IMAGE')).toBe('IMAGE');
    expect(normalizeMediaType('VIDEO', 'REELS')).toBe('REEL');
    expect(normalizeMediaType('CAROUSEL_ALBUM')).toBe('CAROUSEL_ALBUM');
    expect(normalizeMediaType('HOLOGRAM')).toBe('UNKNOWN');
  });
});

describe('normalizeMedia (Graph API)', () => {
  it('produces AppMedia with fallbacks', () => {
    const raw = InstagramMediaSchema.parse({
      id: '1',
      media_type: 'CAROUSEL_ALBUM',
      media_url: 'https://cdn/a.jpg',
      permalink: 'https://instagram.com/p/x/',
      caption: 'hello',
      timestamp: '2026-09-01T10:00:00+0000',
      like_count: 10,
      comments_count: 2,
      children: { data: [{ id: 'c1', media_type: 'IMAGE', media_url: 'https://cdn/c1.jpg' }] },
    });
    const media = normalizeMedia(raw, 'user');
    expect(media.type).toBe('CAROUSEL_ALBUM');
    expect(media.thumbnailUrl).toBe('https://cdn/a.jpg');
    expect(media.children).toHaveLength(1);
    expect(media.username).toBe('user');
    expect(media.source).toBe('live');
  });

  it('rejects invalid payloads via Zod', () => {
    expect(InstagramMediaSchema.safeParse({ id: 1 }).success).toBe(false);
  });
});

describe('normalizeAccount', () => {
  it('maps account types and flags personal accounts', () => {
    expect(normalizeAccount({ id: '1', username: 'a', account_type: 'MEDIA_CREATOR' }).accountType).toBe('CREATOR');
    expect(normalizeAccount({ id: '1', username: 'a', account_type: 'PERSONAL' }).accountType).toBe('PERSONAL');
    expect(normalizeAccount({ id: '1', username: 'a' }).name).toBe('a');
  });
});

describe('normalizeMetrics', () => {
  it('keeps known metrics, drops unknown ones and builds series', () => {
    const metrics = normalizeMetrics([
      { name: 'reach', values: [{ value: 10, end_time: '2026-09-01T07:00:00+0000' }, { value: 20, end_time: '2026-09-02T07:00:00+0000' }] },
      { name: 'follower_count', values: [{ value: 100, end_time: '2026-09-01' }, { value: 105, end_time: '2026-09-02' }] },
      { name: 'some_future_metric', total_value: { value: 5 } },
      { name: 'saved', total_value: { value: 7 } },
    ]);
    expect(metrics.map((m) => m.key)).toEqual(['reach', 'followers', 'saves']);
    expect(metrics[0]?.value).toBe(30);
    expect(metrics[0]?.series).toHaveLength(2);
    expect(metrics[1]?.value).toBe(105);
  });
});

describe('normalizePublicProfile', () => {
  it('normalizes the public web payload into account + media', () => {
    const parsed = PublicWebProfileResponseSchema.parse({
      data: {
        user: {
          id: '123',
          username: 'natgeo',
          full_name: 'National Geographic',
          biography: 'Bio',
          external_url: 'https://natgeo.com',
          profile_pic_url_hd: 'https://cdn/p.jpg',
          is_private: false,
          is_verified: true,
          is_business_account: true,
          category_name: 'Media',
          edge_followed_by: { count: 280000000 },
          edge_follow: { count: 150 },
          edge_owner_to_timeline_media: {
            count: 30000,
            page_info: { has_next_page: true, end_cursor: 'abc' },
            edges: [
              {
                node: {
                  id: 'm1',
                  shortcode: 'SC1',
                  __typename: 'GraphVideo',
                  product_type: 'clips',
                  display_url: 'https://cdn/m1.jpg',
                  is_video: true,
                  video_view_count: 50000,
                  taken_at_timestamp: 1757900000,
                  edge_liked_by: { count: 1200 },
                  edge_media_to_comment: { count: 40 },
                  edge_media_to_caption: { edges: [{ node: { text: 'caption' } }] },
                },
              },
            ],
          },
        },
      },
      status: 'ok',
    });
    const user = parsed.data.user;
    expect(user).not.toBeNull();
    const { account, media, nextCursor } = normalizePublicProfile(user!);
    expect(account.username).toBe('natgeo');
    expect(account.isVerified).toBe(true);
    expect(account.accountType).toBe('BUSINESS');
    expect(account.followersCount).toBe(280000000);
    expect(media).toHaveLength(1);
    expect(media[0]?.type).toBe('REEL');
    expect(media[0]?.viewCount).toBe(50000);
    expect(media[0]?.permalink).toBe('https://www.instagram.com/p/SC1/');
    expect(nextCursor).toBe('abc');
  });
});
