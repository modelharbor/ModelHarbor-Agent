# ModelHarbor Patch Integration

**Date:** 2026-02-22  
**Author:** ModelHarbor Agent

## Summary

Integrated the ModelHarbor patch set via cherry-pick, resolved conflicts, and aligned the codebase with ModelHarbor-specific functionality and branding.

## Changes

- Cherry-picked the ModelHarbor patch set and resolved merge conflicts.
- Added XML toolcalling support and YOLO mode enhancements.
- Introduced ModelHarbor embedding/provider integrations.
- Reduced localization scope to `en` and `th`.
- Removed telemetry and cloud-related integrations.
- Updated branding assets and marketplace metadata to ModelHarbor.
- Verified TypeScript compile check passes with **0 errors**.

## Tests

| Test File                                           | Notes  |
| --------------------------------------------------- | ------ |
| `src/api/transform/__tests__/openai-format.spec.ts` | Passed |
| `src/services/mcp/__tests__/McpHub.spec.ts`         | Passed |
