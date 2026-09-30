import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
let controls = 0;
for (const file of ['app', 'src', 'components'].flatMap(files)) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const names = attributes.map((a) => a.name.getText(ast));
      if (['Pressable', 'TouchableOpacity', 'TouchableWithoutFeedback'].includes(tag) && names.includes('onPress')) {
        controls += 1;
        assert.ok(names.includes('accessibilityRole'), file + ':' + (ast.getLineAndCharacterOfPosition(node.pos).line + 1) + ': interactive control needs a role');
      }
      if (tag === 'Text' || tag === 'TextInput' || tag === 'NoxaInput') {
        const text = node.getText(ast);
        assert.ok(!/colors\.(textSubtle|textTertiary)\b/.test(text), file + ': content cannot use decorative low-contrast tokens');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(!/color:\s*colors\.(textSubtle|textTertiary)\b/.test(source), file + ': unreadable supporting copy');
}
const drive = fs.readFileSync('src/features/group-drive/DriveTogetherMapLayer.tsx', 'utf8');
for (const label of ['Accept destination request', 'Decline destination request', 'Resume location sharing', 'Clear destination search']) {
  assert.ok(drive.includes('accessibilityLabel="' + label + '"'), label + ' must stay discoverable with a screen reader');
}
assert.ok(/accessibilityRole="checkbox" accessibilityState=\{\{ checked: selected \}\}/.test(drive), 'Driver invitation selection must expose checked state');
const map = fs.readFileSync('src/features/mapbox/MapboxLiveMap.tsx', 'utf8');
assert.ok(/accessibilityState=\{\{ selected: selectedDriverId === driver.user_id \}\}/.test(map), 'Map driver selection must be announced without changing privacy-safe labels');
const auth = fs.readFileSync('src/components/auth/NoxaAuthField.tsx', 'utf8');
assert.ok(!auth.includes('console.log'), 'Auth field lifecycle logging must not ship');
console.log('Surface accessibility contract passed: ' + controls + ' raw interactive controls inspected.');
