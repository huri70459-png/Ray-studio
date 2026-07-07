#!/usr/bin/env node
/**
 * Ray Studio Constitution Governance Check (v1)
 *
 * Verifies that the Engineering Constitution is properly wired
 * and that agent instruction files reference it without drift.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONSTITUTION = path.join(ROOT, 'Ray Studio Engineering Constitution.md');

const REQUIRED_FILES = [
  'AGENTS.md',
  '.claude/CLAUDE.md',
  '.zed/rules.md',
  '.github/copilot-instructions.md',
  '.github/instructions/codebase-workflow.instructions.md',
  '.cursor/rules/constitution.mdc',
];

const MUST_CONTAIN = [
  'Ray Studio Engineering Constitution',
  'graph',
  'Constitution',
];

let failures = 0;

function fail(msg) {
  console.error('❌ ' + msg);
  failures++;
}

function ok(msg) {
  console.log('✅ ' + msg);
}

console.log('Ray Studio Constitution Governance Check\n');

// 1. Constitution exists and has key sections
if (!fs.existsSync(CONSTITUTION)) {
  fail('Constitution file missing at root');
} else {
  const content = fs.readFileSync(CONSTITUTION, 'utf8');
  const checks = [
    ['Version 1.0.0', /\*\*Version:\*\*\s*1\.0\.0/],
    ['Token Optimization section', /Token Optimization/],
    ['Definition of Done', /Definition of Done/],
    ['Layered Prompt System', /Layered Prompt System/],
    ['Governance', /Governance & Change Process/],
  ];
  for (const [label, re] of checks) {
    if (re.test(content)) ok(`Constitution contains: ${label}`);
    else fail(`Constitution missing: ${label}`);
  }
}

// 2. Wired agent files exist and contain required references
for (const rel of REQUIRED_FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fail(`Missing wired instruction file: ${rel}`);
    continue;
  }
  const txt = fs.readFileSync(full, 'utf8');
  let hasAll = true;
  for (const phrase of MUST_CONTAIN) {
    if (!txt.includes(phrase)) {
      hasAll = false;
      fail(`${rel} missing required phrase: "${phrase}"`);
    }
  }
  if (hasAll) ok(`${rel} references Constitution correctly`);
}

// 3. prompts/ structure exists
const promptsDir = path.join(ROOT, 'prompts');
if (!fs.existsSync(promptsDir)) {
  fail('prompts/ directory missing (required for Layer 2/3)');
} else {
  ok('prompts/ directory present');
}

// 4. project-status.json (machine-readable companion to 000-current-status.md)
const statusPath = path.join(ROOT, 'project-status.json');
if (!fs.existsSync(statusPath)) {
  fail('project-status.json missing at root (machine-readable status)');
} else {
  try {
    const s = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    const requiredKeys = ['schemaVersion', 'repositoryVersion', 'constitutionVersion', 'phase', 'nextModule', 'architectureFrozen', 'approvedModules'];
    let okKeys = true;
    for (const k of requiredKeys) {
      if (s[k] === undefined) {
        fail(`project-status.json missing key: ${k}`);
        okKeys = false;
      }
    }
    if (okKeys && Array.isArray(s.approvedModules)) ok('project-status.json present with schema + repo + constitution versions');
  } catch (e) {
    fail('project-status.json is not valid JSON');
  }
}

// 5. implementation-manifests/*.json contain automation fields (estimatedContextTokens etc.)
const manifestsDir = path.join(ROOT, 'implementation-manifests');
if (fs.existsSync(manifestsDir)) {
  const files = fs.readdirSync(manifestsDir).filter(f => f.endsWith('.json'));
  const autoKeys = ['estimatedContextTokens', 'priority', 'implementationOrder', 'validationRequired'];
  let allManifestsGood = true;
  let count = 0;
  for (const f of files) {
    const full = path.join(manifestsDir, f);
    try {
      const m = JSON.parse(fs.readFileSync(full, 'utf8'));
      count++;
      for (const k of autoKeys) {
        if (m[k] === undefined) {
          fail(`${f} missing automation field: ${k}`);
          allManifestsGood = false;
        }
      }
    } catch (e) {
      fail(`${f} invalid JSON`);
      allManifestsGood = false;
    }
  }
  if (allManifestsGood && count > 0) ok(`All ${count} manifests contain the 4 automation fields`);
} else {
  fail('implementation-manifests/ directory missing');
}

if (failures > 0) {
  console.error(`\n${failures} failure(s). Constitution governance check FAILED.`);
  process.exit(1);
} else {
  console.log('\nAll checks passed. Constitution is properly wired.');
  process.exit(0);
}