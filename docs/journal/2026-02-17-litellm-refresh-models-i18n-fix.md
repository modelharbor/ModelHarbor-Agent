# Add Missing Translation Keys for LiteLLM Embedding Refresh Models

**Date:** 2026-02-17

## Problem

`webview-ui/src/components/chat/CodeIndexPopover.tsx` references two translation keys that were missing from the locale files:

1. `settings:codeIndex.litellmRefreshModels` — default value: `"Refresh Models"`
2. `settings:codeIndex.litellmRefreshModelsHint` — default value: `"Click Refresh Models to load available models"`

This caused the UI to fall back to hardcoded default strings instead of using proper i18n translations.

## Fix

Added the missing keys to both EN and TH locale files:

### `webview-ui/src/i18n/locales/en/settings.json`

```json
"litellmRefreshModels": "Refresh Models",
"litellmRefreshModelsHint": "Click Refresh Models to load available models"
```

### `webview-ui/src/i18n/locales/th/settings.json`

```json
"litellmRefreshModels": "รีเฟรชโมเดล",
"litellmRefreshModelsHint": "คลิก รีเฟรชโมเดล เพื่อโหลดโมเดลที่ใช้ได้"
```

Keys were placed adjacent to existing LiteLLM-related keys (`litellmFetchModels`, `litellmFetchingModels`, `litellmNoModelsFound`) in the `codeIndex` section.

## Files Changed

- `webview-ui/src/i18n/locales/en/settings.json`
- `webview-ui/src/i18n/locales/th/settings.json`
