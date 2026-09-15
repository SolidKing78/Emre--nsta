import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** SocialLens mark: a lens with an ascending trend line (own brand asset). */
export function LensLogo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs>
        <LinearGradient id="lens" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F9CE34" />
          <Stop offset="0.5" stopColor="#EE2A7B" />
          <Stop offset="1" stopColor="#6228D7" />
        </LinearGradient>
      </Defs>
      <Circle cx="48" cy="48" r="40" stroke="url(#lens)" strokeWidth="8" fill="none" />
      <Circle cx="48" cy="48" r="24" stroke="url(#lens)" strokeWidth="4" fill="none" opacity={0.45} />
      <Path d="M30 58 L42 46 L52 53 L66 36" stroke="url(#lens)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M58 36 L66 36 L66 44" stroke="url(#lens)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
