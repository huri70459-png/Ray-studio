/**
 * 101 — Layered governance loader (Constitution + Module Spec)
 */

import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import type { ContextRequest } from '../types.js';

/** Known Phase A / B module id → slug (for targetModule resolution). */
const MODULE_SLUGS: Record<string, string> = {
  '001': '001-studio-shell',
  '009': '009-workspace-manager',
  '010': '010-project-manager',
  '011': '011-file-system-service',
  '012': '012-file-watcher',
  '013': '013-ipc-framework',
  '016': '016-sqlite-layer',
  '101': '101-context-engine',
};

export const DEFAULT_CONSTITUTION_PATH = 'Ray Studio Engineering Constitution.md';

export type ReadTextFn = (path: string) => Promise<string | null>;

export async function defaultReadText(path: string): Promise<string | null> {
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);
  try {
    return await readFile(abs, 'utf8');
  } catch {
    return null;
  }
}

export function resolveModuleSpecPath(targetModule: string): string {
  if (
    targetModule.endsWith('.md') ||
    targetModule.includes('/') ||
    targetModule.includes('\\')
  ) {
    return targetModule;
  }
  const idMatch = targetModule.match(/^(\d{3})/);
  if (idMatch) {
    const id = idMatch[1]!;
    const slug = MODULE_SLUGS[id];
    if (slug) return `prompts/modules/${slug}.md`;
  }
  if (targetModule.includes('-')) {
    return `prompts/modules/${targetModule}.md`;
  }
  return `prompts/modules/${targetModule}.md`;
}

export interface GovernanceLayers {
  constitution?: string;
  moduleSpec?: string;
  constitutionPath?: string;
  moduleSpecPath?: string;
}

export async function loadGovernanceLayers(
  request: ContextRequest,
  readText: ReadTextFn = defaultReadText,
): Promise<GovernanceLayers> {
  const result: GovernanceLayers = {};

  const constitutionPath = request.constitutionPath ?? DEFAULT_CONSTITUTION_PATH;
  const constitution = await readText(constitutionPath);
  if (constitution !== null && constitution.length > 0) {
    result.constitution = constitution;
    result.constitutionPath = constitutionPath;
  }

  if (request.moduleSpecPath) {
    const body = await readText(request.moduleSpecPath);
    if (body !== null && body.length > 0) {
      result.moduleSpec = body;
      result.moduleSpecPath = request.moduleSpecPath;
    }
  } else if (request.targetModule) {
    const path = resolveModuleSpecPath(request.targetModule);
    const body = await readText(path);
    if (body !== null && body.length > 0) {
      result.moduleSpec = body;
      result.moduleSpecPath = path;
    }
  }

  return result;
}
