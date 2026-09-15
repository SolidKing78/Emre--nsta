import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/common/Text';
import { LineChart } from '@/components/charts/LineChart';
import { spacing } from '@/constants/theme';
import { useT } from '@/i18n';

interface RetentionChartProps {
  retention: number[];
}

/** Reels retention curve (share of viewers still watching per second). */
export function RetentionChart({ retention }: RetentionChartProps) {
  const t = useT();
  const data = useMemo(() => retention.map((v, i) => ({ date: `s${i}`, value: Math.round(v * 100) })), [retention]);
  const hook3s = retention[3] ?? retention[retention.length - 1] ?? 0;
  return (
    <View>
      <Text variant="caption" color="secondary" style={{ marginBottom: spacing.xs }}>
        {t('media.retentionHint')}
      </Text>
      <LineChart data={data} height={150} showAxis={false} formatValue={(v) => `${Math.round(v)}%`} formatLabel={(d) => `${d.slice(1)}s`} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
        <Text variant="small" color="tertiary">
          0s
        </Text>
        <Text variant="small" color="tertiary">
          3s · {Math.round(hook3s * 100)}%
        </Text>
        <Text variant="small" color="tertiary">
          {retention.length}s
        </Text>
      </View>
    </View>
  );
}
