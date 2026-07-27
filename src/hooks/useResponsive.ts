import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return PixelRatio.roundToNearestPixel(value);
}

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);

    const isLandscape = width > height;
    const isTablet = shortestSide >= 600;
    const isSmallPhone = width < 360;
    const isCompactHeight = height < 700;
    const isTallScreen = height / width > 2.05;

    const widthScale = clamp(0.88, width / BASE_WIDTH, 1.16);
    const heightScale = clamp(0.9, height / BASE_HEIGHT, 1.12);

    const size = (value: number): number => {
      return round(value * widthScale);
    };

    const vertical = (value: number): number => {
      return round(value * heightScale);
    };

    const moderate = (
      value: number,
      factor = 0.35,
    ): number => {
      const scaledValue = value * widthScale;

      return round(
        value + (scaledValue - value) * factor,
      );
    };

    const gutter = isTablet
      ? 32
      : clamp(16, width * 0.045, 24);

    const contentMaxWidth = isTablet ? 560 : width;

    return {
      width,
      height,
      fontScale,

      shortestSide,
      longestSide,
      aspectRatio: width / height,

      isLandscape,
      isTablet,
      isSmallPhone,
      isCompactHeight,
      isTallScreen,

      gutter,
      contentMaxWidth,

      size,
      vertical,
      moderate,
    };
  }, [width, height, fontScale]);
}

export type ResponsiveMetrics = ReturnType<
  typeof useResponsive
>;
