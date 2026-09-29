import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { NoxaSurface } from './NoxaSurface';
import { spacing } from '@/src/theme';

type NoxaCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function NoxaCard({ children, style, compact = false }: NoxaCardProps) {
  return (
    <NoxaSurface
      level="content"
      style={[styles.card, compact && styles.compact, style]}>
      {children}
    </NoxaSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  compact: {
    padding: spacing.md,
  },
});
