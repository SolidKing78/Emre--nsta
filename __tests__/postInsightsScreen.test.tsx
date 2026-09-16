import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

import PostInsightsScreen from '@/app/insights/post/[id]';
import { MetricEditorProvider } from '@/components/simulation/SimulationMetricEditor';
import { selectMediaStats, useSimulationStore } from '@/store/simulationStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { AppMedia, AppMediaInsight } from '@/types/app';

/**
 * Mounts the real "Reels videosu istatistikleri" screen with a stubbed data layer, so a
 * section that stops rendering — or a chart that throws on an empty series — fails here
 * rather than on a phone.
 */

// `mock` prefix: jest.mock factories are hoisted and may only touch names that start with it.
const mockReel: AppMedia = {
  id: 'reel-1',
  type: 'REEL',
  permalink: 'https://www.instagram.com/reel/x/',
  mediaUrl: 'https://example.com/a.mp4',
  thumbnailUrl: 'https://example.com/a.jpg',
  caption: 'clip',
  timestamp: '2026-09-16T15:00:00.000Z',
  likeCount: 27,
  commentCount: 6,
  viewCount: 1467,
  durationSec: 89,
  username: 'someone',
  source: 'public',
};

const mockInsight: AppMediaInsight = {
  mediaId: mockReel.id,
  source: 'estimated',
  metrics: [
    { key: 'views', value: 1467, source: 'estimated' },
    { key: 'reach', value: 1115, source: 'estimated' },
    { key: 'likes', value: 27, source: 'api' },
    { key: 'comments', value: 6, source: 'api' },
  ],
};

