import { accountGenderSplit, followerSplitFor, genderSplitFor } from '@/services/analytics/audienceMix';
import { applyBucketOverrides, statKey } from '@/services/analytics/reelInsights';
import { countPostEdits, selectAccountStats, selectAudienceMix, selectMediaAudienceMix, selectMediaStats, useSimulationStore } from '@/store/simulationStore';
import { DEFAULT_AUDIENCE_MIX } from '@/types/simulation';

const ACCOUNT = 'demo:zmtprefabrik';
const OTHER = 'public:natgeo';
const MEDIA = 'reel-1';

const state = () => useSimulationStore.getState();

describe('audience mix in the store', () => {
  beforeEach(() => {
    useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined });
  });

  it('starts every account on Instagram-shaped defaults', () => {
    state().ensureAccount(ACCOUNT);
    expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual(DEFAULT_AUDIENCE_MIX);
  });

  it('merges a patch instead of replacing the mix', () => {
    state().setAudienceMix(ACCOUNT, { womenShare: 12 });
    const mix = selectAudienceMix(useSimulationStore.getState(), ACCOUNT);
    expect(mix.womenShare).toBe(12);
    expect(mix.followerShare).toBe(DEFAULT_AUDIENCE_MIX.followerShare);
    expect(accountGenderSplit(mix)).toEqual({ women: 12, men: 88 });
  });

  it('clamps whatever it is handed', () => {
    state().setAudienceMix(ACCOUNT, { followerShare: 999, followerVariance: 80, womenShare: -4 });
    const mix = selectAudienceMix(useSimulationStore.getState(), ACCOUNT);
    expect(mix.followerShare).toBe(100);
    expect(mix.followerVariance).toBe(50);
    expect(mix.womenShare).toBe(0);
  });

  it('keeps one account out of another', () => {
    state().setAudienceMix(ACCOUNT, { womenShare: 40 });
    expect(selectAudienceMix(useSimulationStore.getState(), OTHER).womenShare).toBe(DEFAULT_AUDIENCE_MIX.womenShare);
  });

  it('pins one post and hands it back', () => {
    state().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
    let perMedia = selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT);
    expect(genderSplitFor(MEDIA, DEFAULT_AUDIENCE_MIX, perMedia[MEDIA])).toEqual({ women: 33, men: 67 });

    state().clearMediaAudienceMix(ACCOUNT, MEDIA);
    perMedia = selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT);
    expect(perMedia[MEDIA]).toBeUndefined();
    // Back on the mix, so it drifts around 7 % again.
    expect(genderSplitFor(MEDIA, DEFAULT_AUDIENCE_MIX).women).toBeGreaterThanOrEqual(5);
    expect(genderSplitFor(MEDIA, DEFAULT_AUDIENCE_MIX).women).toBeLessThanOrEqual(9);
  });

  it('a mix change moves every post that was not pinned', () => {
    state().setMediaAudienceMix(ACCOUNT, 'pinned', { followerShare: 50 });
    state().setAudienceMix(ACCOUNT, { followerShare: 20, followerVariance: 0 });
    const mix = selectAudienceMix(useSimulationStore.getState(), ACCOUNT);
    const perMedia = selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT);
    expect(followerSplitFor('free', mix, perMedia.free).followerShare).toBe(20);
    expect(followerSplitFor('pinned', mix, perMedia.pinned).followerShare).toBe(50);
  });

  it('reset clears the mix and every pinned post with it', () => {
    state().setAudienceMix(ACCOUNT, { womenShare: 40 });
    state().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
    state().resetAudienceMix(ACCOUNT);
    expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual(DEFAULT_AUDIENCE_MIX);
    expect(selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual({});
  });
});

