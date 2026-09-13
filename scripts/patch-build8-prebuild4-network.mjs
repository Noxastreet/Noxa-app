import fs from 'node:fs';

const path = 'app/(tabs)/garage.tsx';
let content = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const first = content.indexOf(from);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (content.indexOf(from, first + from.length) !== -1) {
    throw new Error(`Patch target not unique: ${label}`);
  }
  content = content.slice(0, first) + to + content.slice(first + from.length);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error(`Patch start not found: ${label}`);
  const end = content.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Patch end not found: ${label}`);
  content = content.slice(0, start) + replacement + content.slice(end);
}

replaceOnce(
  "import { NoxaBadge, NoxaScreen } from '@/src/components/ui';\nimport { supabase } from '@/src/lib/supabase';",
  "import { NoxaBadge, NoxaScreen } from '@/src/components/ui';\nimport { requireClientEnv } from '@/src/config/env';\nimport { supabase } from '@/src/lib/supabase';",
  'imports',
);

replaceOnce(
  '\n\nfunction vehicleMeta(vehicle: GarageVehicle) {',
  `\n\nconst { supabaseUrl, supabasePublishableKey } = requireClientEnv();\n\ntype ProbeResult = {\n  label: string;\n  status: number;\n  elapsedMs: number;\n  bytes: number;\n};\n\nfunction diagnosticError(error: unknown) {\n  if (error instanceof Error) return \`${'${error.name}: ${error.message}'}\`;\n  return String(error);\n}\n\nasync function timedTextFetch(\n  label: string,\n  url: string,\n  init?: RequestInit,\n): Promise<ProbeResult> {\n  const controller = new AbortController();\n  const timeout = setTimeout(() => controller.abort(), 10000);\n  const startedAt = Date.now();\n\n  try {\n    const response = await fetch(url, { ...init, signal: controller.signal });\n    const body = await response.text();\n    return {\n      label,\n      status: response.status,\n      elapsedMs: Date.now() - startedAt,\n      bytes: body.length,\n    };\n  } finally {\n    clearTimeout(timeout);\n  }\n}\n\nfunction vehicleMeta(vehicle: GarageVehicle) {`,
  'probe helpers',
);

replaceOnce(
  `  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);\n  const hasLoadedVehiclesRef = useRef(false);`,
  `  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);\n  const [diagnosticLines, setDiagnosticLines] = useState<string[]>([\n    'BUILD 8 PRE-BUILD4 NETWORK CONTROL',\n    'Waiting for Garage request…',\n  ]);\n  const hasLoadedVehiclesRef = useRef(false);\n  const diagnosticRunRef = useRef(0);`,
  'diagnostic state',
);

replaceBetween(
  '  const loadVehicles = useCallback(async () => {',
  '\n\n  useFocusEffect(',
  `  const loadVehicles = useCallback(async () => {\n    const runId = ++diagnosticRunRef.current;\n    const append = (message: string) => {\n      if (runId !== diagnosticRunRef.current) return;\n      setDiagnosticLines((current) => [\n        current[0] ?? 'BUILD 8 PRE-BUILD4 NETWORK CONTROL',\n        ...current.slice(-7),\n        message,\n      ]);\n    };\n\n    setDiagnosticLines([\n      'BUILD 8 PRE-BUILD4 NETWORK CONTROL',\n      'SESSION: checking local session…',\n    ]);\n    setIsLoadingVehicles(!hasLoadedVehiclesRef.current);\n    setHasVehicleError(false);\n\n    const sessionStartedAt = Date.now();\n    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();\n    const session = sessionData.session;\n\n    if (sessionError || !session) {\n      append(\`SESSION: FAIL in \${Date.now() - sessionStartedAt}ms — \${sessionError?.message ?? 'no session'}\`);\n      setVehicles([]);\n      setHasVehicleError(true);\n      hasLoadedVehiclesRef.current = true;\n      setIsLoadingVehicles(false);\n      return;\n    }\n\n    append(\`SESSION: OK in \${Date.now() - sessionStartedAt}ms\`);\n\n    void timedTextFetch('PUBLIC HTTPS', 'https://example.com')\n      .then((probe) => append(\`${'${probe.label}'}: HTTP \${probe.status} in \${probe.elapsedMs}ms, \${probe.bytes}B\`))\n      .catch((error) => append(\`PUBLIC HTTPS: FAIL — \${diagnosticError(error)}\`));\n\n    const query = new URLSearchParams({\n      select: 'id',\n      owner_id: \`eq.\${session.user.id}\`,\n      limit: '1',\n    });\n\n    void timedTextFetch(\n      'RAW SUPABASE',\n      \`${'${supabaseUrl}'}/rest/v1/vehicles?\${query.toString()}\`,\n      {\n        headers: {\n          Accept: 'application/json',\n          apikey: supabasePublishableKey,\n          Authorization: \`Bearer \${session.access_token}\`,\n        },\n      },\n    )\n      .then((probe) => append(\`${'${probe.label}'}: HTTP \${probe.status} in \${probe.elapsedMs}ms, \${probe.bytes}B\`))\n      .catch((error) => append(\`RAW SUPABASE: FAIL — \${diagnosticError(error)}\`));\n\n    append('SDK: request sent…');\n    const sdkStartedAt = Date.now();\n\n    try {\n      const { data, error } = await supabase\n        .from('vehicles')\n        .select(vehicleSelect)\n        .eq('owner_id', session.user.id)\n        .order('is_primary', { ascending: false })\n        .order('created_at', { ascending: false });\n\n      const sdkMs = Date.now() - sdkStartedAt;\n      append(\n        error\n          ? \`SDK: ERROR in \${sdkMs}ms — \${error.code ?? 'unknown'} \${error.message}\`\n          : \`SDK: OK in \${sdkMs}ms — \${data?.length ?? 0} rows\`,\n      );\n\n      if (error) {\n        setHasVehicleError(true);\n      } else {\n        setVehicles((data ?? []) as GarageVehicle[]);\n      }\n    } catch (error) {\n      append(\`SDK: THROW — \${diagnosticError(error)}\`);\n      setHasVehicleError(true);\n    } finally {\n      hasLoadedVehiclesRef.current = true;\n      setIsLoadingVehicles(false);\n      append('UI: state committed');\n    }\n  }, []);`,
  'loadVehicles',
);

replaceOnce(
  `        </View>\n\n        {isLoadingVehicles || hasVehicleError || vehicles.length === 0 ? (`,
  `        </View>\n\n        <View style={styles.diagnosticPanel}>\n          {diagnosticLines.map((line, index) => (\n            <Text key={\`${'${index}-${line}'}\`} selectable style={styles.diagnosticText}>\n              {line}\n            </Text>\n          ))}\n        </View>\n\n        {isLoadingVehicles || hasVehicleError || vehicles.length === 0 ? (`,
  'diagnostic panel',
);

replaceOnce(
  `const styles = StyleSheet.create({\n  content: {`,
  `const styles = StyleSheet.create({\n  diagnosticPanel: {\n    gap: 4,\n    padding: 12,\n    borderWidth: 1,\n    borderColor: 'rgba(225,29,46,0.35)',\n    borderRadius: 10,\n    backgroundColor: 'rgba(225,29,46,0.08)',\n  },\n  diagnosticText: {\n    color: colors.textMuted,\n    fontSize: 11,\n    lineHeight: 16,\n    fontFamily: typography.fontFamily.body,\n  },\n  content: {`,
  'diagnostic styles',
);

fs.writeFileSync(path, content);
fs.unlinkSync(new URL(import.meta.url));
console.log('Build 8 pre-Build4 network control diagnostics applied.');
