# AlgoAI Frontend — System Governance & Agent Directives

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & DEVELOPERS:**
> This document defines the non-negotiable architectural rules, UI design standards, and governance policies for the AlgoAI frontend (`algoai-frontend`).
> **Every AI agent (Claude, Cursor, Copilot, Gemini, Antigravity, etc.) and developer MUST comply with these rules. Do not bypass or alter these rules without explicit user approval.**

---

## 1. UI Design & Global Theme Governance

1. **NO Page-Specific Color Schemes**:
   - Never invent page-specific or ad-hoc color schemes, hardcoded text colors, or disconnected backgrounds.
   - All components and pages MUST adhere to the global design system tokens defined in `app/globals.css`.
   - The application supports multiple themes (**Dark**, **White**, and **Solarized Light**). Hardcoded dark/light colors break contrast on other themes.

2. **Standard Financial Semantic Classes**:
   - **Profit / Positive Values**: ALWAYS use `text-profit` (green token). Do not use arbitrary Tailwind greens (`text-emerald-500`, `text-green-300`, etc.).
   - **Loss / Negative Values**: ALWAYS use `text-loss` (red token). Do not use arbitrary Tailwind reds (`text-rose-500`, etc.).
   - **Backgrounds**: Use standard theme background classes (`bg-gray-800`, `bg-gray-900`, card container tokens).

---

## 2. Broker Management & Auditability

1. **Internal Plumbing Hidden from Users**:
   - Refresh tokens are internal OAuth workflow details. NEVER display refresh token presence, character length, or strings in broker cards or public views.
   - Display session status cleanly (e.g. `Access Token: ✓ Present / ✗ Missing`).

2. **Broker History & Auditability**:
   - Use the **History** button (`handleViewHistory`) to show the user the complete token and connection audit trail.
   - Do NOT resurrect obsolete "Health" buttons or low-level diagnostics modals.

---

## 3. Code Quality & Pre-Commit Verification

1. **Type Safety**:
   - All API models and responses must have corresponding TypeScript interfaces in `types/index.ts` or `lib/api/`.
   - Never use `any` when a known type exists.

2. **Pre-Commit Verification**:
   - Before completing any task or committing changes, all agents and developers MUST execute and pass:
     1. `npm run check:theme` — Verifies 100% theme token parity across Dark, White, and Solarized Light and catches forbidden ad-hoc colors.
     2. `npm test` — Automated unit test suite verifying global theme standards.
     3. `npx tsc --noEmit` — Guarantees zero TypeScript compilation errors.
     4. `npm run build` — Validates successful Next.js production bundling across all routes.
   - Any failure in the above pipeline constitutes a blocked task that must be resolved prior to user handoff.
