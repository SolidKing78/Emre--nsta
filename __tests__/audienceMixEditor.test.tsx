import React from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

import { AudienceMixEditor } from '@/components/simulation/AudienceMixEditor';
import { genderSplitFor } from '@/services/analytics/audienceMix';
import { selectAudienceMix, selectMediaAudienceMix, useSimulationStore } from '@/store/simulationStore';
import { useSettingsStore } from '@/store/settingsStore';
import { DEFAULT_AUDIENCE_MIX } from '@/types/simulation';

/**
 * The editor behind "Kitle dağılımı": what it writes to the store is what every stats
 * screen then reads, so the round trip is worth pinning down.
 */

const ACCOUNT = 'none'; // no session in tests → the store's default account key
const MEDIA = 'reel-1';

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

function byLabel(tree: ReactTestRenderer, prefix: string) {
  const hit = tree.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(prefix))[0];
  if (!hit) throw new Error(`no node labelled "${prefix}"`);
  return hit;
}

/** The number box for a field, found by the label it shares with its slider. */
function inputFor(tree: ReactTestRenderer, label: string) {
  const hit = tree.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props?.onChangeText === 'function')[0];
  if (!hit) throw new Error(`no input for "${label}"`);
  return hit;
}

function render(mediaId?: string): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AudienceMixEditor mediaId={mediaId} />);
  });
  return tree;
}

describe('audience mix editor', () => {
  beforeAll(() => useSettingsStore.setState({ language: 'tr' }));
  beforeEach(() => useSimulationStore.setState({ enabled: false, accounts: {}, lastChangedAt: undefined }));

  it('opens on the defaults and shows both sides of each split', () => {
    const tree = render();
    const all = texts(tree).join('|');
    expect(all).toContain('Takipçi olmayanlar');
    expect(all).toContain('%99,3');
    expect(all).toContain('%0,7');
    expect(all).toContain('Erkekler');
    expect(all).toContain('%93');
    expect(all).toContain('%7');
    act(() => tree.unmount());
  });

  it('writes the account-wide mix on Uygula', () => {
    const tree = render();
    act(() => inputFor(tree, 'Takipçi izlenmeleri').props.onChangeText('2,5'));
    act(() => inputFor(tree, 'Kadınlar').props.onChangeText('12'));
    act(() => byLabel(tree, 'Uygula').props.onPress());

    expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT)).toMatchObject({ followerShare: 2.5, womenShare: 12 });
    act(() => tree.unmount());
  });

  it('shows the spread a post may drift into', () => {
    const tree = render();
    act(() => inputFor(tree, 'Kadınlar').props.onChangeText('20'));
    const all = texts(tree).join('|');
    // 20 % ± the default 2 % variance.
    expect(all).toContain('%18');
    expect(all).toContain('%22');
    act(() => tree.unmount());
  });

  it('nothing is written until Uygula is pressed', () => {
    const tree = render();
    act(() => inputFor(tree, 'Kadınlar').props.onChangeText('40'));
    expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT).womenShare).toBe(DEFAULT_AUDIENCE_MIX.womenShare);
    act(() => tree.unmount());
  });

  it('"Varsayılana dön" puts the mix and every pinned post back', () => {
    useSimulationStore.getState().setAudienceMix(ACCOUNT, { womenShare: 40 });
    useSimulationStore.getState().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
    const tree = render();
    act(() => byLabel(tree, 'Varsayılana dön').props.onPress());
    expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual(DEFAULT_AUDIENCE_MIX);
    expect(selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual({});
    act(() => tree.unmount());
  });

  describe('per-post mode', () => {
    it('drops the drift fields and pins just that post', () => {
      const tree = render(MEDIA);
      const all = texts(tree).join('|');
      expect(all).toContain('Oranları yalnızca bu gönderi için elle ayarla.');
      expect(all).not.toContain('Gönderiler arası sapma');

      act(() => inputFor(tree, 'Kadınlar').props.onChangeText('33'));
      act(() => byLabel(tree, 'Uygula').props.onPress());

      const perMedia = selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT);
      expect(perMedia[MEDIA]?.womenShare).toBe(33);
      expect(genderSplitFor(MEDIA, DEFAULT_AUDIENCE_MIX, perMedia[MEDIA])).toEqual({ women: 33, men: 67 });
      // The account-wide mix is untouched.
      expect(selectAudienceMix(useSimulationStore.getState(), ACCOUNT)).toEqual(DEFAULT_AUDIENCE_MIX);
      act(() => tree.unmount());
    });

    it('offers "Genel dağılıma dön" only once the post was pinned', () => {
      const clean = render(MEDIA);
      expect(texts(clean).join('|')).not.toContain('Genel dağılıma dön');
      act(() => clean.unmount());

      useSimulationStore.getState().setMediaAudienceMix(ACCOUNT, MEDIA, { womenShare: 33 });
      const pinned = render(MEDIA);
      expect(texts(pinned).join('|')).toContain('Genel dağılıma dön');
      act(() => byLabel(pinned, 'Genel dağılıma dön').props.onPress());
      expect(selectMediaAudienceMix(useSimulationStore.getState(), ACCOUNT)[MEDIA]).toBeUndefined();
      act(() => pinned.unmount());
    });
  });
});