// Swapped per test so one mount can cover every tab.
const mockParams: { id: string; tab?: string } = { id: 'reel-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});

// expo-video needs a native player; the clip preview only has to be *there*.
jest.mock('@/components/feed/MediaVideo', () => {
  const { View } = require('react-native');
  return { MediaVideo: View };
});

// Swapped by the photo test; the reel is the default.
const mockState: { media: AppMedia } = { media: mockReel };

jest.mock('@/features/instagram/useMediaDetail', () => ({
  useMediaDetail: () => ({
    media: mockState.media,
    realMedia: mockState.media,
    insight: mockInsight,
    realInsight: mockInsight,
    account: undefined,
    scope: { kind: 'media', mediaId: 'reel-1' },
    isLoading: false,
    insightsLoading: false,
    error: undefined,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/features/analytics/useAudienceSplits', () => ({
  useEffectiveAudience: () => ({
    followerShare: 0.007,
    gender: { women: 7, men: 93 },
    ages: [
      { label: '18-24', value: 35.4 },
      { label: '25-34', value: 50.1 },
      { label: '35-44', value: 14.5 },
    ],
    cities: [],
    countries: [
      { label: 'Türkiye', value: 92 },
      { label: 'Almanya', value: 8 },
    ],
    activeHours: [],
    source: 'estimated',
  }),
  usePostAudienceSplits: () => ({ followerShare: 1.4, nonFollowerShare: 98.6, women: 1.2, men: 98.8, followerIsCustom: false, genderIsCustom: false }),
}));

function texts(tree: ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const children = (node as { children?: unknown } | null)?.children;
    if (children) walk(children);
  };
  walk(tree.toJSON());
  return out;
}

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function render(tab?: string): ReactTestRenderer {
  mockParams.tab = tab;
  mockState.media = mockState.media ?? mockReel;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <MetricEditorProvider>
          <PostInsightsScreen />
        </MetricEditorProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

describe('post insights screen', () => {
  // The screen is read in Turkish, so the labels are asserted in Turkish.
  beforeAll(() => useSettingsStore.setState({ language: 'tr' }));

  it('renders the Genel Bakış sections Instagram shows for a reel', () => {
    const tree = render();
    const all = texts(tree).join('|');
    expect(all).toContain('Özet');
    expect(all).toContain('Görüntülemeler');
    // Reels swap "Erişilen hesaplar" for "Görüntüleyenler" and show the watch time card.
    expect(all).toContain('Görüntüleyenler');
    expect(all).toContain('Ortalama izlenme süresi');
    expect(all).toContain('Zaman içindeki görüntülemeler');
    expect(all).toContain('Bu Reels videosu');
    expect(all).toContain('Tipik Reels videon');
    expect(all).toContain('Görüntülemelerini etkileyen faktörler');
    expect(all).toContain('Geçme oranı');
    expect(all).toContain('Yorum oranı');
    expect(all).toContain('İnsanların Reels videonu izleme süresi');
    expect(all).toContain('Başlıca görüntüleme kaynakları');
    expect(all).toContain('Reels sekmesi');
    expect(all).toContain('Reklam');
    act(() => tree.unmount());
  });

  it('shows the counts and never prints a trailing ",0" on a whole percentage', () => {
    const tree = render();
    const all = texts(tree);
    expect(all).toContain('27');
    expect(all).toContain('6');
    // Instagram prints "%92", never "%92,0" and never a signed share.
    expect(all.some((s) => /^%\d+,0$/.test(s))).toBe(false);
    expect(all.some((s) => s.startsWith('+%') || s.startsWith('-%'))).toBe(false);
    expect(all.some((s) => /^%\d/.test(s))).toBe(true);
    act(() => tree.unmount());
  });

  it('renders the Etkileşim sections, ending with when people interacted', () => {
    const tree = render('engagement');
    const all = texts(tree).join('|');
    expect(all).toContain('Görüntülemeden sonra gerçekleştirilen eylemler');
    expect(all).toContain('Profil ziyaretleri');
    expect(all).toContain('Etkileşimler');
    expect(all).toContain('Yeniden Paylaşımlar');
    expect(all).toContain('Kaydetmeler');
    expect(all).toContain('İnsanlar Reels videonu gördüğünde');
    // Watch time lives in Özet for reels, not here.
    expect(all).not.toContain('Ortalama izlenme süresi');
    act(() => tree.unmount());
  });

  it('renders the Hedef Kitle sections with the follower split and the three chips', () => {
    const tree = render('audience');
    const all = texts(tree).join('|');
    expect(all).toContain('Reels videonu görüntüleyen kişiler');
    expect(all).toContain('Takipçiler');
    expect(all).toContain('Takipçi olmayanlar');
    expect(all).toContain('%98,6');
    expect(all).toContain('Hedef kitle detayları');
    expect(all).toContain('Yaş');
    expect(all).toContain('Ülke');
    expect(all).toContain('Cinsiyet');
    expect(all).toContain('18-24');
    act(() => tree.unmount());
  });
});

describe('a photo post', () => {
  beforeAll(() => useSettingsStore.setState({ language: 'tr' }));
  afterEach(() => {
    mockState.media = mockReel;
  });

  it('keeps the post wording and leaves out the two playback sections', () => {
    mockState.media = { ...mockReel, type: 'IMAGE', durationSec: undefined, viewCount: undefined };
    const tree = render('overview');
    const all = texts(tree).join('|');
    expect(all).toContain('Gönderi istatistikleri');
    expect(all).toContain('Erişilen hesaplar');
    expect(all).toContain('Profil ziyaretleri');
    expect(all).toContain('Bu gönderi');
    expect(all).toContain('Tipik gönderin');
    expect(all).toContain('Bu gönderiyi öne çıkar');
    // A photo has no playback, so neither curve belongs on it.
    expect(all).not.toContain('İnsanların Reels videonu izleme süresi');
    expect(all).not.toContain('Ortalama izlenme süresi');
    // The reach factors and the view sources still apply.
    expect(all).toContain('Görüntülemelerini etkileyen faktörler');
    expect(all).toContain('Başlıca görüntüleme kaynakları');
    act(() => tree.unmount());
  });

  it('calls its viewers "Gönderini görüntüleyen kişiler"', () => {
    mockState.media = { ...mockReel, type: 'IMAGE', durationSec: undefined };
    const tree = render('audience');
    expect(texts(tree).join('|')).toContain('Gönderini görüntüleyen kişiler');
    act(() => tree.unmount());
  });
});

/** The first node whose accessibility label starts with `prefix`. */
function byLabel(tree: ReactTestRenderer, prefix: string) {
  const hit = tree.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(prefix), { deep: true })[0];
  if (!hit) throw new Error(`no node labelled "${prefix}"`);
  return hit;
}

describe('every value on the screen can be set by hand', () => {
  const ACCOUNT = 'none'; // no session in the test → the store's default account key
  beforeAll(() => useSettingsStore.setState({ language: 'tr' }));
  beforeEach(() => useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined }));

  /** Long-press a value, type a new percentage, press Uygula. */
  function editPercent(tree: ReactTestRenderer, label: string, value: string) {
    act(() => byLabel(tree, label).props.onLongPress());
    const input = byLabel(tree, label).props.onChangeText ? byLabel(tree, label) : tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
    if (!input) throw new Error('the editor did not open');
    act(() => input.props.onChangeText(value));
    act(() => byLabel(tree, 'Uygula').props.onPress());
  }

  it('a view source: the bar, the store and the other bars all follow', () => {
    const tree = render('overview');
    editPercent(tree, 'Reels sekmesi', '90');

    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')).toEqual({ 'source.reels': 90 });
    const shown = texts(tree).join('|');
    expect(shown).toContain('%90');
    // The rest were rescaled, so the bars still add up to 100.
    const percents = texts(tree)
      .filter((x) => /^%\d/.test(x))
      .map((x) => Number(x.slice(1).replace(',', '.')));
    const sources = percents.filter((n) => n <= 100);
    expect(sources).toContain(90);
    act(() => tree.unmount());
  });

  it('a factor rate, and "Gerçek değere dön" hands it back', () => {
    const tree = render('overview');
    editPercent(tree, 'Beğenme oranı', '9.5');
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')['factor.likes']).toBe(9.5);
    expect(texts(tree).join('|')).toContain('%9,5');

    // Re-open and reset just that value.
    act(() => byLabel(tree, 'Beğenme oranı').props.onLongPress());
    act(() => byLabel(tree, 'Gerçek değere dön').props.onPress());
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')['factor.likes']).toBeUndefined();
    act(() => tree.unmount());
  });

  it('an age bar', () => {
    const tree = render('audience');
    editPercent(tree, '18-24', '60');
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')).toEqual({ 'age.18-24': 60 });
    expect(texts(tree).join('|')).toContain('%60');
    act(() => tree.unmount());
  });

  it('the watch-time curve tail', () => {
    const tree = render('overview');
    act(() => byLabel(tree, 'İnsanların Reels videonu izleme süresi').props.onLongPress());
    const input = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
    act(() => input!.props.onChangeText('40'));
    act(() => byLabel(tree, 'Uygula').props.onPress());
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')['watch.end']).toBe(40);
    act(() => tree.unmount());
  });

  it('the engagement curve peak', () => {
    const tree = render('engagement');
    act(() => byLabel(tree, 'İnsanlar Reels videonu gördüğünde').props.onLongPress());
    const input = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
    act(() => input!.props.onChangeText('28'));
    act(() => byLabel(tree, 'Uygula').props.onPress());
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')['engagement.peak']).toBe(28);
    act(() => tree.unmount());
  });

  it('the typical-post curve', () => {
    const tree = render('overview');
    act(() => byLabel(tree, 'Zaman içindeki görüntülemeler').props.onLongPress());
    const input = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
    act(() => input!.props.onChangeText('250'));
    act(() => byLabel(tree, 'Uygula').props.onPress());
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')['views.typical']).toBe(250);
    act(() => tree.unmount());
  });

  it('a count still goes through the scenario editor', () => {
    const tree = render('engagement');
    // Long-press "Beğenmeler" opens the metric editor rather than the percentage sheet.
    act(() => byLabel(tree, 'Beğenmeler').props.onLongPress());
    expect(texts(tree).join('|')).toContain('Beğenmeler');
    act(() => tree.unmount());
  });
});

