import React from 'react';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { AudienceTab } from '@/components/analytics/insights/AudienceTab';
import { StatPercentSheet, type StatEdit } from '@/components/simulation/StatPercentSheet';
import { selectAccountStats, useSimulationStore } from '@/store/simulationStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { AppAudience, DateRange } from '@/types/app';

import { allText, byLabel, editViaLongPress, renderWithProviders, texts, unmount } from './helpers/render';

/**
 * The account "Hedef kitle" tab: every demographic bar has to be editable the same way the
 * per-post ones are, and what it writes has to be what the screen then reads back.
 */

const ACCOUNT = 'none'; // no session in tests → the store's default account key

const audience: AppAudience = {
  followerShare: 0.007,
  gender: { women: 7, men: 93 },
  ages: [
    { label: '18-24', value: 30 },
    { label: '25-34', value: 50 },
    { label: '35-44', value: 20 },
  ],
  cities: [{ label: 'İstanbul', value: 100 }],
  countries: [
    { label: 'Türkiye', value: 92 },
    { label: 'Almanya', value: 8 },
  ],
  activeHours: Array.from({ length: 24 }, () => 0.5),
  source: 'estimated',
};

const range: DateRange = { preset: '30d', since: '2026-08-17', until: '2026-09-16' };

const data = {
  account: { followersCount: 11_300 },
  effectiveAccount: { followersCount: 11_300, username: 'someone' },
  audience,
  growth: { total: [], follows: [], unfollows: [], netTotal: 120, followsTotal: 200, unfollowsTotal: 80 },
} as unknown as Parameters<typeof AudienceTab>[0]['data'];

/** The tab plus the sheet its long-presses open, wired the way the screen wires them. */
function Harness() {
  const [edit, setEdit] = React.useState<StatEdit | null>(null);
  return (
    <>
      <AudienceTab
        data={data}
        range={range}
        rangeLabel="30 gün"
        onOpenRange={() => undefined}
        onInfo={() => undefined}
        onEditAudience={() => undefined}
        onEditBucket={(group, label, value, isCustom) => setEdit({ key: `${group}.${label}`, title: label, value, isCustom })}
      />
      <StatPercentSheet edit={edit} onClose={() => setEdit(null)} />
    </>
  );
}

const render = (): ReactTestRenderer => renderWithProviders(<Harness />);

describe('account audience tab', () => {
  beforeAll(() => useSettingsStore.setState({ language: 'tr' }));
  beforeEach(() => useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined }));

  it('draws the gender split men-first and all four demographic sections', () => {
    const tree = render();
    const all = texts(tree);
    const joined = allText(tree);
    expect(joined).toContain('Cinsiyet');
    expect(joined).toContain('Yaş aralığı');
    expect(joined).toContain('En çok bulunulan şehirler');
    expect(joined).toContain('En çok bulunulan ülkeler');
    // Instagram lists the larger share first.
    expect(all.indexOf('Erkekler')).toBeLessThan(all.indexOf('Kadınlar'));
    // Shares print the way Instagram prints them: a whole number stays whole.
    expect(joined).toContain('%93');
    expect(joined).not.toContain('%93,0');
    unmount(tree);
  });

  it('long-press an age bar → set it → the store keeps it', () => {
    const tree = render();
    editViaLongPress(tree, '18-24', '45');
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({ 'age.18-24': 45 });
    unmount(tree);
  });

  it('a country bar goes through the same sheet', () => {
    const tree = render();
    editViaLongPress(tree, 'Türkiye', '80');
    expect(selectAccountStats(useSimulationStore.getState(), ACCOUNT)).toEqual({ 'country.Türkiye': 80 });
    unmount(tree);
  });

  it('says the value covers the whole account, not one post', () => {
    const tree = render();
    act(() => byLabel(tree, '18-24').props.onLongPress());
    expect(allText(tree)).toContain('Bu değer hesabın tamamı için geçerlidir.');
    unmount(tree);
  });
});
