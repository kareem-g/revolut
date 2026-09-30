import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** The powerk bolt — same path as the Android launcher foreground. */
export function BoltLogo({
  size = 150,
  color = '#2ECC71',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 108 108">
      <Path d="M61 22 L33 62 L51 62 L47 86 L75 46 L57 46 Z" fill={color} />
    </Svg>
  );
}
