import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`Patch anchor not found: ${label}`);
  }
  return content.replace(before, after);
}

function replaceRegexOnce(content, pattern, after, label) {
  const matches = content.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`Patch regex did not match exactly once: ${label}`);
  }
  return content.replace(pattern, after);
}

// ---------------------------------------------------------------------------
// Home / Map: replace All/Mine with Search + Notifications and shrink Group Drive.
// ---------------------------------------------------------------------------
{
  const path = 'app/(tabs)/index.tsx';
  let source = read(path);

  source = replaceOnce(
    source,
    '  const [mapLens, setMapLens] = useState<MapLens>("all");',
    '  const mapLens: MapLens = "all";',
    'map lens state',
  );

  source = replaceRegexOnce(
    source,
    /          <TouchableOpacity\n            accessibilityLabel=\{`Map lens:[\s\S]*?          <\/TouchableOpacity>/,
    `          <View style={styles.headerActions}>\n            <NoxaIconButton\n              accessibilityHint="Find people, Crews and Events"\n              accessibilityLabel="Search NOXA"\n              icon="search-outline"\n              iconSize={19}\n              onPress={() => router.push("/search")}\n              size={44}\n              variant="overlay"\n            />\n            <NoxaIconButton\n              accessibilityHint="Open notifications and invitations"\n              accessibilityLabel="Notifications"\n              icon="notifications-outline"\n              iconSize={19}\n              onPress={() => router.push("/notifications")}\n              size={44}\n              variant="overlay"\n            />\n          </View>`,
    'map header All/Mine control',
  );

  source = replaceOnce(
    source,
`        {!selectedEvent ? (\n          <View\n            pointerEvents="box-none"\n            style={[\n              styles.groupDriveControl,\n              { bottom: eventCardBottom + spacing.sm },\n            ]}\n          >\n            <NoxaButton\n              accessibilityHint="Open your Group Drives or create a new one"\n              leadingIcon={\n                <Ionicons name="navigate-outline" size={17} color={colors.text} />\n              }\n              onPress={() => router.push("/group-drives")}\n              size="md"\n              title="Group Drives"\n              variant="overlay"\n            />\n          </View>\n        ) : null}`,
`        {!selectedEvent ? (\n          <View\n            pointerEvents="box-none"\n            style={[\n              styles.groupDriveControl,\n              { bottom: eventCardBottom + spacing.sm },\n            ]}\n          >\n            <NoxaIconButton\n              accessibilityHint="Open Group Drives"\n              accessibilityLabel="Group Drives"\n              icon="navigate-outline"\n              iconSize={19}\n              onPress={() => router.push("/group-drives")}\n              size={44}\n              variant="overlay"\n            />\n          </View>\n        ) : null}`,
    'large Group Drive map entry',
  );

  source = replaceOnce(
    source,
`  livingPulse: {\n    position: "absolute",\n    left: 72,\n    right: 72,\n    alignItems: "center",\n    justifyContent: "center",\n  },`,
`  livingPulse: {\n    position: "absolute",\n    left: 72,\n    right: 112,\n    alignItems: "center",\n    justifyContent: "center",\n  },`,
    'living pulse spacing',
  );

  source = replaceOnce(
    source,
`  lensControl: {\n    minWidth: 64,\n    height: 36,\n    flexDirection: "row",\n    alignItems: "center",\n    justifyContent: "center",\n    gap: 6,\n    paddingHorizontal: 10,\n    borderRadius: radius.pill,\n    borderWidth: 1,\n    borderColor: colors.borderStrong,\n    backgroundColor: "rgba(12,12,16,0.82)",\n  },\n  lensControlActive: {\n    borderColor: colors.borderAccent,\n    backgroundColor: colors.primaryMuted,\n  },\n  lensText: {\n    color: colors.text,\n    fontSize: 11,\n    fontWeight: "700",\n  },`,
`  headerActions: {\n    flexDirection: "row",\n    alignItems: "center",\n    gap: spacing.xs,\n  },`,
    'map lens styles',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// Edit Profile: username is visible but immutable after onboarding.
// ---------------------------------------------------------------------------
{
  const path = 'app/edit-profile.tsx';
  let source = read(path);

  source = replaceOnce(
    source,
    'import { NoxaButton, NoxaHeader, NoxaInput, NoxaScreen } from "@/src/components/ui";',
    'import { NoxaAvatar, NoxaButton, NoxaHeader, NoxaInput, NoxaScreen } from "@/src/components/ui";',
    'edit profile avatar import',
  );

  source = replaceOnce(
    source,
`  if (username) {\n    if (username.length < 3 || username.length > 20) {\n      errors.username = "Username must be 3–20 characters.";\n    } else if (!/^[a-z0-9_]+$/.test(username)) {\n      errors.username = "Use only lowercase letters, numbers, and underscores.";\n    }\n  }\n\n`,
    '',
    'edit profile username validation',
  );

  source = replaceOnce(
    source,
    '          username: validation.values.username || null,\n',
    '',
    'edit profile username update payload',
  );

  source = replaceOnce(
    source,
`                  {previewUri ? <Image source={{ uri: previewUri }} style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{getInitials(form.displayName)}</Text>}`,
`                  {previewUri ? (\n                    <Image source={{ uri: previewUri }} style={styles.avatarImage} />\n                  ) : (\n                    <NoxaAvatar initials={getInitials(form.displayName)} size={74} />\n                  )}`,
    'edit profile avatar fallback',
  );

  source = replaceOnce(
    source,
`              <FieldError message={errors.username}>\n                <NoxaInput autoCapitalize="none" autoCorrect={false} editable={!isLoading && !isSubmitting} label="Username" maxLength={21} onBlur={() => setField("username", normalizeUsername(form.username))} onChangeText={(value) => setField("username", value)} placeholder="noxa_driver" value={form.username} />\n                <Text style={styles.counter}>{normalizeUsername(form.username).length}/20</Text>\n              </FieldError>`,
`              <View style={styles.lockedUsernameRow}>\n                <View style={styles.lockedUsernameIcon}>\n                  <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} />\n                </View>\n                <View style={styles.lockedUsernameCopy}>\n                  <Text style={styles.lockedUsernameLabel}>USERNAME</Text>\n                  <Text numberOfLines={1} style={styles.lockedUsernameValue}>\n                    {form.username ? \`@\${normalizeUsername(form.username)}\` : 'Set during onboarding'}\n                  </Text>\n                  <Text style={styles.lockedUsernameHint}>Locked after initial account setup.</Text>\n                </View>\n              </View>`,
    'edit profile username field',
  );

  source = replaceOnce(
    source,
`  helperText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "800" },`,
`  helperText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: "800" },\n  lockedUsernameRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },\n  lockedUsernameIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border },\n  lockedUsernameCopy: { flex: 1, minWidth: 0 },\n  lockedUsernameLabel: { color: colors.textSubtle, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },\n  lockedUsernameValue: { marginTop: 2, color: colors.text, fontSize: 14, fontWeight: "800" },\n  lockedUsernameHint: { marginTop: 2, color: colors.textMuted, fontSize: 10, lineHeight: 15 },`,
    'edit profile locked username styles',
  );

  write(path, source);
}

// ---------------------------------------------------------------------------
// Explore: simplify naming around people rather than internal "drivers" wording.
// ---------------------------------------------------------------------------
{
  const path = 'app/search.tsx';
  let source = read(path);
  source = replaceOnce(
    source,
    '  { label: "Drivers", value: "drivers" },',
    '  { label: "People", value: "drivers" },',
    'search people label',
  );
  write(path, source);
}

console.log('Consolidated UX patch applied successfully.');
