import { applyEmbedDetails, estimatePublicCounts, normalizeParsedProfile } from '@/services/instagram/normalize';
import {
  parseCompactNumber,
  parseEmbedPage,
  parseOgCounts,
  parseProfilePage,
  parseTimelineResponse,
  shortcodeFromMediaId,
  timestampFromMediaId,
} from '@/services/instagram/publicWebParser';

/* ---------------- fixtures (shape of Instagram's logged-out mobile pages) ---------------- */

const userBlock = {
  require: [
    [
      'ScheduledServerJS',
      'handle',
      null,
      [
        {
          __bbox: {
            require: [
              [
                'RelayPrefetchedStreamCache',
                'next',
                [],
                [
                  'adp_PolarisLoggedOutMobileProfileRootQueryRelayPreloader_1',
                  {
                    __bbox: {
                      complete: true,
                      result: {
                        data: {
                          xig_user_by_igid_v2: {
                            full_name: 'National Geographic',
                            username: 'natgeo',
                            biography: 'Step into wonder',
                            is_verified: true,
                            follower_count: 268541293,
                            following_count: 194,
                            pk: '787132',
                            id: '17841400573960012',
                            profile_pic_url: 'https://cdn.example/avatar.jpg',
                            is_private: false,
                          },
                        },
                      },
                    },
                  },
                ],
              ],
            ],
          },
        },
      ],
    ],
  ],
};

