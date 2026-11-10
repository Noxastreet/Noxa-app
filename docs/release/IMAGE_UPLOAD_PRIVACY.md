# Image upload privacy — candidate acceptance

Refs #196, #392. Status: code candidate; native acceptance **not verified**.

## Behavior

All six image upload paths (avatar, vehicle, post, event gallery, crew gallery,
and entity covers for events/crews) call `prepareImageUpload` before Storage.
Picker `exif: false` controls the returned EXIF object, not a guarantee about file
bytes. The new boundary decodes the image to pixels and encodes a new file. It
never uploads the original as an error fallback.

JPEG/HEIC/HEIF inputs become JPEG at quality 0.85. PNG and WebP inputs become
PNG to preserve transparency. The long edge is limited to 2048 pixels without
upscaling. Original and encoded files must satisfy the existing 5/6/10 MB limit.
The object extension and MIME type come from the encoder, not a user filename.
Native image/context references and generated cache files are released/removed.

## Dependencies and rollout

Expo SDK 54 selects `expo-image-manipulator ~14.0.8`. It is needed for image
decoding, orientation and pixel encoding across JPEG/PNG/WebP/HEIC instead of a
custom container parser. `expo-file-system ~19.0.24`, already an Expo dependency,
is promoted to a direct dependency for removing only the generated cache file.
The lockfile pins both resolutions; no unrelated dependency upgrades.

**A new native iOS/Android binary is required. Do not deliver this code as an
OTA update to an installed binary without ImageManipulator.** Preserve existing
signing configuration. Roll back by retaining/reinstalling the prior native
candidate, not by applying production schema changes. Existing Storage objects
are not modified; inspect/back up and separately approve any historical cleanup.
Client processing does not prevent a modified client uploading original bytes
directly: server-side sanitization is a separate defense-in-depth requirement.

## Verification

`node scripts/test-image-upload-privacy.mjs` exercises the real upload helper and
entity-cover upload with a mocked native codec: safe output bytes/MIME/extension,
alpha policy, resizing, source/output size limits, decoder/cache/signature
failures, no original fallback, cache cleanup and six-path wiring.
It does **not** prove native metadata removal, rendered pixels, or decode support.

Physical iPhone, iPad and Android acceptance on an exact signed candidate:

- Use locally generated tagged fixtures, with known GPS, camera serial, timestamp,
  XMP/IPTC and EXIF orientation, in JPEG/PNG/WebP/HEIC/HEIF as supported by the OS.
- Upload through every path using QA accounts; download the stored bytes and
  inspect using an independent metadata reader (for example ExifTool). Verify
  sensitive source metadata is absent; compare MIME, dimensions and extension.
- Compare upright and rotated portraits, mirrored photos, transparent PNG/WebP,
  small images and high-resolution images; inspect image quality and memory.
- Simulate encoding/read failure and encoded output exceeding its limit: no
  Storage object or database row is created, and the editor remains retryable.
- Repeat slow upload, cancellation/navigation and account deletion regressions.

No production migration, historic media rewrite, native build, OTA publication,
or App Review submission is performed by this change.
