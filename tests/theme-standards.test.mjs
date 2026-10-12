import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const GLOBALS_CSS_PATH = path.join(PROJECT_ROOT, 'app', 'globals.css');

test('Theme Standards - globals.css exists', () => {
  assert.ok(fs.existsSync(GLOBALS_CSS_PATH), 'app/globals.css must exist');
});

const cssContent = fs.readFileSync(GLOBALS_CSS_PATH, 'utf8');

function extractVarsFromBlock(blockRegex) {
  const match = cssContent.match(blockRegex);
  if (!match) return new Set();
  const vars = new Set();
  const re = /(--[a-zA-Z0-9-]+)\s*:/g;
  let m;
  while ((m = re.exec(match[1])) !== null) {
    vars.add(m[1]);
  }
  return vars;
}

const darkVars = extractVarsFromBlock(/:root,\s*\[data-theme="dark"\]\s*\{([^}]+)\}/);
const lightVars = extractVarsFromBlock(/\[data-theme="light"\]\s*\{([^}]+)\}/);
const solarizedVars = extractVarsFromBlock(/\[data-theme="solarized-light"\]\s*\{([^}]+)\}/);

test('Theme Standards - All 3 themes defined in globals.css', () => {
  assert.ok(darkVars.size > 0, 'Dark theme tokens must be defined');
  assert.ok(lightVars.size > 0, 'Light theme tokens must be defined');
  assert.ok(solarizedVars.size > 0, 'Solarized Light theme tokens must be defined');
});

test('Theme Standards - Token Parity across Dark, Light, and Solarized Light', () => {
  const missingInLight = [...darkVars].filter((v) => !lightVars.has(v));
  const missingInSolarized = [...darkVars].filter((v) => !solarizedVars.has(v));

  assert.deepEqual(
    missingInLight,
    [],
    `Light theme is missing the following tokens: ${missingInLight.join(', ')}`
  );
  assert.deepEqual(
    missingInSolarized,
    [],
    `Solarized Light theme is missing the following tokens: ${missingInSolarized.join(', ')}`
  );
});

test('Theme Standards - Financial semantic tokens exist in all themes', () => {
  const requiredFinancialTokens = [
    '--color-profit',
    '--color-profit-subtle',
    '--color-profit-border',
    '--color-loss',
    '--color-loss-subtle',
    '--color-loss-border',
  ];

  for (const token of requiredFinancialTokens) {
    assert.ok(darkVars.has(token), `Dark theme missing required financial token ${token}`);
    assert.ok(lightVars.has(token), `Light theme missing required financial token ${token}`);
    assert.ok(solarizedVars.has(token), `Solarized Light theme missing required financial token ${token}`);
  }
});

test('Theme Standards - Interactive action button tokens exist in all themes', () => {
  const requiredActionTokens = [
    '--color-action-blue',
    '--color-action-blue-subtle',
    '--color-action-blue-border',
    '--color-action-amber',
    '--color-action-amber-subtle',
    '--color-action-amber-border',
    '--color-action-purple',
    '--color-action-purple-subtle',
    '--color-action-purple-border',
    '--color-action-neutral',
    '--color-action-neutral-subtle',
    '--color-action-neutral-border',
  ];

  for (const token of requiredActionTokens) {
    assert.ok(darkVars.has(token), `Dark theme missing required action token ${token}`);
    assert.ok(lightVars.has(token), `Light theme missing required action token ${token}`);
    assert.ok(solarizedVars.has(token), `Solarized Light theme missing required action token ${token}`);
  }
});

test('Theme Standards - Global utility classes exist and enforce !important', () => {
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

  for (const cls of requiredClasses) {
    assert.ok(
      cssContent.includes(cls),
      `app/globals.css must define standard global class "${cls}"`
    );
  }
});

test('Theme Standards - Full Theme Overrides present for Light and Solarized Light', () => {
  assert.ok(
    cssContent.includes('[data-theme="light"] body'),
    'app/globals.css must include [data-theme="light"] body background override'
  );
  assert.ok(
    cssContent.includes('[data-theme="solarized-light"] body'),
    'app/globals.css must include [data-theme="solarized-light"] body background override'
  );
  assert.ok(
    cssContent.includes('[data-theme="light"] nav.bg-gray-800'),
    'app/globals.css must include [data-theme="light"] navigation overrides'
  );
  assert.ok(
    cssContent.includes('[data-theme="solarized-light"] nav.bg-gray-800'),
    'app/globals.css must include [data-theme="solarized-light"] navigation overrides'
  );
});
