import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { optimize as svgoOptimize } from 'svgo';
import type { OutputFormat } from '@converter/shared';

export interface ConversionResult {
  buffer: Buffer;
  format: OutputFormat;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercent: number;
}

const RASTER_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.tiff', '.tif', '.bmp', '.webp', '.avif',
]);
const SVG_EXTENSIONS = new Set(['.svg']);

export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return RASTER_EXTENSIONS.has(ext) || SVG_EXTENSIONS.has(ext);
}

export function isSvg(filePath: string): boolean {
  return SVG_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function getOutputExtension(format: OutputFormat): string {
  if (format === 'svg') return '.svg';
  if (format === 'webp') return '.webp';
  if (format === 'avif') return '.avif';
  return '.webp';
}

async function encodeWebp(
  input: Buffer,
  quality: number,
  lossless = false,
): Promise<Buffer> {
  return sharp(input).webp({ quality, lossless }).toBuffer();
}

async function encodeAvif(input: Buffer, quality: number): Promise<Buffer> {
  return sharp(input).avif({ quality }).toBuffer();
}

export async function convertRaster(
  input: Buffer,
  targetFormat: Exclude<OutputFormat, 'svg' | 'auto'>,
  quality: number,
  lossless = false,
): Promise<Buffer> {
  if (targetFormat === 'webp') return encodeWebp(input, quality, lossless);
  if (targetFormat === 'avif') return encodeAvif(input, quality);
  return encodeWebp(input, quality, lossless);
}

export async function convertAuto(
  input: Buffer,
  quality: number,
): Promise<{ buffer: Buffer; format: 'webp' | 'avif' }> {
  const [webpBuf, avifBuf] = await Promise.all([
    encodeWebp(input, quality),
    encodeAvif(input, quality),
  ]);

  if (avifBuf.length < webpBuf.length) {
    return { buffer: avifBuf, format: 'avif' };
  }
  return { buffer: webpBuf, format: 'webp' };
}

export async function convertSvg(input: Buffer): Promise<Buffer> {
  const svgString = input.toString('utf8');
  const result = svgoOptimize(svgString, {
    multipass: true,
    plugins: ['preset-default'],
  });
  return Buffer.from(result.data, 'utf8');
}

export async function convertBuffer(
  input: Buffer,
  filePath: string,
  targetFormat: OutputFormat,
  quality: number,
  lossless = false,
): Promise<ConversionResult> {
  const inputSize = input.length;

  if (isSvg(filePath)) {
    const outputBuf = await convertSvg(input);
    const outputSize = outputBuf.length;
    const savedBytes = inputSize - outputSize;
    return {
      buffer: outputBuf,
      format: 'svg',
      inputSize,
      outputSize,
      savedBytes,
      savedPercent: inputSize > 0 ? Math.round((savedBytes / inputSize) * 100) : 0,
    };
  }

  let outputBuf: Buffer;
  let chosenFormat: 'webp' | 'avif';

  if (targetFormat === 'auto') {
    const result = await convertAuto(input, quality);
    outputBuf = result.buffer;
    chosenFormat = result.format;
  } else if (targetFormat === 'webp' || targetFormat === 'avif') {
    outputBuf = await convertRaster(input, targetFormat, quality, lossless);
    chosenFormat = targetFormat;
  } else {
    const result = await convertAuto(input, quality);
    outputBuf = result.buffer;
    chosenFormat = result.format;
  }

  const outputSize = outputBuf.length;
  const savedBytes = inputSize - outputSize;

  return {
    buffer: outputBuf,
    format: chosenFormat,
    inputSize,
    outputSize,
    savedBytes,
    savedPercent: inputSize > 0 ? Math.round((savedBytes / inputSize) * 100) : 0,
  };
}

export async function convertFile(
  filePath: string,
  targetFormat: OutputFormat,
  quality: number,
  lossless = false,
): Promise<ConversionResult> {
  const input = await fs.readFile(filePath);
  return convertBuffer(input, filePath, targetFormat, quality, lossless);
}
