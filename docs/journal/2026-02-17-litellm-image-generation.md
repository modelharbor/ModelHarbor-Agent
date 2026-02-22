# LiteLLM Image Generation Provider + Aspect Ratio Auto-Detection

**Date:** 2026-02-17

## Overview

Added LiteLLM as a provider for image generation, supporting only the `google/gemini-2.5-flash-image` model (for budget control). Includes an auto-detect aspect ratio system that analyzes the user's prompt in both Thai and English.

## Problem / Requirements

- Need an additional LiteLLM provider alongside the existing OpenRouter provider, enabling image generation through a LiteLLM proxy.
- Google's `gemini-2.5-flash-image` model cannot infer aspect ratio on its own (unlike `gemini-3-pro`), so the system must detect the intended aspect ratio from the prompt and pass it via `image_config.aspect_ratio`.

## Architecture

```
User Prompt → detectAspectRatio() → aspect ratio (default 1:1)
                                          ↓
GenerateImageTool → provider routing → generateImageWithLiteLLM()
                                          ↓
                                    LiteLLM /chat/completions
                                    + modalities: ["image", "text"]
                                    + image_config.aspect_ratio
```

## Changes

### New Files (2)

| File                                                               | Description                                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `src/api/providers/utils/aspect-ratio-detection.ts`                | `detectAspectRatio()` function supporting 10 ratios with Thai/English keyword matching |
| `src/api/providers/utils/__tests__/aspect-ratio-detection.spec.ts` | 41 tests covering all detection scenarios                                              |

### Modified Files (14)

#### Types (3)

| File                                          | Change                                                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| `packages/types/src/image-generation.ts`      | Added `"litellm"` provider and model definition            |
| `packages/types/src/global-settings.ts`       | Added `liteLlmImageApiKey`, `liteLlmImageBaseUrl` settings |
| `packages/types/src/vscode-extension-host.ts` | Added LiteLLM fields to `ExtensionState`                   |

#### Backend (2)

| File                                          | Change                                      |
| --------------------------------------------- | ------------------------------------------- |
| `src/api/providers/utils/image-generation.ts` | Added `generateImageWithLiteLLM()` function |
| `src/core/tools/GenerateImageTool.ts`         | Added LiteLLM provider routing              |

#### State Management (2)

| File                                               | Change                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| `src/core/webview/ClineProvider.ts`                | Added LiteLLM image state fields                |
| `webview-ui/src/context/ExtensionStateContext.tsx` | Added default values for LiteLLM image settings |

#### UI (3)

| File                                                             | Change                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `webview-ui/src/components/settings/SettingsView.tsx`            | Added LiteLLM image props                                 |
| `webview-ui/src/components/settings/ExperimentalSettings.tsx`    | Added pass-through props                                  |
| `webview-ui/src/components/settings/ImageGenerationSettings.tsx` | Added LiteLLM option with Base URL + API Key input fields |

#### i18n (4)

| File                                           | Change                               |
| ---------------------------------------------- | ------------------------------------ |
| `webview-ui/src/i18n/locales/en/settings.json` | Added 5 translation keys             |
| `webview-ui/src/i18n/locales/th/settings.json` | Added Thai translations              |
| `src/i18n/locales/en/tools.json`               | Added error message key              |
| `src/i18n/locales/th/tools.json`               | Added Thai error message translation |

## Tests

| Test File                        | Count | Description                                                                               |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `aspect-ratio-detection.spec.ts` | 41    | All aspect ratio detection scenarios (Thai + English keywords, explicit ratios, defaults) |
| `image-generation.spec.ts`       | +14   | New tests for `generateImageWithLiteLLM`                                                  |
| `generateImageTool.test.ts`      | +5    | New tests for LiteLLM provider routing                                                    |

**Total: 84 tests, all passing.**

## Supported Aspect Ratios

| Ratio  | Use Case                    |
| ------ | --------------------------- |
| `1:1`  | Default / square            |
| `3:2`  | Standard photo landscape    |
| `2:3`  | Standard photo portrait     |
| `3:4`  | Portrait                    |
| `4:3`  | Classic TV / presentation   |
| `4:5`  | Instagram portrait          |
| `5:4`  | Large format print          |
| `9:16` | Vertical / mobile / stories |
| `16:9` | Widescreen / wallpaper      |
| `21:9` | Ultrawide / panoramic       |

## Aspect Ratio Detection Examples

| Prompt                           | Detected Ratio | Reason                                     |
| -------------------------------- | -------------- | ------------------------------------------ |
| `"สร้างรูปฮัสกี้"`               | `1:1`          | No orientation keyword → default           |
| `"สร้างรูปแนวตั้ง แมว"`          | `9:16`         | Thai keyword "แนวตั้ง" (vertical/portrait) |
| `"create a landscape wallpaper"` | `16:9`         | English keyword "landscape" + "wallpaper"  |
| `"สร้างรูปสัดส่วน 4:3"`          | `4:3`          | Explicit ratio in prompt                   |
| `"panoramic mountain view"`      | `21:9`         | English keyword "panoramic"                |

## Important Notes

- **Separate settings:** LiteLLM image settings (`apiKey`, `baseUrl`) are separate from chat LiteLLM settings to maintain scope separation.
- **Default base URL:** `http://localhost:4000`
- **Model restriction:** Only `gemini-2.5-flash-image` is supported (budget control).
- **No breaking changes:** OpenRouter image generation continues to work unchanged.
