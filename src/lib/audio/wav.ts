export interface WavInfo {
  audioFormat: 1 | 3;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  dataLength: number;
}

export interface ParsedWav {
  sampleRate: number;
  channels: number;
  pcm: Float32Array;
  duration: number;
}

const RIFF = 0x52494646;
const WAVE = 0x57415645;

/** Parse RIFF/WAVE chunk boundaries and reject truncated or internally inconsistent files. */
export function inspectWav(arrayBuffer: ArrayBuffer): WavInfo | null {
  if (arrayBuffer.byteLength < 12) return null;

  const view = new DataView(arrayBuffer);
  if (view.getUint32(0, false) !== RIFF || view.getUint32(8, false) !== WAVE) return null;

  const riffEnd = 8 + view.getUint32(4, true);
  if (riffEnd < 12 || riffEnd > arrayBuffer.byteLength) return null;

  let format: WavInfo['audioFormat'] | null = null;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let byteRate = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > riffEnd) return null;

    if (chunkId === 0x666d7420 && format === null) { // "fmt "
      if (chunkSize < 16) return null;
      const audioFormat = view.getUint16(chunkStart, true);
      if (audioFormat !== 1 && audioFormat !== 3) return null;
      format = audioFormat;
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      byteRate = view.getUint32(chunkStart + 8, true);
      blockAlign = view.getUint16(chunkStart + 12, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (chunkId === 0x64617461 && dataOffset < 0) { // "data"
      dataOffset = chunkStart;
      dataLength = chunkSize;
    }

    const nextOffset = chunkEnd + (chunkSize & 1);
    if (nextOffset > riffEnd) {
      if (chunkEnd === riffEnd) break;
      return null;
    }
    offset = nextOffset;
  }

  if (format === null || dataOffset < 0 || dataLength <= 0) return null;
  if (channels < 1 || channels > 8 || sampleRate < 8_000 || sampleRate > 192_000) return null;
  if (format === 1 && ![8, 16, 24, 32].includes(bitsPerSample)) return null;
  if (format === 3 && bitsPerSample !== 32) return null;

  const bytesPerSample = bitsPerSample / 8;
  const expectedBlockAlign = channels * bytesPerSample;
  if (blockAlign !== expectedBlockAlign || byteRate !== sampleRate * blockAlign) return null;
  if (dataLength % blockAlign !== 0 || dataOffset + dataLength > riffEnd) return null;

  return { audioFormat: format, sampleRate, channels, bitsPerSample, blockAlign, dataOffset, dataLength };
}

/** Decode supported PCM/IEEE-float WAV data to normalized mono samples for analysis. */
export function parseWavPcm(arrayBuffer: ArrayBuffer): ParsedWav | null {
  const info = inspectWav(arrayBuffer);
  if (!info) return null;

  const view = new DataView(arrayBuffer);
  const bytesPerSample = info.bitsPerSample / 8;
  const frames = info.dataLength / info.blockAlign;
  const pcm = new Float32Array(frames);

  for (let frame = 0; frame < frames; frame += 1) {
    const frameOffset = info.dataOffset + frame * info.blockAlign;
    let frameSum = 0;

    for (let channel = 0; channel < info.channels; channel += 1) {
      const sampleOffset = frameOffset + channel * bytesPerSample;
      let value = 0;
      if (info.audioFormat === 3) {
        value = view.getFloat32(sampleOffset, true);
      } else {
        switch (info.bitsPerSample) {
          case 8:
            value = (view.getUint8(sampleOffset) - 128) / 128;
            break;
          case 16:
            value = view.getInt16(sampleOffset, true) / 32768;
            break;
          case 24: {
            const raw = view.getUint8(sampleOffset)
              | (view.getUint8(sampleOffset + 1) << 8)
              | (view.getUint8(sampleOffset + 2) << 16);
            const signed = raw & 0x800000 ? raw | ~0xffffff : raw;
            value = signed / 8388608;
            break;
          }
          case 32:
            value = view.getInt32(sampleOffset, true) / 2147483648;
            break;
        }
      }
      if (!Number.isFinite(value)) value = 0;
      frameSum += Math.max(-1, Math.min(1, value));
    }
    pcm[frame] = frameSum / info.channels;
  }

  return {
    sampleRate: info.sampleRate,
    channels: info.channels,
    pcm,
    duration: frames / info.sampleRate,
  };
}
