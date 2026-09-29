#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const geometry = fs.readFileSync('src/theme/geometry.ts', 'utf8');
const surface = fs.readFileSync('src/components/ui/NoxaSurface.tsx', 'utf8');
const button = fs.readFileSync('src/components/ui/NoxaButton.tsx', 'utf8');
const input = fs.readFileSync('src/components/ui/NoxaInput.tsx', 'utf8');
const sheet = fs.readFileSync('src/components/ui/NoxaSheet.tsx', 'utf8');
const card = fs.readFileSync('src/components/ui/NoxaCard.tsx', 'utf8');
const tab = fs.readFileSync('components/noxa-bottom-tab-bar.tsx', 'utf8');
const empty = fs.readFileSync('src/components/ui/NoxaEmptyState.tsx', 'utf8');

assert(
  /sm: 8/.test(geometry) && /md: 12/.test(geometry) && /lg: 16/.test(geometry),
  'NOXA must expose one canonical 8/12/16 chamfer scale.',
);

assert(
  /react-native-svg/.test(surface)
    && /NoxaCutBackground/.test(surface)
    && /corners === 'signature'/.test(surface)
    && /topRight|signature/.test(surface),
  'Shared surfaces must own the signature cut-corner geometry.',
);

assert(
  /compact: 44/.test(geometry)
    && /standard: 48/.test(geometry)
    && /primary: 56/.test(geometry),
  'Shared controls must preserve 44px minimum touch targets and a 56px primary height.',
);

assert(
  /NoxaCutBackground/.test(button)
    && /case 'secondary'[\s\S]{0,140}rgba\(0,0,0,0\)/.test(button)
    && /case 'danger'[\s\S]{0,140}rgba\(0,0,0,0\)/.test(button),
  'Primary/secondary/destructive buttons must share geometry while secondary and destructive remain outlined.',
);

assert(
  /NoxaCutBackground/.test(input)
    && /fill=\{focused \? colors\.surfaceRaised : colors\.surfaceSoft\}/.test(input),
  'Inputs must use the same angular shell and a focused state without a one-off radius.',
);

assert(
  /<NoxaSurface/.test(card)
    && !/shadows\.card/.test(card),
  'L1 cards must reuse the shared surface and must not invent their own shadow.',
);

assert(
  /corners="top"/.test(sheet)
    && /level="sheet"/.test(sheet),
  'Contextual sheets must use the canonical L2 shell.',
);

assert(
  /<NoxaSurface/.test(tab)
    && /styles\.indicatorActive/.test(tab)
    && !/borderRadius:\s*26/.test(tab)
    && !/segmentActive/.test(tab),
  'Root navigation must use the same angular surface instead of a separate pill language.',
);

assert(
  !/borderWidth:\s*1[\s\S]{0,120}backgroundColor:\s*colors\.surface/.test(empty),
  'Empty states must remain flat L1 content rather than becoming another card.',
);

if (!process.exitCode) {
  console.log('NOXA UI foundation contract passed.');
}
