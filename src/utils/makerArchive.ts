import JSZip from 'jszip';
import type {
  CustomAssetMeta,
  CustomTextureAssetMeta,
  GameProject,
  VoiceClipMeta,
} from '../types/maker';
import { arrayBufferToBase64 } from './assetVault';

export interface CompressedMakerResult {
  blob: Blob;
  filename: string;
  rawBytes: number;
  compressedBytes: number;
  compressed: boolean;
}

export interface ZipAssetEntry {
  meta: CustomAssetMeta;
  buffer: ArrayBuffer;
}

export interface ZipTextureEntry {
  meta: CustomTextureAssetMeta;
  mimeType: string;
  buffer: ArrayBuffer;
}

export interface ZipVoiceEntry {
  meta: VoiceClipMeta;
  mimeType: string;
  buffer: ArrayBuffer;
}

export interface ZipProjectExportResult {
  blob: Blob;
  filename: string;
  fileCount: number;
  zipBytes: number;
  assetCount: number;
  textureCount: number;
  voiceCount: number;
}

interface ZipManifestAssetRef {
  id: string;
  file: string;
  meta: CustomAssetMeta;
}

interface ZipManifestTextureRef {
  id: string;
  file: string;
  mimeType: string;
  meta: CustomTextureAssetMeta;
}

interface ZipManifestVoiceRef {
  id: string;
  file: string;
  mimeType: string;
  meta: VoiceClipMeta;
}

interface MakerZipManifest {
  format: 'maker.zip.v1';
  app: 'Maker';
  exportedAt: string;
  title: string;
  subtitle: string;
  summary: string;
  sharedBy?: string;
  projectFile: string;
  assets: ZipManifestAssetRef[];
  textures: ZipManifestTextureRef[];
  voiceOvers: ZipManifestVoiceRef[];
}

function slugifySegment(value: string, fallback = 'item'): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function extensionFromMime(mimeType: string, fallback: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('svg')) return 'svg';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  return fallback;
}

export function projectToMakerFilename(name: string): string {
  const slug = slugifySegment(name, 'maker-game');
  return `${slug}.maker`;
}

export function projectToZipFilename(name: string): string {
  const slug = slugifySegment(name, 'maker-adventure');
  return `${slug}.zip`;
}

/**
 * Compresses a serialized Maker JSON bundle into a compact gzip-compressed `.maker` binary Blob.
 * Uses native Web Streams CompressionStream('gzip') with a safe uncompressed fallback if unavailable.
 */
export async function compressMakerBundle(
  jsonText: string,
  projectName: string
): Promise<CompressedMakerResult> {
  const encoder = new TextEncoder();
  const rawUint8 = encoder.encode(jsonText);
  const rawBytes = rawUint8.byteLength;
  const filename = projectToMakerFilename(projectName);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const compressedStream = new Blob([rawUint8])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const buffer = await new Response(compressedStream).arrayBuffer();
      return {
        blob: new Blob([buffer], { type: 'application/octet-stream' }),
        filename,
        rawBytes,
        compressedBytes: buffer.byteLength,
        compressed: true,
      };
    } catch {
      // Fall back to plain UTF-8 bytes if gzip stream fails
    }
  }

  return {
    blob: new Blob([rawUint8], { type: 'application/json' }),
    filename,
    rawBytes,
    compressedBytes: rawBytes,
    compressed: false,
  };
}

/**
 * Bundles a Maker project and its referenced binary assets (3D .glb models, custom textures,
 * voiceovers) plus manifest & README into a downloadable ZIP archive.
 */
