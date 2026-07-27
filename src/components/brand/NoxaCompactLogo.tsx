import { StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { colors, typography } from '@/src/theme';

type NoxaCompactLogoProps = {
  size?: 'sm' | 'md';
};

const sizes = {
  sm: { mark: 24, radius: 6, text: 18, spacing: 7 },
  md: { mark: 30, radius: 8, text: 22, spacing: 9 },
} as const;

export function NoxaCompactLogo({ size = 'md' }: NoxaCompactLogoProps) {
  const metrics = sizes[size];

  return (
    <View accessibilityLabel="NOXA" accessible style={[styles.lockup, { gap: metrics.spacing }]}>
      <View
        style={[
          styles.mark,
          {
            width: metrics.mark,
            height: metrics.mark,
            borderRadius: metrics.radius,
          },
        ]}>
        <Svg width={metrics.mark * 0.5} height={metrics.mark * 0.5} viewBox="0 0 14 14" fill="none">
          <Path d="M1 12L4.5 2.5H6L8.5 8.5 10 5H12L9.5 12H7.5L5 6.5 3.5 10H1Z" fill={colors.white} />
        </Svg>
      </View>
      <Text
        style={[
          styles.wordmark,
          {
            fontSize: metrics.text,
            lineHeight: metrics.text + 3,
          },
        ]}>
        NOXA
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  wordmark: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
});
