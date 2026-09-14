import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const editor = fs.readFileSync('app/post-editor.tsx', 'utf8');
const details = fs.readFileSync('app/post-details.tsx', 'utf8');
const errorBlock =
  details.match(/\{error \? \(\s*<View style=\{styles\.errorCard\}>[\s\S]*?<\/View>\s*\) : null\}/)?.[0] ?? '';
const submitCommentBlock =
  details.match(/const submitComment = useCallback\([\s\S]*?const confirmDeleteComment = useCallback/)?.[0] ?? '';

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
  Boolean(errorBlock) && /loadPost\(false\)/.test(errorBlock) && /RETRY/.test(errorBlock),
  'Post load errors must always expose Retry, including the initial load before post data exists.',
);
assert(
  !/\{post \? \(/.test(errorBlock),
  'Retry must not be gated on an already-loaded post.',
);
assert(
  /async function loadCommentViewModels\(/.test(details) && /\.from\("post_comments"\)/.test(details),
  'Comment refresh must have a dedicated comments-only loader.',
);
assert(
  /loadCommentViewModels\(loadedPost\.id, userId\)/.test(details),
  'Initial post loading must reuse the comments-only loader.',
);
assert(
  Boolean(submitCommentBlock) && /loadCommentViewModels\(post\.id, currentUserId\)/.test(submitCommentBlock),
  'Comment submission must refresh only the comment graph.',
);
assert(
  Boolean(submitCommentBlock) && !/loadPost\(false\)/.test(submitCommentBlock),
  'Comment submission must not refetch Like/Save/post state and overwrite concurrent actions.',
);
assert(
  /if \(!currentUserId \|\| commentActionId \|\| submittingComment\) return;/.test(details),
  'Comment likes must be blocked while the post-submit comment refresh is in flight.',
);
assert(
  /disabled=\{busy \|\| disabled\}/.test(details),
  'Comment interaction controls must stay disabled during the post-submit comment refresh.',
);

if (!process.exitCode) {
  console.log('Post flow reliability contract passed.');
}