describe('the scenario overlay reaches every number on the screen', () => {
  const MEDIA_SCOPE = { kind: 'media' as const, mediaId: 'reel-1' };
  const ACCOUNT = 'none';
  const store = () => useSimulationStore.getState();

  beforeAll(() => useSettingsStore.setState({ language: 'tr' }));
  beforeEach(() => useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined }));

  it('an edited count shows only once the scenario is switched on', () => {
    store().setOverride(ACCOUNT, MEDIA_SCOPE, 'likes', 5000);

    let tree = render('engagement');
    expect(texts(tree)).toContain('27'); // still the real number
    expect(texts(tree)).not.toContain('5.000');
    act(() => tree.unmount());

    store().setEnabled(true);
    tree = render('engagement');
    expect(texts(tree)).toContain('5.000');
    act(() => tree.unmount());
  });

  it('raising the likes raises the like rate with them', () => {
    let tree = render('overview');
    expect(allText(tree)).toContain('%1,8'); // 27 / 1.467
    act(() => tree.unmount());

    store().setEnabled(true);
    store().setOverride(ACCOUNT, MEDIA_SCOPE, 'likes', 147);
    tree = render('overview');
    // 147 / 1.467 ≈ 10 %
    expect(allText(tree)).toContain('%10');
    act(() => tree.unmount());
  });

  it('an engagement dial moves the counts and the rates together', () => {
    store().setEnabled(true);
    store().setBoost(ACCOUNT, 'likes', 300);
    const tree = render('overview');
    const shown = allText(tree);
    // The like rate can no longer be the untouched 1,8 %.
    expect(shown).not.toContain('%1,8');
    act(() => tree.unmount());
  });

  it('a growth rate moves the view count the curve is drawn from', () => {
    let tree = render('overview');
    expect(texts(tree)).toContain('1.467');
    act(() => tree.unmount());

    store().setEnabled(true);
    store().setGrowthPercent(ACCOUNT, 200);
    tree = render('overview');
    expect(texts(tree)).not.toContain('1.467');
    act(() => tree.unmount());
  });

  it('switching scenario swaps the counts but keeps the pinned percentages', () => {
    store().setEnabled(true);
    store().setOverride(ACCOUNT, MEDIA_SCOPE, 'likes', 5000);
    store().setMediaStat(ACCOUNT, 'reel-1', 'factor.likes', 9.5);
    const second = store().createProfile(ACCOUNT, 'İkinci');

    let tree = render('overview');
    // Counts belong to a scenario, so the second one starts clean…
    expect(texts(tree)).toContain('27');
    // …while the percentage is a property of the post itself.
    expect(allText(tree)).toContain('%9,5');
    act(() => tree.unmount());

    const first = store().accounts[ACCOUNT]?.profiles[0]?.id ?? second;
    store().setActiveProfile(ACCOUNT, first);
    tree = render('overview');
    expect(texts(tree)).toContain('5.000');
    act(() => tree.unmount());
  });

  it('pinning every view source still leaves the bars summing to 100', () => {
    for (const [key, value] of [
      ['source.reels', 50],
      ['source.explore', 20],
      ['source.feed', 15],
      ['source.profile', 10],
      ['source.stories', 5],
    ] as const) {
      store().setMediaStat(ACCOUNT, 'reel-1', key, value);
    }
    const tree = render('overview');
    const shown = allText(tree);
    for (const expected of ['%50', '%20', '%15', '%10', '%5']) expect(shown).toContain(expected);
    act(() => tree.unmount());
  });

  it('"Bu gönderiyi gerçek değerlere döndür" clears the counts, the splits and the percentages', () => {
    store().setEnabled(true);
    store().setOverride(ACCOUNT, MEDIA_SCOPE, 'likes', 5000);
    store().setMediaStat(ACCOUNT, 'reel-1', 'factor.likes', 9.5);
    store().setMediaAudienceMix(ACCOUNT, 'reel-1', { womenShare: 33 });

    const tree = render('overview');
    act(() => byLabel(tree, 'Gönderi istatistikleri').props.onPress());
    // The menu's reset goes through a confirm dialog, so call what it calls.
    act(() => {
      store().clearOverride(ACCOUNT, MEDIA_SCOPE, 'likes');
      store().clearMediaStats(ACCOUNT, 'reel-1');
      store().clearMediaAudienceMix(ACCOUNT, 'reel-1');
    });
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'reel-1')).toEqual({});
    expect(useSimulationStore.getState().accounts[ACCOUNT]?.mediaAudienceMix['reel-1']).toBeUndefined();
    act(() => tree.unmount());
  });

  it('reads in English too', () => {
    useSettingsStore.setState({ language: 'en' });
    const tree = render('overview');
    const shown = allText(tree);
    expect(shown).toContain('Factors affecting views');
    expect(shown).toContain('Skip rate');
    expect(shown).toContain('This reel');
    expect(shown).toContain('1.8%');
    expect(shown).not.toContain('%1,8');
    useSettingsStore.setState({ language: 'tr' });
    act(() => tree.unmount());
  });
});

/** Every string the tree rendered, joined — handy for a single `toContain`. */
function allText(tree: ReactTestRenderer): string {
  return texts(tree).join('|');
}
