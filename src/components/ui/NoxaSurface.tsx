import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, geometry, shadows } from '@/src/theme';

export type NoxaCutCorners = 'signature' | 'top' | 'all' | 'none';
export type NoxaSurfaceLevel = 'content' | 'sheet' | 'overlay';

type BackgroundProps = {
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  cut?: number;
  corners?: NoxaCutCorners;
};

type SurfaceProps = BackgroundProps & {
  children: ReactNode;
  level?: NoxaSurfaceLevel;
  maskChildren?: boolean;
  outsideFill?: string;
  style?: StyleProp<ViewStyle>;
};

function pathFor(width: number, height: number, cut: number, corners: NoxaCutCorners) {
  const c = Math.max(0, Math.min(cut, width / 3, height / 3));

  if (corners === 'none' || c === 0) {
    return `M 0 0 H ${width} V ${height} H 0 Z`;
  }

  if (corners === 'top') {
    return `M ${c} 0 H ${width - c} L ${width} ${c} V ${height} H 0 V ${c} Z`;
  }

  if (corners === 'all') {
    return [
      `M ${c} 0`,
      `H ${width - c}`,
      `L ${width} ${c}`,
      `V ${height - c}`,
      `L ${width - c} ${height}`,
      `H ${c}`,
      `L 0 ${height - c}`,
      `V ${c}`,
      'Z',
    ].join(' ');
  }

  return [
    'M 0 0',
    `H ${width - c}`,
    `L ${width} ${c}`,
    `V ${height}`,
    `H ${c}`,
    `L 0 ${height - c}`,
    'V 0',
    'Z',
  ].join(' ');
}

export function NoxaCutBackground({
  fill = colors.surface,
  borderColor = colors.border,
  borderWidth = StyleSheet.hairlineWidth,
  cut = geometry.cut.md,
  corners = 'signature',
}: BackgroundProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) {
          setSize({ width, height });
        }
      }}
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}>
      {size.width > 0 && size.height > 0 ? (
        <Svg
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          width={size.width}>
          <Path
            d={pathFor(size.width, size.height, cut, corners)}
            fill={fill}
            stroke={borderColor}
            strokeWidth={Math.max(borderWidth, 0.6)}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function NoxaCornerMask({
  cut,
  corners,
  fill,
}: {
  cut: number;
  corners: NoxaCutCorners;
  fill: string;
}) {
  if (corners === 'none' || cut <= 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {(corners === 'signature' || corners === 'top' || corners === 'all') ? (
        <View
          style={[
            styles.maskTopRight,
            {
              borderLeftWidth: cut,
              borderTopWidth: cut,
              borderTopColor: fill,
            },
          ]}
        />
      ) : null}
      {(corners === 'top' || corners === 'all') ? (
        <View
          style={[
            styles.maskTopLeft,
            {
              borderRightWidth: cut,
              borderTopWidth: cut,
              borderTopColor: fill,
            },
          ]}
        />
      ) : null}
      {(corners === 'signature' || corners === 'all') ? (
        <View
          style={[
            styles.maskBottomLeft,
            {
              borderRightWidth: cut,
              borderBottomWidth: cut,
              borderBottomColor: fill,
            },
          ]}
        />
      ) : null}
      {corners === 'all' ? (
        <View
          style={[
            styles.maskBottomRight,
            {
              borderLeftWidth: cut,
              borderBottomWidth: cut,
              borderBottomColor: fill,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export function NoxaSurface({
  children,
  fill,
  borderColor,
  borderWidth,
  cut,
  corners = 'signature',
  level = 'content',
  maskChildren = false,
  outsideFill = colors.background,
  style,
}: SurfaceProps) {
  const resolvedFill =
    fill ??
    (level === 'sheet'
      ? colors.surfaceBase
      : level === 'overlay'
        ? colors.glass
        : colors.surface);

  return (
    <View
      style={[
        styles.base,
        level === 'sheet' && styles.sheet,
        level === 'overlay' && styles.overlay,
        style,
      ]}>
      <NoxaCutBackground
        borderColor={borderColor}
        borderWidth={borderWidth}
        corners={corners}
        cut={cut}
        fill={resolvedFill}
      />
      {children}
      {maskChildren ? (
        <>
          <NoxaCornerMask
            corners={corners}
            cut={cut ?? geometry.cut.md}
            fill={outsideFill}
          />
          <NoxaCutBackground
            borderColor={borderColor}
            borderWidth={borderWidth}
            corners={corners}
            cut={cut}
            fill="transparent"
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  sheet: {
    ...shadows.card,
  },
  overlay: {
    ...shadows.control,
  },
  maskTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
  },
  maskTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderRightColor: 'transparent',
  },
  maskBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    borderRightColor: 'transparent',
  },
  maskBottomRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
  },
});
