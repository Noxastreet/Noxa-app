import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function compile(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => {
    assert.ok(id in dependencies, `Unexpected dependency ${id}`);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}

// Native codecs are mocked here. Real tagged JPEG/PNG/HEIC decoding, pixels,
// orientation and metadata inspection remain a physical-device release gate.
const jpeg = Uint8Array.from([255, 216, 255, 224, 0, 2, 255, 217]).buffer;
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).buffer;
const original = new TextEncoder().encode('EXIF GPSLatitude private-home-coordinate').buffer;
let sourceBytes = original;
let outputBytes = jpeg;
let outputUri = 'file:///encoded.jpeg';
let saveError = null;
let readError = false;
let deleteError = false;
let width = 4000;
let height = 3000;
const calls = [];
const deleted = [];
globalThis.fetch = async (uri) => {
  calls.push(['read', uri]);
  if (readError && uri === outputUri) throw new Error('cache read failed');
  return { arrayBuffer: async () => uri === 'file:///original.heic' ? sourceBytes : outputBytes };
};
const privacy = compile('src/lib/prepareImageUpload.ts', {
  'expo-image-manipulator': {
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
    ImageManipulator: { manipulate(uri) {
      calls.push(['decode', uri]);
      return {
        resize(size) { calls.push(['resize', size]); },
        async renderAsync() {
          return { width, height,
            async saveAsync(options) {
              calls.push(['encode', options]);
              if (saveError) throw saveError;
              return { uri: outputUri };
            },
            release() { calls.push(['release-image']); },
          };
        },
        release() { calls.push(['release-context']); },
      };
    } },
  },
  'expo-file-system': { File: class {
    constructor(uri) { this.uri = uri; }
    delete() { deleted.push(this.uri); if (deleteError) throw new Error('evicted'); }
  } },
});
const asset = { uri: 'file:///original.heic', mimeType: 'image/heic', fileName: 'misleading.png' };
let uploaded;
const cover = compile('src/lib/entityCover.ts', {
  'expo-image-picker': {},
  '@/src/lib/prepareImageUpload': privacy,
  '@/src/lib/supabase': { supabase: { storage: { from(bucket) {
    return {
      async upload(path, bytes, options) { uploaded = { bucket, path, bytes, options }; return { error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: `https://storage.example/${path}` } }; },
    };
  } } } },
});

await cover.uploadEntityCover(asset, 'crew', 'crew-a');
assert.equal(uploaded.bytes, outputBytes, 'Storage receives newly encoded bytes');
assert.notEqual(uploaded.bytes, original, 'Original metadata-bearing input must never be uploaded');
assert.equal(uploaded.options.contentType, 'image/jpeg');
assert.match(uploaded.path, /^crews\/crew-a\/.*\.jpeg$/, 'Extension follows actual encoder output');
assert.deepEqual(calls.find(([kind]) => kind === 'resize')[1], { width: 2048 });
assert.ok(deleted.includes(outputUri), 'Generated cache file is removed after reading');
assert.ok(!deleted.includes(asset.uri), 'Original is never removed');

calls.length = 0;
width = 600; height = 1800; outputBytes = png;
for (const mimeType of ['image/png', 'image/webp']) {
  const result = await privacy.prepareImageUpload({ ...asset, mimeType }, 1024);
  assert.equal(result.contentType, 'image/png', 'Alpha-capable input uses PNG output');
  assert.equal(result.extension, 'png');
  assert.equal(calls.some(([kind]) => kind === 'resize'), false, 'Small image is not upscaled');
}
calls.length = 0; width = 3000; height = 4000; outputBytes = jpeg;
await privacy.prepareImageUpload(asset, 1024);
assert.deepEqual(calls.find(([kind]) => kind === 'resize')[1], { height: 2048 });

uploaded = undefined; saveError = new Error('native decoder failed');
await assert.rejects(cover.uploadEntityCover(asset, 'event', 'event-a'), /native decoder failed/);
assert.equal(uploaded, undefined, 'Codec failure must not fall back to original bytes');
assert.ok(calls.some(([kind]) => kind === 'release-context'));
saveError = null;

for (const failure of ['oversized-source', 'oversized-output', 'empty-output', 'wrong-signature', 'read-failure', 'original-uri']) {
  sourceBytes = failure === 'oversized-source' ? new ArrayBuffer(6 * 1024 * 1024 + 1) : original;
  outputBytes = failure === 'oversized-output' ? new ArrayBuffer(6 * 1024 * 1024 + 1)
    : failure === 'empty-output' ? new ArrayBuffer(0)
    : failure === 'wrong-signature' ? original : jpeg;
  outputUri = failure === 'original-uri' ? asset.uri : 'file:///encoded.jpeg';
  readError = failure === 'read-failure';
  uploaded = undefined;
  const deletedBefore = deleted.length;
  await assert.rejects(cover.uploadEntityCover(asset, 'crew', 'crew-a'));
  assert.equal(uploaded, undefined, `${failure} must prevent Storage upload`);
  assert.ok(!deleted.slice(deletedBefore).includes(asset.uri), 'Original survives every error');
}
sourceBytes = original; outputBytes = jpeg; outputUri = 'file:///encoded.jpeg'; readError = false;
deleteError = true;
assert.equal((await privacy.prepareImageUpload(asset, 1024)).arrayBuffer, jpeg, 'Cache eviction does not break safe output');

// Wiring guard: every current image uploader must use the shared boundary.
for (const file of ['app/edit-profile.tsx', 'app/vehicle-editor.tsx', 'app/post-editor.tsx',
  'app/event-gallery.tsx', 'app/crew-gallery.tsx', 'src/lib/entityCover.ts']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /await prepareImageUpload\(/, `${file}: shared privacy boundary`);
  assert.doesNotMatch(source, /\.arrayBuffer\(\)/, `${file}: no original byte upload bypass`);
  assert.match(source, /contentType: uploadContentType/, `${file}: encoder MIME type`);
}
console.log('Image upload privacy: PASS (safe byte boundary, six uploaders, MIME, alpha, size/error paths and cache cleanup; native codec mocked)');
