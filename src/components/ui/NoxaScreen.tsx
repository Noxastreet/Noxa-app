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
      contentStyle={padded ? styles.paddedVertical : undefined}
      edges={['top', 'bottom', 'left', 'right']}
      padded={padded}
    >
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paddedVertical: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
