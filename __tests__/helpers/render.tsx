import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { MetricEditorProvider } from '@/components/simulation/SimulationMetricEditor';

/**
 * Shared plumbing for the component tests: the providers a screen expects, plus the two
 * queries every one of them needs — what text ended up on screen, and which node carries
 * a given accessibility label (that is what a long-press or a tap is invoked through).
 *
 * Not a `.test.tsx`, so jest collects it as a module rather than a suite.
 */

/** iPhone-ish metrics; only the insets matter to the screens. */
export const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderWithProviders(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <MetricEditorProvider>{node}</MetricEditorProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

/** Every string the tree rendered, in order. */
export function texts(tree: ReactTestRenderer): string[] {
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

export function allText(tree: ReactTestRenderer): string {
  return texts(tree).join('|');
}

/** The first node whose accessibility label starts with `prefix`. */
export function byLabel(tree: ReactTestRenderer, prefix: string): ReactTestInstance {
  const hit = tree.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(prefix))[0];
  if (!hit) throw new Error(`no node labelled "${prefix}"`);
  return hit;
}

export function maybeByLabel(tree: ReactTestRenderer, prefix: string): ReactTestInstance | undefined {
  return tree.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(prefix))[0];
}

/** The open editor's number box (the percentage sheet and the metric editor both have one). */
export function openInput(tree: ReactTestRenderer): ReactTestInstance {
  const hit = tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
  if (!hit) throw new Error('no editor is open');
  return hit;
}

/** Long-press a labelled value, type a new one, press Uygula. */
export function editViaLongPress(tree: ReactTestRenderer, label: string, value: string): void {
  act(() => byLabel(tree, label).props.onLongPress());
  act(() => openInput(tree).props.onChangeText(value));
  act(() => byLabel(tree, 'Uygula').props.onPress());
}

export function unmount(tree: ReactTestRenderer): void {
  act(() => tree.unmount());
}
