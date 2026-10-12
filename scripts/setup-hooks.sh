#!/bin/sh
# Setup Git Pre-commit Hook for Theme Standards and Type Checks
HOOKS_DIR="$(git rev-parse --git-path hooks)"
PRE_COMMIT="$HOOKS_DIR/pre-commit"

echo "🔧 Installing AlgoAI Git Pre-commit hook..."

cat << 'EOF' > "$PRE_COMMIT"
#!/bin/sh
echo "🛡️  AlgoAI Pre-Commit Guardrails Running..."

# 1. Theme standards check on staged files
node scripts/check-theme-standards.mjs --staged
if [ $? -ne 0 ]; then
  echo "❌ Pre-commit check failed: Theme standards violation detected."
  echo "👉 Refer to AGENTS.md Section 1 to resolve."
  exit 1
fi

# 2. Theme unit test suite
node --test tests/theme-standards.test.mjs
if [ $? -ne 0 ]; then
  echo "❌ Pre-commit check failed: Theme unit tests failed."
  exit 1
fi

# 3. TypeScript validation
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ Pre-commit check failed: TypeScript compile errors detected."
  exit 1
fi

echo "✅ All Pre-Commit Guardrails Passed!"
exit 0
EOF

chmod +x "$PRE_COMMIT"
echo "✅ Pre-commit hook installed at $PRE_COMMIT"
