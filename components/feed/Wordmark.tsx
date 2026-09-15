import React from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { APP_NAME } from '@/constants/config';
import { useTheme } from '@/hooks/useTheme';

/** SocialLens logotype for the feed header (own brand, not an Instagram asset). */
export function Wordmark({ size = 26 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <RNText style={[styles.text, { color: colors.text, fontSize: size }]} maxFontSizeMultiplier={1.2}>
        {APP_NAME}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: {
    fontWeight: '700',
    letterSpacing: -0.8,
    fontStyle: 'italic',
    includeFontPadding: false,
  },
});
