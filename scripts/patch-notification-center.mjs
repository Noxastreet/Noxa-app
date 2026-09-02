import fs from 'node:fs';

const path = 'app/notifications.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Anchor not found: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "import { NoxaEmptyState, NoxaHeader, NoxaScreen } from '@/src/components/ui';\n",
  "import { NoxaAvatar, NoxaEmptyState, NoxaHeader, NoxaScreen } from '@/src/components/ui';\nimport { listMyGroupDrives } from '@/src/features/group-drive';\n",
  'imports',
);

replaceOnce(
  "type ActivityFilter = 'all' | 'crews' | 'events' | 'social';\ntype ActivityKind = 'crew' | 'event' | 'follow';\n",
  "type ActivityKind = 'crew' | 'drive' | 'event' | 'follow';\n",
  'activity kinds',
);

replaceOnce(
`const filters: { label: string; value: ActivityFilter; kind?: ActivityKind }[] = [\n  { label: 'All', value: 'all' },\n  { label: 'Crews', value: 'crews', kind: 'crew' },\n  { label: 'Events', value: 'events', kind: 'event' },\n  { label: 'Social', value: 'social', kind: 'follow' },\n];\n\n`,
  '',
  'filters constant',
);

replaceOnce(
`  crew: {\n    color: colors.primaryHover,\n    icon: 'people-outline',\n    background: colors.primarySubtle,\n  },\n  event: {`,
`  crew: {\n    color: colors.primaryHover,\n    icon: 'people-outline',\n    background: colors.primarySubtle,\n  },\n  drive: {\n    color: colors.primaryHover,\n    icon: 'navigate-outline',\n    background: colors.primarySubtle,\n  },\n  event: {`,
  'drive visual',
);

const filterFunctionPattern = /function FilterTab\([\s\S]*?\n}\n\nfunction ActivityArtwork/;
if (!filterFunctionPattern.test(source)) throw new Error('FilterTab function anchor not found');
source = source.replace(filterFunctionPattern, 'function ActivityArtwork');

replaceOnce(
`      {item.imageUrl ? (\n        <Image source={{ uri: item.imageUrl }} style={styles.artworkImage} />\n      ) : (\n        <View style={[styles.artworkFallback, { backgroundColor: visual.background }]}>\n          {item.kind === 'follow' ? (\n            <Text style={[styles.artworkInitials, { color: visual.color }]}>{getInitials(item.title)}</Text>\n          ) : (\n            <Ionicons name={visual.icon} size={21} color={visual.color} />\n          )}\n        </View>\n      )}`,
`      {item.kind === 'follow' ? (\n        <NoxaAvatar imageUrl={item.imageUrl} initials={getInitials(item.title)} size={44} />\n      ) : item.imageUrl ? (\n        <Image source={{ uri: item.imageUrl }} style={styles.artworkImage} />\n      ) : (\n        <View style={[styles.artworkFallback, { backgroundColor: visual.background }]}>\n          <Ionicons name={visual.icon} size={21} color={visual.color} />\n        </View>\n      )}`,
  'activity artwork',
);

replaceOnce(
  "  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');\n",
  '',
  'active filter state',
);

replaceOnce(
`      setActivities([\n        ...invitationActivities,\n        ...eventActivities,\n        ...followActivities,\n      ]);`,
`      const driveRows = await listMyGroupDrives().catch(() => []);\n      const driveActivities: ActivityItem[] = driveRows\n        .filter((drive) => Boolean(drive.invitationId) && drive.myInvitationStatus === 'invited')\n        .map((drive) => ({\n          id: \`drive-\${drive.invitationId}\`,\n          sourceId: drive.invitationId as string,\n          kind: 'drive',\n          title: drive.title,\n          subtitle: 'Group Drive invitation',\n          timestamp: drive.updatedAt,\n          startsAt: drive.scheduledStartAt ?? undefined,\n          imageUrl: null,\n          routeId: drive.invitationId as string,\n        }));\n\n      setActivities([\n        ...driveActivities,\n        ...invitationActivities,\n        ...eventActivities,\n        ...followActivities,\n      ]);`,
  'drive notifications',
);

const visibleActivitiesPattern = /  const visibleActivities = useMemo\([\s\S]*?\n  \);\n\n  const needsAttention = useMemo\(/;
if (!visibleActivitiesPattern.test(source)) throw new Error('visibleActivities block not found');
source = source.replace(visibleActivitiesPattern, '  const needsAttention = useMemo(\n');

replaceOnce(
`    () => visibleActivities.filter((item) => item.kind === 'crew'),\n    [visibleActivities],`,
`    () => activities.filter((item) => item.kind === 'crew' || item.kind === 'drive'),\n    [activities],`,
  'attention feed',
);
replaceOnce(
`    () => visibleActivities.filter((item) => item.kind === 'event'),\n    [visibleActivities],`,
`    () => activities.filter((item) => item.kind === 'event'),\n    [activities],`,
  'upcoming feed',
);
replaceOnce(
`    () => visibleActivities\n      .filter((item) => item.kind === 'follow')\n      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),\n    [visibleActivities],`,
`    () => activities\n      .filter((item) => item.kind === 'follow')\n      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),\n    [activities],`,
  'community feed',
);

replaceOnce(
`    if (item.kind === 'follow') {\n      router.push({ pathname: '/driver-profile/[id]', params: { id: item.routeId } });\n    } else if (item.kind === 'crew') {\n      router.push({ pathname: '/crew/[id]', params: { id: item.routeId } });\n    } else {\n      router.push({ pathname: '/event-details', params: { id: item.routeId } });\n    }`,
`    if (item.kind === 'follow') {\n      router.push({ pathname: '/driver-profile/[id]', params: { id: item.routeId } });\n    } else if (item.kind === 'crew') {\n      router.push({ pathname: '/crew/[id]', params: { id: item.routeId } });\n    } else if (item.kind === 'drive') {\n      router.push({ pathname: '/group-drives/invitation/[id]', params: { id: item.routeId } });\n    } else {\n      router.push({ pathname: '/event-details', params: { id: item.routeId } });\n    }`,
  'open drive notification',
);

const filterUiPattern = /\n        <View style=\{styles\.filterRow\} accessibilityRole="tablist">[\s\S]*?        <\/View>\n\n        \{isLoading \?/;
if (!filterUiPattern.test(source)) throw new Error('filter UI block not found');
source = source.replace(filterUiPattern, '\n\n        {isLoading ?');

replaceOnce(
`            ) : visibleActivities.length === 0 ? (\n              <NoxaEmptyState\n                icon="checkmark-circle-outline"\n                title={activeFilter === 'all' ? 'You’re all caught up' : \`No \${activeFilter} activity\`}\n                body="New Crew invitations, upcoming Events and community activity will show here automatically."\n              />`,
`            ) : activities.length === 0 ? (\n              <NoxaEmptyState\n                icon="checkmark-circle-outline"\n                title="You’re all caught up"\n                body="Group Drive and Crew invitations, upcoming Events and community activity will show here automatically."\n              />`,
  'empty notification state',
);

fs.writeFileSync(path, source);
console.log('Notification center consolidated successfully.');