export async function buildProjectZipArchive(params: {
  project: GameProject;
  sharedBy?: string;
  assets?: ZipAssetEntry[];
  textures?: ZipTextureEntry[];
  voiceOvers?: ZipVoiceEntry[];
}): Promise<ZipProjectExportResult> {
  const { project, sharedBy } = params;
  const assets = params.assets ?? [];
  const textures = params.textures ?? [];
  const voiceOvers = params.voiceOvers ?? [];

  const zip = new JSZip();
  const exportedAt = new Date().toISOString();
  const entityCount = project.levels.reduce((sum, lvl) => sum + lvl.entities.length, 0);
  const targetProject: GameProject = sharedBy?.trim()
    ? { ...project, sharedBy: sharedBy.trim() }
    : project;

  let fileCount = 0;

  zip.file('project.json', JSON.stringify(targetProject, null, 2));
  fileCount += 1;

  const manifestAssets: ZipManifestAssetRef[] = [];
  for (const entry of assets) {
    const safeName = slugifySegment(entry.meta.name, 'model');
    const path = `assets/${entry.meta.id}-${safeName}.glb`;
    zip.file(path, entry.buffer);
    fileCount += 1;
    manifestAssets.push({
      id: entry.meta.id,
      file: path,
      meta: entry.meta,
    });
  }

  const manifestTextures: ZipManifestTextureRef[] = [];
  for (const entry of textures) {
    const safeName = slugifySegment(entry.meta.name, 'texture');
    const ext = extensionFromMime(entry.mimeType, 'png');
    const path = `textures/${entry.meta.id}-${safeName}.${ext}`;
    zip.file(path, entry.buffer);
    fileCount += 1;
    manifestTextures.push({
      id: entry.meta.id,
      file: path,
      mimeType: entry.mimeType,
      meta: entry.meta,
    });
  }

  const manifestVoices: ZipManifestVoiceRef[] = [];
  for (const entry of voiceOvers) {
    const safeName = slugifySegment(entry.meta.name || 'voice', 'voice');
    const ext = extensionFromMime(entry.mimeType, 'webm');
    const path = `voiceovers/${entry.meta.id}-${safeName}.${ext}`;
    zip.file(path, entry.buffer);
    fileCount += 1;
    manifestVoices.push({
      id: entry.meta.id,
      file: path,
      mimeType: entry.mimeType,
      meta: entry.meta,
    });
  }

  const manifest: MakerZipManifest = {
    format: 'maker.zip.v1',
    app: 'Maker',
    exportedAt,
    title: targetProject.name,
    subtitle: targetProject.coverTagline || targetProject.tagline,
    summary: `${targetProject.levels.length} levels, ${entityCount} entities`,
    ...(targetProject.sharedBy ? { sharedBy: targetProject.sharedBy } : {}),
    projectFile: 'project.json',
    assets: manifestAssets,
    textures: manifestTextures,
    voiceOvers: manifestVoices,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  fileCount += 1;

  const levelLines = targetProject.levels
    .map(
      (lvl, idx) =>
        `  ${idx + 1}. ${lvl.name} (${lvl.biome}, ${lvl.entities.length} entities)`
    )
    .join('\n');

  const readmeText = [
    `${targetProject.name}`,
    `${'='.repeat(Math.max(8, targetProject.name.length))}`,
    targetProject.coverTagline || targetProject.tagline,
    '',
    `Exported:   ${exportedAt}`,
    `Difficulty: ${targetProject.difficulty}`,
    `Levels:     ${targetProject.levels.length}`,
    `Entities:   ${entityCount}`,
    `3D Models:  ${assets.length}`,
    `Textures:   ${textures.length}`,
    `Voiceovers: ${voiceOvers.length}`,
    ...(targetProject.sharedBy ? [`Creator:    ${targetProject.sharedBy}`] : []),
    '',
    'Levels:',
    levelLines || '  (none)',
    '',
    'Contents:',
    '  - project.json     Complete game state (levels, terrain, cast, rules, HUD)',
    '  - manifest.json    Archive metadata and binary asset index',
    ...(assets.length > 0 ? ['  - assets/          Custom 3D .glb models'] : []),
    ...(textures.length > 0 ? ['  - textures/        Custom surface/foliage textures'] : []),
    ...(voiceOvers.length > 0 ? ['  - voiceovers/      Recorded dialogue & story voiceovers'] : []),
    '',
    'To reopen this 3D adventure in Maker, click Open in the Project Browser and select this .zip file.',
    '',
  ].join('\n');

  zip.file('README.txt', readmeText);
  fileCount += 1;

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    filename: projectToZipFilename(targetProject.name),
    fileCount,
    zipBytes: blob.size,
    assetCount: assets.length,
    textureCount: textures.length,
    voiceCount: voiceOvers.length,
  };
}

/**
 * Triggers a browser download for a Blob using the given filename.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Reads either a gzip-compressed binary `.maker` file or a plain UTF-8 `.maker` / `.json` file
 * and returns the decoded JSON string.
 */
export async function readMakerFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Detect gzip magic bytes (0x1F, 0x8B)
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (isGzip) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser does not support decompressing compressed .maker files.');
    }
    const decompressedStream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return await new Response(decompressedStream).text();
  }

  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Checks whether a file is a ZIP archive (PK\x03\x04 magic bytes or `.zip` extension).
 */
export async function isZipArchiveFile(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith('.zip')) return true;
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    header[2] === 0x03 &&
    header[3] === 0x04
  );
}

/**
 * Reads an exported Maker `.zip` archive and returns a JSON bundle string compatible with `importProjectJSON`.
 */
export async function readMakerZipAsBundleText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const manifestEntry = zip.file('manifest.json');
  let manifest: Partial<MakerZipManifest> | null = null;
  if (manifestEntry) {
    try {
      manifest = JSON.parse(await manifestEntry.async('text')) as Partial<MakerZipManifest>;
    } catch {
      manifest = null;
    }
  }

  const projectPath = manifest?.projectFile || 'project.json';
  const projectEntry =
    zip.file(projectPath) ??
    zip.file('project.json') ??
    Object.values(zip.files).find((f) => !f.dir && f.name.endsWith('.json') && f.name !== 'manifest.json');

  if (!projectEntry) {
    throw new Error('No project.json found inside that ZIP archive.');
  }

  const parsedProject = JSON.parse(await projectEntry.async('text'));
  if (parsedProject && parsedProject.project && Array.isArray(parsedProject.project.levels)) {
    return JSON.stringify(parsedProject);
  }

  const assets = [];
  for (const ref of manifest?.assets ?? []) {
    const entry = zip.file(ref.file);
    if (!entry) continue;
    const ab = await entry.async('arraybuffer');
    assets.push({
      meta: ref.meta,
      base64Glb: arrayBufferToBase64(ab),
    });
  }

  const textures = [];
  for (const ref of manifest?.textures ?? []) {
    const entry = zip.file(ref.file);
    if (!entry) continue;
    const ab = await entry.async('arraybuffer');
    textures.push({
      meta: ref.meta,
      mimeType: ref.mimeType,
      base64Image: arrayBufferToBase64(ab),
    });
  }

  const voiceOvers = [];
  for (const ref of manifest?.voiceOvers ?? []) {
    const entry = zip.file(ref.file);
    if (!entry) continue;
    const ab = await entry.async('arraybuffer');
    voiceOvers.push({
      meta: ref.meta,
      mimeType: ref.mimeType,
      base64Audio: arrayBufferToBase64(ab),
    });
  }

  return JSON.stringify({
    format: 'maker.game.v2',
    sharedBy: manifest?.sharedBy,
    project: parsedProject,
    ...(assets.length > 0 ? { assets } : {}),
    ...(textures.length > 0 ? { textures } : {}),
    ...(voiceOvers.length > 0 ? { voiceOvers } : {}),
  });
}
