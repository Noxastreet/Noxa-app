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
  "import { getCurrentSessionUser, supabase } from '@/src/lib/supabase';",
  "import { requireClientEnv } from '@/src/config/env';\nimport { supabase } from '@/src/lib/supabase';",
  'Garage imports',
);

replaceOnce(
  '\n\nfunction vehicleMeta(vehicle: GarageVehicle) {',
  `\n\nconst { supabaseUrl, supabasePublishableKey } = requireClientEnv();\n\ntype RestProbeResult = {\n  status: number;\n  headersMs: number;\n  bodyMs: number;\n  bytes: number;\n};\n\nfunction diagnosticError(error: unknown) {\n  if (error instanceof Error) return \`${'${error.name}: ${error.message}'}\`;\n  return String(error);\n}\n\nasync function probeVehiclesRest(\n  userId: string,\n  accessToken: string,\n): Promise<RestProbeResult> {\n  const controller = new AbortController();\n  const timeout = setTimeout(() => controller.abort(), 10000);\n  const startedAt = Date.now();\n\n  try {\n    const query = new URLSearchParams({\n      select: 'id',\n      owner_id: \`eq.\${userId}\`,\n      limit: '1',\n    });\n    const response = await fetch(\`${'${supabaseUrl}'}/rest/v1/vehicles?\${query.toString()}\`, {\n      headers: {\n        Accept: 'application/json',\n        apikey: supabasePublishableKey,\n        Authorization: \`Bearer \${accessToken}\`,\n      },\n      signal: controller.signal,\n    });\n    const headersMs = Date.now() - startedAt;\n    const bodyStartedAt = Date.now();\n    const body = await response.text();\n\n    return {\n      status: response.status,\n      headersMs,\n      bodyMs: Date.now() - bodyStartedAt,\n      bytes: body.length,\n    };\n  } finally {\n    clearTimeout(timeout);\n  }\n}\n\nfunction vehicleMeta(vehicle: GarageVehicle) {`,
  'Garage REST probe helpers',
);

replaceOnce(
  `  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);\n  const hasLoadedVehiclesRef = useRef(false);`,
  `  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);\n  const [diagnosticLines, setDiagnosticLines] = useState<string[]>([\n    'BUILD 7 DATA DIAGNOSTICS',\n    'Waiting for Garage request…',\n  ]);\n  const hasLoadedVehiclesRef = useRef(false);\n  const diagnosticRunRef = useRef(0);`,
  'Garage diagnostic state',
);

replaceBetween(
  '  const loadVehicles = useCallback(async () => {',
  '\n\n  useFocusEffect(',
  `  const loadVehicles = useCallback(async () => {\n    const runId = ++diagnosticRunRef.current;\n    const appendDiagnostic = (message: string) => {\n      if (runId !== diagnosticRunRef.current) return;\n      setDiagnosticLines((current) => [\n        current[0] ?? 'BUILD 7 DATA DIAGNOSTICS',\n        ...current.slice(-5),\n        message,\n      ]);\n    };\n\n    setDiagnosticLines([\n      'BUILD 7 DATA DIAGNOSTICS',\n      'SESSION: checking local session…',\n    ]);\n    setIsLoadingVehicles(!hasLoadedVehiclesRef.current);\n    setHasVehicleError(false);\n\n    const sessionStartedAt = Date.now();\n    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();\n    const session = sessionData.session;\n\n    if (sessionError || !session) {\n      appendDiagnostic(\n        \`SESSION: FAIL after \${Date.now() - sessionStartedAt}ms — \${\n          sessionError?.message ?? 'no session'\n        }\`,\n      );\n      setVehicles([]);\n      setHasVehicleError(true);\n      hasLoadedVehiclesRef.current = true;\n      setIsLoadingVehicles(false);\n      return;\n    }\n\n    appendDiagnostic(\n      \`SESSION: OK in \${Date.now() - sessionStartedAt}ms\`,\n    );\n\n    appendDiagnostic('RAW REST: request sent…');\n    void probeVehiclesRest(session.user.id, session.access_token)\n      .then((probe) => {\n        appendDiagnostic(\n          \`RAW REST: HTTP \${probe.status}, headers \${probe.headersMs}ms, body \${probe.bodyMs}ms, \${probe.bytes}B\`,\n        );\n      })\n      .catch((error) => {\n        appendDiagnostic(\`RAW REST: FAIL — \${diagnosticError(error)}\`);\n      });\n\n    appendDiagnostic('SUPABASE CLIENT: request sent…');\n    const clientStartedAt = Date.now();\n\n    try {\n      const { data, error } = await supabase\n        .from('vehicles')\n        .select(vehicleSelect)\n        .eq('owner_id', session.user.id)\n        .order('is_primary', { ascending: false })\n        .order('created_at', { ascending: false });\n\n      const clientMs = Date.now() - clientStartedAt;\n      appendDiagnostic(\n        error\n          ? \`SUPABASE CLIENT: ERROR in \${clientMs}ms — \${error.code ?? 'unknown'} \${error.message}\`\n          : \`SUPABASE CLIENT: OK in \${clientMs}ms — \${data?.length ?? 0} rows\`,\n      );\n\n      if (error) {\n        setHasVehicleError(true);\n      } else {\n        setVehicles((data ?? []) as GarageVehicle[]);\n      }\n\n      appendDiagnostic('UI: state committed');\n    } catch (error) {\n      appendDiagnostic(\`SUPABASE CLIENT: THROW — \${diagnosticError(error)}\`);\n      setHasVehicleError(true);\n    } finally {\n      hasLoadedVehiclesRef.current = true;\n      setIsLoadingVehicles(false);\n    }\n  }, []);`,
  'Garage diagnostic load flow',
);

replaceOnce(
  `        </View>\n\n        {isLoadingVehicles || hasVehicleError || vehicles.length === 0 ? (`,
  `        </View>\n\n        <View style={styles.diagnosticPanel}>\n          {diagnosticLines.map((line, index) => (\n            <Text key={\`${'${index}-${line}'}\`} selectable style={styles.diagnosticText}>\n              {line}\n            </Text>\n          ))}\n        </View>\n\n        {isLoadingVehicles || hasVehicleError || vehicles.length === 0 ? (`,
  'Garage diagnostic panel',
);

replaceOnce(
  `const styles = StyleSheet.create({\n  content: {`,
  `const styles = StyleSheet.create({\n  diagnosticPanel: {\n    gap: 4,\n    padding: 12,\n    borderWidth: 1,\n    borderColor: 'rgba(225,29,46,0.35)',\n    borderRadius: 10,\n    backgroundColor: 'rgba(225,29,46,0.08)',\n  },\n  diagnosticText: {\n    color: colors.textMuted,\n    fontSize: 11,\n    lineHeight: 16,\n    fontFamily: typography.fontFamily.body,\n  },\n  content: {`,
  'Garage diagnostic styles',
);

fs.writeFileSync(path, content);
fs.unlinkSync(new URL(import.meta.url));
console.log('Build 7 Garage data diagnostics applied.');
