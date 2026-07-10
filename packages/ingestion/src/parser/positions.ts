import type { SourcePosition } from './types.js';

/** Convert UTF-16 code unit index (JS string index) to 0-based row/col. */
export function indexToPosition(source: string, index: number): SourcePosition {
  const clamped = Math.max(0, Math.min(index, source.length));
  let row = 0;
  let column = 0;
  for (let i = 0; i < clamped; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      row += 1;
      column = 0;
    } else {
      column += 1;
    }
  }
  return { row, column };
}

export function utf8ByteLength(source: string): number {
  return Buffer.byteLength(source, 'utf8');
}
