import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { Text } from './Text';

interface AvatarProps {
  uri?: string;
  size?: number;
  /** Instagram story ring: gradient (unseen), gray (seen) or none. */
  ring?: 'gradient' | 'seen' | 'none';
  name?: string;
  style?: StyleProp<ViewStyle>;
}

const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export function Avatar({ uri, size = 32, ring = 'none', name, style }: AvatarProps) {
  const { colors } = useTheme();
  const ringWidth = ring === 'none' ? 0 : Math.max(2, Math.round(size * 0.035));
  const gap = ring === 'none' ? 0 : Math.max(2, Math.round(size * 0.035));
  const outer = size + (ringWidth + gap) * 2;
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const image = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.skeleton }}
      contentFit="cover"
      transition={150}
      placeholder={{ blurhash: BLURHASH }}
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondaryButton }]}>
      <Text variant="captionStrong" color="secondary" style={{ fontSize: Math.max(10, size * 0.34) }}>
        {initials}
      </Text>
    </View>
  );

  if (ring === 'none') return <View style={style}>{image}</View>;

  const inner = (
    <View
      style={{
        width: size + gap * 2,
        height: size + gap * 2,
        borderRadius: (size + gap * 2) / 2,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {image}
    </View>
  );

  if (ring === 'seen') {
    return (
      <View
        style={[
          { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
      >
        {inner}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.storyRing[0], colors.storyRing[1], colors.storyRing[2]]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={[{ width: outer, height: outer, borderRadius: outer / 2, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {inner}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
