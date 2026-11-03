# Technical Architecture

Status: STUB. Phase 0 deliverable.

Established so far:
- One shared codebase for web, Telegram Mini App and Android.
- `src/core` (simulation) is isolated from rendering, UI, platform and persistence; ESLint enforces this.
- Platform integrations live in `src/platform` behind adapters.
