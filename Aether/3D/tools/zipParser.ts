import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ArchiveFileEntry } from './types';

const execFileAsync = promisify(execFile);

export interface ParsedZipResult {
  sha256: string;
  size_bytes: number;
  format: 'ZIP';
  file_count: number;
  folder_count: number;
  uncompressed_total_bytes: number;
  folders: string[];
  files: ArchiveFileEntry[];
  nested_archives: string[];
  warnings: string[];
  is_corrupt: boolean;
  corruption_reason: string | null;
}

const NESTED_ARCHIVE_EXTENSIONS = new Set([
  '.zip',
  '.7z',
  '.rar',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.lzh',
]);

/**
 * Calculates SHA-256 hash of an entire file on disk via streaming.
 */
export async function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Inspects a ZIP archive using the ZIP binary format (Central Directory records).
 * Falls back to /usr/bin/unzip if necessary.
 */
export async function parseZipArchive(
  filePath: string,
  options: { computeEntrySha256?: boolean } = {}
): Promise<ParsedZipResult> {
  const stat = await fs.promises.stat(filePath);
  const size_bytes = stat.size;
  const sha256 = await calculateFileSha256(filePath);

  const warnings: string[] = [];
  const files: ArchiveFileEntry[] = [];
  const foldersSet = new Set<string>();
  const nestedArchives: string[] = [];
  let uncompressed_total_bytes = 0;

  try {
    const fd = await fs.promises.open(filePath, 'r');
    try {
      // Find End of Central Directory (EOCD) signature: 0x06054b50
      // Scan up to 65KB + 22 bytes from the end of the file
      const searchSize = Math.min(size_bytes, 65536 + 22);
      const searchBuffer = Buffer.alloc(searchSize);
      await fd.read(searchBuffer, 0, searchSize, size_bytes - searchSize);

      let eocdOffset = -1;
      for (let i = searchSize - 22; i >= 0; i--) {
        if (
          searchBuffer[i] === 0x50 &&
          searchBuffer[i + 1] === 0x4b &&
          searchBuffer[i + 2] === 0x05 &&
          searchBuffer[i + 3] === 0x06
        ) {
          eocdOffset = size_bytes - searchSize + i;
          break;
        }
      }

      if (eocdOffset === -1) {
        throw new Error('EOCD signature not found; attempting system unzip fallback.');
      }

      const eocdBuf = Buffer.alloc(22);
      await fd.read(eocdBuf, 0, 22, eocdOffset);

      const totalEntries = eocdBuf.readUInt16LE(10);
      const cdSize = eocdBuf.readUInt32LE(12);
      const cdOffset = eocdBuf.readUInt32LE(16);

      // Read entire Central Directory
      const cdBuf = Buffer.alloc(cdSize);
      await fd.read(cdBuf, 0, cdSize, cdOffset);

      let ptr = 0;
      let entriesCount = 0;

      while (ptr < cdSize - 4) {
        const sig = cdBuf.readUInt32LE(ptr);
        if (sig !== 0x02014b50) {
          // Central Directory File Header Signature
          break;
        }

        const generalFlag = cdBuf.readUInt16LE(ptr + 8);
        const compMethod = cdBuf.readUInt16LE(ptr + 10);
        const crc32Num = cdBuf.readUInt32LE(ptr + 16);
        const compSize = cdBuf.readUInt32LE(ptr + 20);
        const uncompSize = cdBuf.readUInt32LE(ptr + 24);
        const nameLen = cdBuf.readUInt16LE(ptr + 28);
        const extraLen = cdBuf.readUInt16LE(ptr + 30);
        const commentLen = cdBuf.readUInt16LE(ptr + 32);
        const localHeaderOffset = cdBuf.readUInt32LE(ptr + 42);

        // Encoding check: Bit 11 = UTF-8
        const isUtf8 = (generalFlag & 0x0800) !== 0;
        const nameBuf = cdBuf.subarray(ptr + 46, ptr + 46 + nameLen);
        const rawPath = nameBuf.toString(isUtf8 ? 'utf8' : 'latin1');
        const internalPath = rawPath.replace(/\\/g, '/');

        const isDir = internalPath.endsWith('/') || (uncompSize === 0 && compSize === 0 && nameLen > 0 && internalPath.endsWith('/'));
        const fileName = isDir
          ? internalPath.split('/').filter(Boolean).pop() || ''
          : path.basename(internalPath);
        const ext = isDir ? '' : path.extname(fileName).toLowerCase();

        // Check for suspicious paths (directory traversal / Zip Slip)
        let isSuspicious = false;
        let corruptionNotes: string | null = null;

        if (internalPath.includes('../') || internalPath.startsWith('/')) {
          isSuspicious = true;
          corruptionNotes = 'Potential path traversal detected in internal path';
          warnings.push(`Security warning: suspicious path "${internalPath}"`);
        }

        const isNested = !isDir && NESTED_ARCHIVE_EXTENSIONS.has(ext);
        if (isNested) {
          nestedArchives.push(internalPath);
        }

        if (isDir) {
          foldersSet.add(internalPath);
        } else {
          // Add parent folders
          const dirPart = path.dirname(internalPath);
          if (dirPart && dirPart !== '.') {
            foldersSet.add(dirPart + '/');
          }

          uncompressed_total_bytes += uncompSize;

          let entrySha256 = 'NOT_DETERMINED';

          // Optional deep hash computation for small files if requested
          if (options.computeEntrySha256 && uncompSize < 10 * 1024 * 1024) {
            try {
              // Read local file header to find payload
              const lfhBuf = Buffer.alloc(30);
              await fd.read(lfhBuf, 0, 30, localHeaderOffset);
              if (lfhBuf.readUInt32LE(0) === 0x04034b50) {
                const lfhNameLen = lfhBuf.readUInt16LE(26);
                const lfhExtraLen = lfhBuf.readUInt16LE(28);
                const dataOffset = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;

                const compData = Buffer.alloc(compSize);
                await fd.read(compData, 0, compSize, dataOffset);

                if (compMethod === 0) {
                  // Stored (no compression)
                  entrySha256 = createHash('sha256').update(compData).digest('hex');
                } else if (compMethod === 8) {
                  // Deflate
                  const decompressed = zlib.inflateRawSync(compData);
                  entrySha256 = createHash('sha256').update(decompressed).digest('hex');
                }
              }
            } catch (decompErr: any) {
              warnings.push(`Could not decompress "${internalPath}" for SHA256: ${decompErr.message}`);
            }
          }

          const methodStr =
            compMethod === 0 ? 'STORED' : compMethod === 8 ? 'DEFLATED' : `METHOD_${compMethod}`;

          files.push({
            internal_path: internalPath,
            file_name: fileName,
            extension: ext,
            size_bytes: uncompSize,
            compressed_size_bytes: compSize,
            crc32: crc32Num.toString(16).padStart(8, '0'),
            sha256: entrySha256,
            is_directory: false,
            is_nested_archive: isNested,
            is_suspicious_or_corrupt: isSuspicious,
            corruption_notes: corruptionNotes,
            compression_method: methodStr,
            offset: localHeaderOffset,
          });
        }

        ptr += 46 + nameLen + extraLen + commentLen;
        entriesCount++;
      }

      await fd.close();

      return {
        sha256,
        size_bytes,
        format: 'ZIP',
        file_count: files.length,
        folder_count: foldersSet.size,
        uncompressed_total_bytes,
        folders: Array.from(foldersSet).sort(),
        files,
        nested_archives: nestedArchives,
        warnings,
        is_corrupt: false,
        corruption_reason: null,
      };
    } catch (parseErr: any) {
      await fd.close();
      throw parseErr;
    }
  } catch (err: any) {
    // Attempt fallback with system unzip tool
    warnings.push(`Central directory parse warning: ${err.message}. Running fallback parser.`);
    try {
      return await parseWithSystemUnzip(filePath, sha256, size_bytes, warnings);
    } catch (fallbackErr: any) {
      return {
        sha256,
        size_bytes,
        format: 'ZIP',
        file_count: 0,
        folder_count: 0,
        uncompressed_total_bytes: 0,
        folders: [],
        files: [],
        nested_archives: [],
        warnings,
        is_corrupt: true,
        corruption_reason: `Failed to inspect archive: ${err.message}; Fallback: ${fallbackErr.message}`,
      };
    }
  }
}

