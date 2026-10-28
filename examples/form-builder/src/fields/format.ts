import type { FileMeta } from '../domain/field';

export function formatNumber(value: number, decimals: number, prefix = '', suffix = ''): string {
  const body = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${body}${suffix}`;
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** True when `value` has at most `decimals` fractional digits (float-tolerant). */
export function hasAtMostDecimals(value: number, decimals: number): boolean {
  const f = 10 ** decimals;
  return Math.abs(value * f - Math.round(value * f)) < 1e-7;
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatFile(file: FileMeta): string {
  return `${file.name} (${formatFileSize(file.size)}${file.type ? `, ${file.type}` : ''})`;
}
