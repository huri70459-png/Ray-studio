/**
 * Doc comment extraction from source text (no code execution).
 */

/**
 * Capture JSDoc / block comment immediately preceding a definition start.
 * Allows export/default/async/etc. keywords between the comment and `offset`
 * (typical: `/** ... *\/` then `export function`).
 */
export function extractLeadingJsDoc(source: string, offset: number): string | undefined {
  if (offset <= 0 || offset > source.length) return undefined;

  // Walk back: skip identifiers/keywords and whitespace until block comment end
  let i = offset - 1;

  // Skip reverse over "export default async" style prefixes
  while (i >= 0) {
    while (i >= 0 && /\s/.test(source[i]!)) i -= 1;
    if (i < 0) return undefined;

    // Block comment end */
    if (source[i] === '/' && i >= 1 && source[i - 1] === '*') {
      const end = i + 1;
      const start = source.lastIndexOf('/*', i - 1);
      if (start < 0) return undefined;
      const between = source.slice(start, end);
      if (!between.startsWith('/*')) return undefined;
      // Between comment and def: only whitespace + JS/TS modifiers/keywords
      const gap = source.slice(end, offset);
      if (!isModifierGap(gap)) return undefined;
      return normalizeDocComment(between);
    }

    // Walk back one token (word or punctuation that's part of modifiers)
    if (/[A-Za-z_$]/.test(source[i]!)) {
      while (i >= 0 && /[A-Za-z0-9_$]/.test(source[i]!)) i -= 1;
      continue;
    }
    // stop on non-modifier punctuation (e.g. `;` from previous stmt without comment)
    if (source[i] === ';' || source[i] === '}' || source[i] === '{') {
      return undefined;
    }
    i -= 1;
  }
  return undefined;
}

function isModifierGap(gap: string): boolean {
  // strip allowed keywords and whitespace
  const stripped = gap
    .replace(/\b(export|default|async|declare|abstract|public|private|protected|static|readonly|override)\b/g, ' ')
    .replace(/\s+/g, '');
  return stripped.length === 0;
}

/**
 * Python docstring: first expression-statement string in the body
 * after the suite-opening `:` (not type-annotation colons).
 */
export function extractPythonDocstring(
  source: string,
  defStart: number,
  defEnd: number,
): string | undefined {
  if (defStart < 0 || defEnd <= defStart) return undefined;
  const sliceEnd = Math.min(defEnd, source.length);
  const region = source.slice(defStart, sliceEnd);

  // Suite colon is the last `:` on the header line (before first newline of body).
  // Avoid matching `name: str` by taking lastIndexOf on the first physical line.
  const firstNl = region.indexOf('\n');
  const header = firstNl >= 0 ? region.slice(0, firstNl) : region;
  const suiteColon = header.lastIndexOf(':');
  if (suiteColon < 0) return undefined;

  const afterColon =
    firstNl >= 0 ? region.slice(firstNl) : region.slice(suiteColon + 1);

  const triple = afterColon.match(/^[ \t]*\r?\n[ \t]*("""|''')([\s\S]*?)\1/);
  if (triple && triple[2] !== undefined) {
    return trimDocText(triple[2]);
  }

  // header ended with : and docstring on same line (rare)
  const sameLine = region
    .slice(suiteColon + 1)
    .match(/^[ \t]*("""|''')([\s\S]*?)\1/);
  if (sameLine && sameLine[2] !== undefined) {
    return trimDocText(sameLine[2]);
  }

  const single = afterColon.match(
    /^[ \t]*\r?\n[ \t]*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/,
  );
  if (single && single[1] !== undefined) {
    const q = single[1];
    return trimDocText(q.slice(1, -1));
  }

  return undefined;
}

function normalizeDocComment(block: string): string {
  const inner = block.replace(/^\/\*\*?/, '').replace(/\*\/$/, '');
  const lines = inner.split(/\r?\n/).map((line) => {
    return line.replace(/^\s*\*\s?/, '').trimEnd();
  });
  return trimDocText(lines.join('\n'));
}

function trimDocText(text: string): string {
  return text.replace(/^\s+/, '').replace(/\s+$/, '');
}
