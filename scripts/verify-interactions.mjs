import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const scanRoots = ['app', 'src', 'components'];
const nativeInteractive = new Set([
  'Button',
  'Pressable',
  'TouchableHighlight',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
]);

function collectTsxFiles(root) {
  const absoluteRoot = path.join(projectRoot, root);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files = [];
  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const fullPath = path.join(absoluteRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(path.relative(projectRoot, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function jsxTagName(tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return tagName.getText();
}

function isInteractiveTag(name) {
  return nativeInteractive.has(name) || /Button$/.test(name);
}

function hasInteractionHandler(attributes) {
  let hasSpread = false;
  for (const attribute of attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) {
      hasSpread = true;
      continue;
    }
    const name = attribute.name.getText();
    if (name === 'onPress' || name === 'href') return { wired: true, spread: hasSpread };
  }
  return { wired: false, spread: hasSpread };
}

const failures = [];
let interactiveCount = 0;
let explicitCount = 0;
let spreadBackedCount = 0;

for (const file of scanRoots.flatMap(collectTsxFiles)) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = jsxTagName(node.tagName);
      if (isInteractiveTag(name)) {
        interactiveCount += 1;
        const interaction = hasInteractionHandler(node.attributes);
        if (interaction.wired) {
          explicitCount += 1;
        } else if (interaction.spread) {
          spreadBackedCount += 1;
        } else {
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          failures.push(
            `${path.relative(projectRoot, file)}:${position.line + 1}:${position.character + 1} <${name}> has no onPress/href and no spread-provided handler`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

if (failures.length > 0) {
  console.error('Interaction wiring audit: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Interaction wiring audit: PASS (${interactiveCount} interactive JSX usages; ${explicitCount} explicit handlers; ${spreadBackedCount} spread-backed usages require runtime acceptance)`,
);
