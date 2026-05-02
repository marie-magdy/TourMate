import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Theme } from '../constants/theme';

const triangleCount = 35;

export default function DesertTriangles() {
  const triangles = useMemo(() => {
    return Array.from({ length: triangleCount }).map((_, i) => {
      const size = Math.random() * 16 + 10;
      const top = i * 80 + Math.random() * 30;

      const left =
        i % 3 === 0
          ? Math.random() * 30
          : i % 3 === 1
          ? 35 + Math.random() * 30
          : 70 + Math.random() * 25;

      const opacity = Math.random() * 0.2 + 0.08;

      return { size, top, left, opacity };
    });
  }, []);

  return (
    <>
      {triangles.map((t, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${t.left}%`,
            top: t.top,
            width: 0,
            height: 0,
            borderLeftWidth: t.size,
            borderRightWidth: t.size,
            borderBottomWidth: t.size * 1.4,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: `rgba(${Theme.triangles.r},${Theme.triangles.g},${Theme.triangles.b},${t.opacity})`,
          }}
        />
      ))}
    </>
  );
}