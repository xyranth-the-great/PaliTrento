import React from 'react';
import Svg, { Ellipse, Path } from 'react-native-svg';

interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 84 }: LogoMarkProps) {
  const height = Math.round(size * (515 / 465));
  return (
    <Svg width={size} height={height} viewBox="35 15 465 515">
      <Ellipse cx="267.5" cy="490" rx="82" ry="22" fill="#1f4c47" />
      <Path d="M225 150H310V440L267.5 474L225 440Z" fill="#70401a" />
      <Path d="M55 46Q55 32 69 32H140V150A42.5 42.5 0 0 1 55 150Z" fill="#1e4b46" />
      <Path d="M140 32H225V150A42.5 42.5 0 0 1 140 150Z" fill="#fdc147" />
      <Path d="M225 32H310V150A42.5 42.5 0 0 1 225 150Z" fill="#1e4b46" />
      <Path d="M310 32H395V150A42.5 42.5 0 0 1 310 150Z" fill="#fdc147" />
      <Path d="M395 32H466Q480 32 480 46V150A42.5 42.5 0 0 1 395 150Z" fill="#1e4b46" />
    </Svg>
  );
}