const timelineBlock = {
  require: [
    [
      'ScheduledServerJS',
      'handle',
      null,
      [
        {
          __bbox: {
            require: [
              [
                'RelayPrefetchedStreamCache',
                'next',
                [],
                [
                  'adp_PolarisProfilePostsLoggedOutTabGridUIContentQueryRelayPreloader_1',
                  {
                    __bbox: {
                      result: {
                        data: {
                          xig_user_by_igid_v2: {
                            polaris_timeline_connection: {
                              edges: [
                                {
                                  node: {
                                    __typename: 'XIGPolarisImageMedia',
                                    is_timeline_pinned: true,
                                    pk: '3986184822734042466',
                                    image_versions2: {
                                      candidates: [
                                        { height: 1350, url: 'https://cdn.example/big.jpg', width: 1080 },
                                        { height: 750, url: 'https://cdn.example/small.jpg', width: 600 },
                                      ],
                                    },
                                    display_uri: 'https://cdn.example/display.jpg',
                                    caption: { pk: '1', text: 'Think you need 10,000 steps?' },
                                    media_type: 1,
                                    product_type: 'feed',
                                    id: 'POLARIS_3986184822734042466',
                                  },
                                },
                                {
                                  node: {
                                    __typename: 'XIGPolarisVideoMedia',
                                    is_timeline_pinned: false,
                                    pk: '3986021415458593743',
                                    image_versions2: { candidates: [{ height: 1920, url: 'https://cdn.example/reel.jpg', width: 1080 }] },
                                    caption: null,
                                    media_type: 2,
                                    product_type: 'clips',
                                    id: 'POLARIS_3986021415458593743',
                                  },
                                },
                                {
                                  node: {
                                    __typename: 'XIGPolarisCarouselMedia',
                                    pk: '3984093352589352420',
                                    image_versions2: { candidates: [{ height: 800, url: 'https://cdn.example/album.jpg', width: 640 }] },
                                    caption: { text: 'ISS' },
                                    media_type: 8,
                                    product_type: 'carousel_container',
                                    id: 'POLARIS_3984093352589352420',
                                  },
                                },
                              ],
                              page_info: { end_cursor: 'CURSOR_1', has_next_page: true },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              ],
            ],
          },
        },
      ],
    ],
  ],
};

function profileHtml(options: { withTimeline?: boolean } = {}): string {
  const blocks = [userBlock, ...(options.withTimeline === false ? [] : [timelineBlock])];
  return [
    '<!DOCTYPE html><html><head>',
    '<meta property="og:title" content="National Geographic (&#064;natgeo) &#x2022; Instagram photos and videos" />',
    '<meta property="og:description" content="269M Followers, 195 Following, 32K Posts - See Instagram photos and videos from National Geographic (&#064;natgeo)" />',
    '<script type="application/json" data-content-len="10" data-sjs>{"define":[["LSD",[],{"token":"AdT1rhRw"},1]]}</script>',
    '<script type="application/json" data-sjs>{"define":[["InstagramSecurityConfig",[],{"csrf_token":"Q5Q_sDAX"},2]]}</script>',
    ...blocks.map((b) => `<script type="application/json" data-sjs>${JSON.stringify(b)}</script>`),
    '</head><body></body></html>',
  ].join('\n');
}

const errorPageHtml = '<!DOCTYPE html><html><head><title>Instagram</title></head><body><script type="application/json" data-sjs>{"require":[["ScheduledServerJS","handle",null,[{"__bbox":{"require":[["PolarisErrorRoot.react"]],"pageID":"httpErrorPage"}}]]]}</script></body></html>';

function embedHtml(contextJson: unknown): string {
  // The page stores the payload as a JS string literal inside a JSON attribute: JSON.stringify twice.
  const literal = JSON.stringify(JSON.stringify(contextJson));
  return `<!DOCTYPE html><html><body><script>window.__additionalData = {"contextJSON":${literal}};</script></body></html>`;
}

/* ---------------- tests ---------------- */

describe('helpers', () => {
  it('derives the shortcode and an approximate timestamp from a media id', () => {
    expect(shortcodeFromMediaId('3986184822734042466')).toBe('DdRxfoAHbVi');
    const ts = timestampFromMediaId('3986184822734042466');
    expect(ts).toBeDefined();
    // Real taken_at is 2026-09-14T21:00Z; the id encodes the upload minute within a few hours.
    expect(Math.abs((ts ?? 0) - Date.UTC(2026, 8, 14, 21, 0, 2))).toBeLessThan(4 * 60 * 60 * 1000);
    expect(shortcodeFromMediaId('nope')).toBe('');
    expect(timestampFromMediaId('nope')).toBeUndefined();
  });

  it('parses compact numbers in English and Turkish formats', () => {
    expect(parseCompactNumber('269M')).toBe(269_000_000);
    expect(parseCompactNumber('4,130')).toBe(4130);
    expect(parseCompactNumber('1.5K')).toBe(1500);
    expect(parseCompactNumber('1,234,567')).toBe(1_234_567);
    expect(parseCompactNumber('2 Mn')).toBe(2_000_000);
    expect(parseCompactNumber('1,5 Mn')).toBe(1_500_000);
    expect(parseCompactNumber('12')).toBe(12);
    expect(parseCompactNumber('abc')).toBeUndefined();
  });

  it('reads follower / following / post counts from og:description', () => {
    expect(parseOgCounts(profileHtml())).toEqual({ followers: 269_000_000, following: 195, posts: 32_000 });
    const tr = '<meta property="og:description" content="680M Takip&#xe7;i, 649 Takip, 4,130 G&#xf6;nderi - Cristiano Ronaldo&#039;in (&#064;cristiano) Instagram fotoğrafları" />';
    expect(parseOgCounts(tr)).toEqual({ followers: 680_000_000, following: 649, posts: 4130 });
  });
});

describe('parseProfilePage', () => {
  it('extracts the profile, the embedded posts and the page tokens', () => {
    const page = parseProfilePage(profileHtml());
    expect(page.status).toBe('ok');
    if (page.status !== 'ok') return;
    expect(page.user).toMatchObject({ pk: '787132', username: 'natgeo', fullName: 'National Geographic', followerCount: 268541293, followingCount: 194, mediaCount: 32_000, isVerified: true, isPrivate: false });
    expect(page.media).toHaveLength(3);
    expect(page.media[0]).toMatchObject({ pk: '3986184822734042466', code: 'DdRxfoAHbVi', kind: 'image', imageUrl: 'https://cdn.example/big.jpg', width: 1080, height: 1350, isPinned: true, caption: 'Think you need 10,000 steps?' });
    expect(page.media[1]).toMatchObject({ kind: 'video', productType: 'clips', caption: '' });
    expect(page.media[2]).toMatchObject({ kind: 'carousel' });
    expect(page.endCursor).toBe('CURSOR_1');
    expect(page.lsd).toBe('AdT1rhRw');
    expect(page.csrf).toBe('Q5Q_sDAX');
  });

  it('still returns the profile when the posts block is missing', () => {
    const page = parseProfilePage(profileHtml({ withTimeline: false }));
    expect(page.status).toBe('ok');
    if (page.status !== 'ok') return;
    expect(page.media).toEqual([]);
    expect(page.endCursor).toBeUndefined();
  });

  it("recognises Instagram's generic error page and unknown pages", () => {
    expect(parseProfilePage(errorPageHtml).status).toBe('error_page');
    expect(parseProfilePage('<html><body>' + 'x'.repeat(300) + '</body></html>').status).toBe('unrecognized');
    expect(parseProfilePage('').status).toBe('unrecognized');
  });
});

describe('parseTimelineResponse', () => {
  it('reads a GraphQL pagination payload', () => {
    const result = parseTimelineResponse({ data: { xig_user_by_igid_v2: { polaris_timeline_connection: { edges: [{ node: { pk: '1', media_type: 1, image_versions2: { candidates: [{ url: 'u', width: 1, height: 1 }] } } }], page_info: { has_next_page: false, end_cursor: null } } } } });
    expect(result?.media).toHaveLength(1);
    expect(result?.endCursor).toBeUndefined();
    expect(parseTimelineResponse({ data: {} })).toBeNull();
  });
});

describe('parseEmbedPage', () => {
  it('reads structured counts for videos and albums', () => {
    const html = embedHtml({
      context: { type: 'GraphVideo', shortcode: 'DdRMVvHglvP' },
      gql_data: {
        shortcode_media: {
          __typename: 'GraphVideo',
          shortcode: 'DdRMVvHglvP',
          is_video: true,
          display_url: 'https://cdn.example/cover.jpg',
          dimensions: { height: 1920, width: 1080 },
          video_duration: 30.549,
          video_view_count: 196705,
          edge_media_to_caption: { edges: [{ node: { text: 'Sometimes' } }] },
          edge_media_to_comment: { count: 291 },
          edge_liked_by: { count: 58311 },
          video_url: 'https://cdn.example/video.mp4',
          edge_sidecar_to_children: { edges: [{ node: { id: '9', is_video: true, display_url: 'https://cdn.example/c.jpg', video_url: 'https://cdn.example/c.mp4' } }] },
        },
      },
    });
    expect(parseEmbedPage(html)).toEqual({
      shortcode: 'DdRMVvHglvP',
      likeCount: 58311,
      commentCount: 291,
      viewCount: 196705,
      videoDuration: 30.549,
      videoUrl: 'https://cdn.example/video.mp4',
      displayUrl: 'https://cdn.example/cover.jpg',
      width: 1080,
      height: 1920,
      caption: 'Sometimes',
      isVideo: true,
      takenAt: undefined,
      children: [{ id: '9', isVideo: true, displayUrl: 'https://cdn.example/c.jpg', videoUrl: 'https://cdn.example/c.mp4' }],
      structured: true,
    });
  });

  it('falls back to the visible counts for photo embeds', () => {
    const html = '<!DOCTYPE html><html><body>' + 'x'.repeat(200) + '<span class="LikeCount">14,568 likes</span><span class="CaptionComments">85 comments</span></body></html>';
    expect(parseEmbedPage(html)).toEqual({ likeCount: 14568, commentCount: 85, viewCount: undefined, structured: false });
    expect(parseEmbedPage('<html>' + 'x'.repeat(300) + '</html>')).toBeNull();
  });
});

describe('normalizeParsedProfile', () => {
  it('builds the account and posts with placeholder counts until embeds arrive', () => {
    const page = parseProfilePage(profileHtml());
    if (page.status !== 'ok') throw new Error('fixture');
    const { account, media, nextCursor } = normalizeParsedProfile(page);
    expect(account).toMatchObject({ id: '787132', username: 'natgeo', followersCount: 268541293, followsCount: 194, mediaCount: 32_000, source: 'public' });
    expect(nextCursor).toBe('CURSOR_1');
    expect(media.map((m) => m.type)).toEqual(['IMAGE', 'REEL', 'CAROUSEL_ALBUM']);
    expect(media[0]?.permalink).toBe('https://www.instagram.com/p/DdRxfoAHbVi/');
    expect(media[1]?.permalink).toBe('https://www.instagram.com/reel/DdRMVvHglvP/');
    expect(media[0]?.isPinned).toBe(true);
    for (const m of media) {
      expect(m.countsEstimated).toBe(true);
      expect(m.likeCount).toBeGreaterThan(0);
    }
    expect(media[1]?.viewCount).toBeGreaterThan(media[1]?.likeCount ?? 0);
  });

  it('keeps placeholder counts deterministic and scaled to the audience', () => {
    const a = estimatePublicCounts('1', 'IMAGE', 10_000);
    expect(estimatePublicCounts('1', 'IMAGE', 10_000)).toEqual(a);
    expect(a.likeCount).toBeGreaterThan(50);
    expect(a.likeCount).toBeLessThan(2000);
    const big = estimatePublicCounts('1', 'IMAGE', 250_000_000);
    expect(big.likeCount / 250_000_000).toBeLessThan(0.002);
  });

  it('replaces placeholders with embed numbers', () => {
    const page = parseProfilePage(profileHtml());
    if (page.status !== 'ok') throw new Error('fixture');
    const { media } = normalizeParsedProfile(page);
    const reel = applyEmbedDetails(media[1]!, { likeCount: 58311, commentCount: 291, viewCount: 196705, videoDuration: 30.5, videoUrl: 'https://cdn.example/v.mp4', structured: true });
    expect(reel).toMatchObject({ likeCount: 58311, commentCount: 291, viewCount: 196705, durationSec: 30.5, videoUrl: 'https://cdn.example/v.mp4', countsEstimated: false });
    // Views are only meaningful for videos: a photo embed's stray "views" must not leak in.
    const photo = applyEmbedDetails(media[0]!, { likeCount: 10, commentCount: 1, viewCount: 999, structured: false });
    expect(photo.viewCount).toBeUndefined();
    expect(photo.countsEstimated).toBe(false);
  });
});
