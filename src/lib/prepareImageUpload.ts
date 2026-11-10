import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

type UploadImageAsset = {
  uri: string;
  mimeType?: string | null;
};

const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_IMAGE_EDGE = 2048;

async function readImageBytes(uri: string, maxBytes: number) {
  const bytes = await fetch(uri).then((response) => response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > maxBytes) {
    throw new Error(`Choose a photo smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  return bytes;
}

/** Upload only newly encoded pixels, never the original file or picker EXIF object. */
export async function prepareImageUpload(asset: UploadImageAsset, maxBytes: number) {
  const sourceType = asset.mimeType?.toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!sourceType || !supportedTypes.has(sourceType)) {
    throw new Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.');
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Invalid photo size limit.');
  // Keep the existing source-size limit before native decoding, including when
  // picker fileSize is absent or inaccurate. Do not retain the original bytes.
  await readImageBytes(asset.uri, maxBytes);

  const preserveAlpha = sourceType === 'image/png' || sourceType === 'image/webp';
  const contentType = preserveAlpha ? 'image/png' : 'image/jpeg';
  const extension = preserveAlpha ? 'png' : 'jpeg';
  const context = ImageManipulator.manipulate(asset.uri);
  let image: ImageRef | undefined;
  let generatedUri: string | undefined;
  try {
    // The native codec applies orientation before discarding source metadata.
    image = await context.renderAsync();
    if (Math.max(image.width, image.height) > MAX_IMAGE_EDGE) {
      context.resize(image.width >= image.height
        ? { width: MAX_IMAGE_EDGE }
        : { height: MAX_IMAGE_EDGE });
      image.release();
      image = undefined;
      image = await context.renderAsync();
    }
    const generated = await image.saveAsync({
      format: preserveAlpha ? SaveFormat.PNG : SaveFormat.JPEG,
      compress: 0.85,
    });
    // Fail closed if a platform ever returns the original URI instead of a new
    // encoded image. Never delete or upload the original through this helper.
    if (generated.uri === asset.uri) throw new Error('Photo could not be prepared safely.');
    generatedUri = generated.uri;
    const arrayBuffer = await readImageBytes(generatedUri, maxBytes);
    const signature = new Uint8Array(arrayBuffer);
    const validSignature = preserveAlpha
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)
      : signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    if (!validSignature) throw new Error('Photo could not be prepared safely.');
    return { arrayBuffer, contentType, extension };
  } finally {
    image?.release();
    context.release();
    if (generatedUri) {
      try { new File(generatedUri).delete(); } catch {
        // The OS may have evicted this cache file already. No original fallback.
      }
    }
  }
}
