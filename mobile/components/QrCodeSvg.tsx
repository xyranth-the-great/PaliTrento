import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  quietZone?: number;
}

export function QrCodeSvg({
  value,
  size = 220,
  color = '#1B4329',
  backgroundColor = '#FFFFFF',
  quietZone = 3,
}: QrCodeSvgProps) {
  const { modules, totalSize } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value || 'https://palitrento.online');
    qr.make();
    const count = qr.getModuleCount();
    const cells: { x: number; y: number }[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          cells.push({ x: c + quietZone, y: r + quietZone });
        }
      }
    }
    return { modules: cells, totalSize: count + quietZone * 2 };
  }, [quietZone, value]);

  return (
    <View style={[styles.wrap, { width: size, height: size, backgroundColor }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${totalSize} ${totalSize}`}>
        <Rect x={0} y={0} width={totalSize} height={totalSize} fill={backgroundColor} />
        {modules.map((m) => (
          <Rect
            key={`${m.x}-${m.y}`}
            x={m.x}
            y={m.y}
            width={1.02}
            height={1.02}
            fill={color}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
