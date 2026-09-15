import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { SegmentControl } from '@/components/common/SegmentControl';
import { useSimulationActions, useSimulationEnabled, useSimulationIndicators } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { upperCase, useLanguage, useT } from '@/i18n';

/** [ REAL DATA ] / [ SIMULATION ] switch. Default is real data. */
export function ModeSwitch({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const language = useLanguage();
  const enabled = useSimulationEnabled();
  const indicators = useSimulationIndicators();
  const { setEnabled } = useSimulationActions();
  return (
    <SegmentControl
      style={style}
      accent={indicators ? 'simulation' : 'default'}
      value={enabled ? 'simulation' : 'real'}
      options={[
        { value: 'real', label: upperCase(t('dashboard.realData'), language) },
        { value: 'simulation', label: upperCase(t('dashboard.simulation'), language) },
      ]}
      onChange={(v) => {
        triggerHaptic(v === 'simulation' ? 'medium' : 'light');
        setEnabled(v === 'simulation');
      }}
    />
  );
}
