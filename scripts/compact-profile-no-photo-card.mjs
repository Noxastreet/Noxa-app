import fs from 'node:fs';

const path = 'app/(tabs)/profile.tsx';
let source = fs.readFileSync(path, 'utf8');

const styleBefore = `        style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}>`;
const styleAfter = `        style={({ pressed }) => [\n          styles.vehicleCard,\n          !vehicle.cover_image_url && styles.vehicleCardNoImage,\n          pressed && styles.pressed,\n        ]}>`;
if (!source.includes(styleBefore)) throw new Error('vehicle card style anchor not found');
source = source.replace(styleBefore, styleAfter);

const cardBefore = `  vehicleCard: {\n    height: 224,\n    overflow: 'hidden',\n    borderRadius: radius.hero,\n    borderWidth: 1,\n    borderColor: colors.border,\n    backgroundColor: colors.surface,\n    ...shadows.card,\n  },`;
const cardAfter = `  vehicleCard: {\n    height: 224,\n    overflow: 'hidden',\n    borderRadius: radius.hero,\n    borderWidth: 1,\n    borderColor: colors.border,\n    backgroundColor: colors.surface,\n    ...shadows.card,\n  },\n  vehicleCardNoImage: {\n    height: 166,\n    borderRadius: radius.xl,\n    shadowOpacity: 0,\n    elevation: 0,\n  },`;
if (!source.includes(cardBefore)) throw new Error('vehicle card style definition not found');
source = source.replace(cardBefore, cardAfter);

source = source.replace(
  `    top: 52,\n    left: spacing.md,`,
  `    top: 48,\n    right: spacing.md,`,
);

fs.writeFileSync(path, source);
console.log('No-photo vehicle card compacted.');