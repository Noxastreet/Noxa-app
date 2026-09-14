import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const editor = fs.readFileSync('app/post-editor.tsx', 'utf8');
const details = fs.readFileSync('app/post-details.tsx', 'utf8');

assert(
  /useNavigation/.test(editor) && /navigation\.addListener\("beforeRemove"/.test(editor),
  'Post editor must guard route removal while a publish is in flight.',
);
assert(
  /publishingRef\.current = true[\s\S]*allowNavigationRef\.current = false[\s\S]*setPublishing\(true\)/.test(editor),
  'Publishing must arm the post editor navigation guard before async work starts.',
);
assert(
  /if \(!publishingRef\.current \|\| allowNavigationRef\.current\) return;[\s\S]*event\.preventDefault\(\)/.test(editor),
  'User navigation must be blocked while publishing unless success explicitly allows it.',
);
assert(
  /disabled=\{publishing\}[\s\S]*onPress=\{\(\) => router\.back\(\)\}/.test(editor),
  'The visible Back control must be disabled during publishing.',
);
assert(
  /allowNavigationRef\.current = true;[\s\S]*publishingRef\.current = false;[\s\S]*router\.replace\(\{ pathname: "\/post-details"/.test(editor),
  'Successful publish must explicitly unlock navigation before replacing the editor.',
);
assert(
  /\{error \? \([\s\S]*<Pressable onPress=\{\(\) => void loadPost\(false\)\} style=\{styles\.retryButton\}>[\s\S]*RETRY[\s\S]*\) : null\}/.test(details),
  'Post load errors must always expose Retry, including the initial load before post data exists.',
);
assert(
  !/\{post \? \([\s\S]*loadPost\(false\)[\s\S]*\) : null\}[\s\S]*<\/View>[\s\S]*\) : null\}/.test(details),
  'Retry must not be gated on an already-loaded post.',
);

if (!process.exitCode) {
  console.log('Post flow reliability contract passed.');
}
