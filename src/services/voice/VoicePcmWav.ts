/**
 * PCM Int16 → WAV buffer for STT providers that expect a container.
 */

export function pcmInt16ToWav(
  samples: Int16Array | Buffer,
  options: { sampleRate: number; channels?: number } = { sampleRate: 48000 },
): Buffer {
  const sampleRate = Math.max(8000, Number(options.sampleRate || 48000));
  const channels = Math.max(1, Math.min(2, Number(options.channels || 1)));
  const pcm =
    samples instanceof Int16Array
      ? Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
      : Buffer.isBuffer(samples)
        ? samples
        : Buffer.from(samples as ArrayBuffer);

  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/** RMS 0..1 from Int16 PCM */
export function pcmRms(samples: Int16Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}