/**
 * Fallback parser using system unzip -l -v
 */
async function parseWithSystemUnzip(
  filePath: string,
  sha256: string,
  size_bytes: number,
  initialWarnings: string[]
): Promise<ParsedZipResult> {
  const { stdout } = await execFileAsync('/usr/bin/unzip', ['-l', '-v', filePath]);
  const lines = stdout.split('\n');

  const files: ArchiveFileEntry[] = [];
  const foldersSet = new Set<string>();
  const nestedArchives: string[] = [];
  let uncompressed_total_bytes = 0;
  const warnings = [...initialWarnings];

  let tableStarted = false;
  for (const line of lines) {
    if (line.includes('Length') && line.includes('Method') && line.includes('Name')) {
      tableStarted = true;
      continue;
    }
    if (line.startsWith(' --------') || line.startsWith('--------')) {
      continue;
    }
    if (!tableStarted) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 8) continue;

    const length = parseInt(parts[0], 10);
    const method = parts[1];
    const compSize = parseInt(parts[2], 10);
    const crc = parts[6];
    const internalPath = parts.slice(7).join(' ').replace(/\\/g, '/');

    if (isNaN(length) || !internalPath) continue;

    const isDir = internalPath.endsWith('/');
    const fileName = isDir
      ? internalPath.split('/').filter(Boolean).pop() || ''
      : path.basename(internalPath);
    const ext = isDir ? '' : path.extname(fileName).toLowerCase();

    if (isDir) {
      foldersSet.add(internalPath);
    } else {
      const isNested = NESTED_ARCHIVE_EXTENSIONS.has(ext);
      if (isNested) nestedArchives.push(internalPath);

      uncompressed_total_bytes += length;
      files.push({
        internal_path: internalPath,
        file_name: fileName,
        extension: ext,
        size_bytes: length,
        compressed_size_bytes: compSize || length,
        crc32: crc.toLowerCase(),
        sha256: 'NOT_DETERMINED',
        is_directory: false,
        is_nested_archive: isNested,
        is_suspicious_or_corrupt: internalPath.includes('../'),
        corruption_notes: internalPath.includes('../') ? 'Path traversal detected' : null,
        compression_method: method,
      });
    }
  }

  return {
    sha256,
    size_bytes,
    format: 'ZIP',
    file_count: files.length,
    folder_count: foldersSet.size,
    uncompressed_total_bytes,
    folders: Array.from(foldersSet).sort(),
    files,
    nested_archives: nestedArchives,
    warnings,
    is_corrupt: false,
    corruption_reason: null,
  };
}
