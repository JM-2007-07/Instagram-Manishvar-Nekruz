import { spawn } from 'node:child_process';
import { basename, dirname, join } from 'node:path';

// Запуск ffmpeg/ffprobe с фиксированными аргументами, без shell и без пользовательских строк (SECURITY.md п. 7).
// Путь к программе — FFMPEG_PATH; ffprobe лежит рядом с ffmpeg.
export function ffprobePath(ffmpegPath: string): string {
  return join(dirname(ffmpegPath), basename(ffmpegPath).replace(/ffmpeg/i, 'ffprobe'));
}

export class ToolMissingError extends Error {}

// Запускает программу и ждёт завершения (с ограничением времени). Возвращает stdout.
export function run(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs, windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-2000);
    });
    child.on('error', (e: NodeJS.ErrnoException) => {
      reject(e.code === 'ENOENT' ? new ToolMissingError(`${bin} not found`) : e);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${basename(bin)} exited with ${String(code)}: ${err.trim().split('\n').pop() ?? ''}`));
    });
  });
}

export interface ProbeResult {
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

// Читает длительность, размеры и наличие дорожек.
export async function probe(ffmpegPath: string, file: string): Promise<ProbeResult> {
  const out = await run(
    ffprobePath(ffmpegPath),
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    30_000,
  );
  const json = JSON.parse(out) as {
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[];
    format?: { duration?: string };
  };
  const streams = json.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(json.format?.duration ?? video?.duration ?? audio?.duration);
  return {
    hasVideo: video !== undefined,
    hasAudio: audio !== undefined,
    width: video?.width ?? null,
    height: video?.height ?? null,
    durationSec: Number.isFinite(duration) ? duration : null,
  };
}

const TRANSCODE_TIMEOUT_MS = 15 * 60_000;

// Видео -> H.264/AAC MP4 не шире 1080 px, без метаданных исходника (в т.ч. GPS).
export function transcodeVideo(ffmpegPath: string, input: string, output: string): Promise<string> {
  return run(
    ffmpegPath,
    [
      '-y', '-i', input, '-map_metadata', '-1',
      '-vf', "scale='min(1080,iw)':-2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output,
    ],
    TRANSCODE_TIMEOUT_MS,
  );
}

// Голосовое -> AAC в M4A.
export function transcodeAudio(ffmpegPath: string, input: string, output: string): Promise<string> {
  return run(
    ffmpegPath,
    ['-y', '-i', input, '-map_metadata', '-1', '-vn', '-c:a', 'aac', '-b:a', '64k', '-f', 'ipod', output],
    TRANSCODE_TIMEOUT_MS,
  );
}

// Первый кадр видео -> JPEG шириной до 640 px.
export function extractPoster(ffmpegPath: string, input: string, output: string): Promise<string> {
  return run(
    ffmpegPath,
    ['-y', '-i', input, '-frames:v', '1', '-vf', "scale='min(640,iw)':-2", '-q:v', '4', output],
    60_000,
  );
}
