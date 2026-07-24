import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { spacing } from '@/src/theme';

type NoxaScreenProps = {
  children: ReactNode;
  padded?: boolean;
};

export function NoxaScreen({ children, padded = true }: NoxaScreenProps) {
  return (
    <Screen
      constrained={false}
      contentStyle={padded ? styles.padded : undefined}
      edges={['top', 'bottom', 'left', 'right']}
      padded={false}
    >
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
