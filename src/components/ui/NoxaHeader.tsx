import type { ReactNode } from 'react';

import { NoxaTopBar } from './NoxaTopBar';

type NoxaHeaderProps = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function NoxaHeader({ title, subtitle, left, right }: NoxaHeaderProps) {
  return (
    <NoxaTopBar
      left={left}
      right={right}
      subtitle={subtitle}
      title={title}
    />
  );
}