describe('hand-set percentages in the store', () => {
  beforeEach(() => {
    useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined });
  });

  const stats = () => selectMediaStats(useSimulationStore.getState(), ACCOUNT, MEDIA);

  it('stores one value per dotted key', () => {
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'likes'), 9.5);
    state().setMediaStat(ACCOUNT, MEDIA, statKey('source', 'reels'), 82.1);
    expect(stats()).toEqual({ 'factor.likes': 9.5, 'source.reels': 82.1 });
  });

  it('undefined gives a single value back without touching the others', () => {
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'likes'), 9.5);
    state().setMediaStat(ACCOUNT, MEDIA, statKey('watch', 'end'), 20);
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'likes'), undefined);
    expect(stats()).toEqual({ 'watch.end': 20 });
  });

  it('drops the post entirely once nothing is left', () => {
    state().setMediaStat(ACCOUNT, MEDIA, statKey('watch', 'end'), 20);
    state().setMediaStat(ACCOUNT, MEDIA, statKey('watch', 'end'), undefined);
    expect(stats()).toEqual({});
    expect(useSimulationStore.getState().accounts[ACCOUNT]?.mediaStats[MEDIA]).toBeUndefined();
  });

  it('clamps and keeps posts apart', () => {
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'skip'), -5);
    state().setMediaStat(ACCOUNT, 'other-post', statKey('factor', 'skip'), 40);
    expect(stats()).toEqual({ 'factor.skip': 0 });
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'other-post')).toEqual({ 'factor.skip': 40 });
  });

  it('clearMediaStats wipes just that post', () => {
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'skip'), 30);
    state().setMediaStat(ACCOUNT, 'other-post', statKey('factor', 'skip'), 40);
    state().clearMediaStats(ACCOUNT, MEDIA);
    expect(stats()).toEqual({});
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, 'other-post')).toEqual({ 'factor.skip': 40 });
  });

  it('feeds straight into the bars: a pinned share rescales the rest', () => {
    state().setMediaStat(ACCOUNT, MEDIA, statKey('source', 'reels'), 90);
    const bars = applyBucketOverrides(
      [
        { key: 'reels', label: 'Reels sekmesi', percent: 60 },
        { key: 'explore', label: 'Keşfet', percent: 30 },
        { key: 'feed', label: 'Akış', percent: 10 },
      ],
      'source',
      stats(),
    );
    expect(bars.find((b) => b.key === 'reels')?.percent).toBe(90);
    expect(bars.reduce((acc, b) => acc + b.percent, 0)).toBeCloseTo(100, 1);
  });

  it('removing a simulated post takes its percentages and its splits with it', () => {
    state().addSimulatedMedia(ACCOUNT, {
      id: MEDIA,
      type: 'REEL',
      localUri: 'file:///a.mp4',
      caption: '',
      timestamp: new Date().toISOString(),
      likeCount: 1,
      commentCount: 0,
    });
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'skip'), 30);
    state().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
    state().removeSimulatedMedia(ACCOUNT, MEDIA);
    expect(stats()).toEqual({});
    expect(selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT)[MEDIA]).toBeUndefined();
  });
});

describe('account-level bars', () => {
  beforeEach(() => {
    useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined });
  });

  it('stores and gives back a single bar', () => {
    state().setAccountStat(ACCOUNT, statKey('age', '18-24'), 42);
    state().setAccountStat(ACCOUNT, statKey('country', 'Türkiye'), 91.3);
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({ 'age.18-24': 42, 'country.Türkiye': 91.3 });

    state().setAccountStat(ACCOUNT, statKey('age', '18-24'), undefined);
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({ 'country.Türkiye': 91.3 });
  });

  it('is kept apart from the per-post ones', () => {
    state().setAccountStat(ACCOUNT, statKey('age', '18-24'), 42);
    state().setMediaStat(ACCOUNT, MEDIA, statKey('age', '18-24'), 10);
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({ 'age.18-24': 42 });
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, MEDIA)).toEqual({ 'age.18-24': 10 });

    state().clearAccountStats(ACCOUNT);
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({});
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, MEDIA)).toEqual({ 'age.18-24': 10 });
  });
});

describe('counting and resetting what a user pinned', () => {
  beforeEach(() => {
    useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined });
  });

  it('a post’s badge counts its numbers, its split and its percentages', () => {
    expect(countPostEdits(useSimulationStore.getState(), ACCOUNT, MEDIA)).toBe(0);
    state().setOverride(ACCOUNT, { kind: 'media', mediaId: MEDIA }, 'likes', 500);
    state().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'likes'), 9.5);
    state().setMediaStat(ACCOUNT, MEDIA, statKey('source', 'reels'), 90);
    expect(countPostEdits(useSimulationStore.getState(), ACCOUNT, MEDIA)).toBe(4);
    // Another post is counted on its own.
    expect(countPostEdits(useSimulationStore.getState(), ACCOUNT, 'other')).toBe(0);
  });

  it('"Tüm senaryoları sıfırla" really does clear everything', () => {
    state().setEnabled(true);
    state().setOverride(ACCOUNT, { kind: 'account' }, 'followers', 90_000);
    state().setOverride(ACCOUNT, { kind: 'media', mediaId: MEDIA }, 'likes', 500);
    state().setGrowthPercent(ACCOUNT, 120);
    state().setBoost(ACCOUNT, 'likes', 80);
    state().setAudienceMix(ACCOUNT, { womenShare: 40 });
    state().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
    state().setMediaStat(ACCOUNT, MEDIA, statKey('factor', 'likes'), 9.5);
    state().setAccountStat(ACCOUNT, statKey('age', '18-24'), 42);

    state().resetAll(ACCOUNT);

    const account = useSimulationStore.getState().accounts[ACCOUNT];
    expect(account?.profiles[0]?.overrides).toEqual({});
    expect(account?.profiles[0]?.growthPercent).toBe(0);
    expect(account?.profiles[0]?.boosts).toEqual({});
    expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual(DEFAULT_AUDIENCE_MIX);
    expect(selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual({});
    expect(selectMediaStats(useSimulationStore.getState(), ACCOUNT, MEDIA)).toEqual({});
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({});
    expect(countPostEdits(useSimulationStore.getState(), ACCOUNT, MEDIA)).toBe(0);
  });
});
