import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type ExtractedFrame = {
  frameIndex: number;
  timestamp: number;
  dataUrl: string;
};

async function ffmpegBinary() {
  const { default: binary } = (await import('ffmpeg-static')) as { default: string | null };
  if (!binary) {
    throw new Error('ffmpeg-static is not available in this environment');
  }

  return binary;
}

async function runFfmpeg(args: string[], inputBuffer?: Buffer) {
  const binary = await ffmpegBinary();
  return await new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code ?? 'unknown'}`));
      }
    });

    if (inputBuffer) {
      child.stdin.write(inputBuffer);
    }
    child.stdin.end();
  });
}

async function getVideoDurationSeconds(inputPath: string) {
  const binary = await ffmpegBinary();
  const stderr = await new Promise<string>((resolve, reject) => {
    const child = spawn(binary, ['-i', inputPath, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let output = '';

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => resolve(output));
  });

  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const hours = Number(match[1]) || 0;
  const minutes = Number(match[2]) || 0;
  const seconds = Number(match[3]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function uniqueTimestamps(duration: number | null) {
  if (!duration || duration <= 0) {
    return [0.5, 2, 4];
  }

  const points = [0.12, 0.5, 0.88].map((ratio) => Math.max(0.25, Math.min(duration - 0.25, duration * ratio)));
  return Array.from(new Set(points.map((value) => Number(value.toFixed(2))))).sort((a, b) => a - b);
}

async function extractFrameAtTimestamp(inputPath: string, timestamp: number, outputPath: string) {
  await runFfmpeg([
    '-y',
    '-ss',
    String(timestamp),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outputPath,
  ]);
}

export async function extractVideoFrames(input: { videoUrl: string; label: string }) {
  const response = await fetch(input.videoUrl);
  if (!response.ok) {
    throw new Error(`Could not download video for frame extraction: ${response.status} ${response.statusText}`);
  }

  const videoBuffer = Buffer.from(await response.arrayBuffer());
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'yearbook-video-'));
  const inputPath = path.join(tempDir, 'input-video');
  await writeFile(inputPath, videoBuffer);

  try {
    const duration = await getVideoDurationSeconds(inputPath);
    const timestamps = uniqueTimestamps(duration);

    const frames: ExtractedFrame[] = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestamp = timestamps[index];
      const outputPath = path.join(tempDir, `frame-${index}.jpg`);

      try {
        await extractFrameAtTimestamp(inputPath, timestamp, outputPath);
        const frameBuffer = await readFile(outputPath);
        frames.push({
          frameIndex: index,
          timestamp,
          dataUrl: `data:image/jpeg;base64,${frameBuffer.toString('base64')}`,
        });
      } catch {
        continue;
      }
    }

    return {
      label: input.label,
      duration,
      frames,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
