#!/usr/bin/env node
/**
 * AlgoAI Theme Standards & Governance Checker
 *
 * Verifies that all UI components and pages adhere to global theme standards
 * across all 3 supported themes (Dark, White, Solarized Light).
 *
 * Usage:
 *   node scripts/check-theme-standards.mjs          # Checks modified/staged files + theme parity
 *   node scripts/check-theme-standards.mjs --staged # Checks only staged files (for git pre-commit hook)
 *   node scripts/check-theme-standards.mjs --all    # Scans entire codebase
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const GLOBALS_CSS_PATH = path.join(PROJECT_ROOT, 'app', 'globals.css');

const args = process.argv.slice(2);
const isStagedOnly = args.includes('--staged');
const isAll = args.includes('--all') || args.includes('--audit');

console.log('🎨 AlgoAI Theme Standards & Governance Checker');
console.log('--------------------------------------------------');

let totalErrors = 0;
let totalWarnings = 0;

// ================================================================
// Step 1: Check Theme Token Parity in app/globals.css
// ================================================================
function checkThemeTokens() {
  if (!fs.existsSync(GLOBALS_CSS_PATH)) {
    console.error('❌ Missing app/globals.css file!');
    totalErrors++;
    return;
  }

  const css = fs.readFileSync(GLOBALS_CSS_PATH, 'utf8');

  function extractVars(blockRegex) {
    const match = css.match(blockRegex);
    if (!match) return new Set();
    const vars = new Set();
    const re = /(--[a-zA-Z0-9-]+)\s*:/g;
    let m;
    while ((m = re.exec(match[1])) !== null) {
      vars.add(m[1]);
    }
    return vars;
  }

  const darkVars = extractVars(/:root,\s*\[data-theme="dark"\]\s*\{([^}]+)\}/);
  const lightVars = extractVars(/\[data-theme="light"\]\s*\{([^}]+)\}/);
  const solarizedVars = extractVars(/\[data-theme="solarized-light"\]\s*\{([^}]+)\}/);

  if (darkVars.size === 0 || lightVars.size === 0 || solarizedVars.size === 0) {
    console.error('❌ Failed to parse one or more theme variable blocks in app/globals.css');
    totalErrors++;
    return;
  }

  const missingInLight = [...darkVars].filter((v) => !lightVars.has(v));
  const missingInSolarized = [...darkVars].filter((v) => !solarizedVars.has(v));

  if (missingInLight.length > 0) {
    console.error(`❌ [Light Theme] Missing tokens defined in Dark theme: ${missingInLight.join(', ')}`);
    totalErrors++;
  }

  if (missingInSolarized.length > 0) {
    console.error(`❌ [Solarized Light Theme] Missing tokens defined in Dark theme: ${missingInSolarized.join(', ')}`);
    totalErrors++;
  }

  if (missingInLight.length === 0 && missingInSolarized.length === 0) {
    console.log(`✅ Theme Token Parity: 100% synchronized across Dark (${darkVars.size}), Light (${lightVars.size}), and Solarized Light (${solarizedVars.size})`);
  }

  // Check required semantic utility classes
  const requiredClasses = [
    '.text-profit',
    '.text-loss',
    '.border-profit',
    '.border-loss',
    '.bg-profit-subtle',
    '.bg-loss-subtle',
    '.badge-profit',
    '.badge-loss',
    '.btn-action-icon',
    '.btn-action-profit',
    '.btn-action-loss',
    '.btn-action-connect',
    '.btn-action-history',
    '.btn-action-profile',
    '.btn-action-neutral',
  ];

  const missingClasses = requiredClasses.filter((c) => !css.includes(c));
  if (missingClasses.length > 0) {
    console.error(`❌ Missing required global classes in app/globals.css: ${missingClasses.join(', ')}`);
    totalErrors++;
  } else {
    console.log(`✅ Global Utility Classes: All ${requiredClasses.length} semantic classes defined in app/globals.css`);
  }
}

// ================================================================
// Step 2: Scan Files for Theme Rule Violations
// ================================================================
const VIOLATION_RULES = [
  {
    id: 'NO_ARBITRARY_FINANCIAL_EMERALD',
    name: 'Arbitrary Emerald Color',
    regex: /\btext-emerald-(?:300|400|500|600|700)\b/g,
    message: 'Do not use arbitrary Tailwind emerald colors for financial profit values. Use semantic class "text-profit" instead.',
    severity: 'error',
  },
  {
    id: 'NO_ARBITRARY_FINANCIAL_ROSE',
    name: 'Arbitrary Rose Color',
    regex: /\btext-rose-(?:300|400|500|600|700)\b/g,
    message: 'Do not use arbitrary Tailwind rose colors for financial loss values. Use semantic class "text-loss" instead.',
    severity: 'error',
  },
  {
    id: 'NO_HARDCODED_ACTION_BUTTON_BG',
    name: 'Hardcoded Action Button Color',
    regex: /<button[^>]*class(?:Name)?=["'][^"']*\b(bg-green-600|bg-purple-600|bg-amber-600|bg-red-600)\b/g,
    message: 'Do not use hardcoded solid button backgrounds. Use global action classes (.btn-action-icon, .btn-action-profit, .btn-action-loss, etc.).',
    severity: 'error',
  },
  {
    id: 'NO_HARDCODED_HEX_STYLES',
    name: 'Hardcoded Inline Hex Color',
    regex: /style=\{\{[^}]*(?:color|backgroundColor)\s*:\s*['"]#(?:[0-9a-fA-F]{3,8})['"]/g,
    message: 'Do not use hardcoded hex colors in JSX inline styles. Use global theme tokens or CSS variables.',
    severity: 'warning',
  },
];

function getTargetFiles() {
  if (isStagedOnly) {
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
      return output
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0 && (f.endsWith('.tsx') || f.endsWith('.jsx')) && (f.startsWith('app/') || f.startsWith('components/')));
    } catch {
      return [];
    }
  }

  if (!isAll) {
    try {
      const output = execSync('git diff HEAD --name-only --diff-filter=ACM', { encoding: 'utf8' });
      const changed = output
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0 && (f.endsWith('.tsx') || f.endsWith('.jsx')) && (f.startsWith('app/') || f.startsWith('components/')));

      if (changed.length > 0) {
        return changed;
      }
    } catch {
      // Fall through to all files
    }
  }

  // Scan all app/ and components/ files
  function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.next' && file !== 'out' && file !== '.git') {
          results = results.concat(walk(full));
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        results.push(path.relative(PROJECT_ROOT, full));
      }
    }
    return results;
  }

  return [...walk(path.join(PROJECT_ROOT, 'app')), ...walk(path.join(PROJECT_ROOT, 'components'))];
}

function scanFiles() {
  const targetFiles = getTargetFiles();

  if (targetFiles.length === 0) {
    console.log('ℹ️  No modified TSX/JSX files to inspect.');
    return;
  }

  console.log(`🔍 Inspecting ${targetFiles.length} file(s) for theme compliance...`);

  let fileViolationsCount = 0;

  for (const relativePath of targetFiles) {
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    let fileHasError = false;

    lines.forEach((lineText, lineIdx) => {
      for (const rule of VIOLATION_RULES) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(lineText)) !== null) {
          const lineNum = lineIdx + 1;
          const icon = rule.severity === 'error' ? '❌' : '⚠️ ';

          console.log(`\n${icon} [${rule.name}] in ${relativePath}:${lineNum}`);
          console.log(`   Snippet:  "${match[0]}"`);
          console.log(`   Guidance: ${rule.message}`);

          if (rule.severity === 'error') {
            totalErrors++;
            fileHasError = true;
          } else {
            totalWarnings++;
          }
        }
      }
    });

    if (fileHasError) fileViolationsCount++;
  }

  if (fileViolationsCount === 0) {
    console.log(`✅ All inspected files comply with theme governance!`);
  }
}

// Execute checks
checkThemeTokens();
scanFiles();

console.log('\n--------------------------------------------------');
if (totalErrors > 0) {
  console.error(`❌ Theme Standards Check FAILED with ${totalErrors} error(s) and ${totalWarnings} warning(s).`);
  console.error('👉 Refer to AGENTS.md Section 1 for Theme Governance guidelines.\n');
  process.exit(1);
} else {
  console.log(`✨ Theme Standards Check PASSED with 0 errors (${totalWarnings} warnings).\n`);
  process.exit(0);
}
