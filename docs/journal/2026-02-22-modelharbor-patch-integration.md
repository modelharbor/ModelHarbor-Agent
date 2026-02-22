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

| Test File                                                                     | Notes  |
| ----------------------------------------------------------------------------- | ------ |
| `src/utils/__tests__/xml.spec.ts`                                             | Passed |
| `src/utils/__tests__/xml-matcher.spec.ts`                                     | Passed |
| `src/utils/__tests__/resolveToolProtocol.spec.ts`                             | Passed |
| `src/shared/__tests__/experiments.spec.ts`                                    | Passed |
| `src/core/task/__tests__/Task.super-yolo-stuck-timer.spec.ts`                 | Passed |
| `src/services/code-index/embedders/__tests__/modelharbor.spec.ts`             | Passed |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`                 | Passed |
| `src/services/code-index/__tests__/litellm-model-fetcher.spec.ts`             | Passed |
| `src/api/providers/__tests__/modelharbor.spec.ts`                             | Passed |
| `webview-ui/src/components/settings/providers/__tests__/ModelHarbor.spec.tsx` | Passed |
| `src/shared/__tests__/language.spec.ts`                                       | Passed |
| `src/shared/__tests__/api.spec.ts`                                            | Passed |
| `src/shared/__tests__/checkExistApiConfig.spec.ts`                            | Passed |
| `src/shared/__tests__/ProfileValidator.spec.ts`                               | Passed |
