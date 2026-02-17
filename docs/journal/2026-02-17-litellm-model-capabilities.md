# LiteLLM Provider Model Capabilities Enhancement

**Date**: 2026-02-17

## Problem

LiteLLM provider ขาด model capabilities หลายตัวเมื่อเทียบกับ ModelHarbor provider ทำให้ model เดียวกันที่ fetch ผ่าน LiteLLM ไม่รองรับฟีเจอร์เช่น vision, computer use, reasoning ทั้งๆ ที่ model จริงๆ รองรับ

## Changes

### 1. New File: `src/api/providers/fetchers/model-capabilities.ts`

สร้าง shared utility function [`inferImageSupport()`](src/api/providers/fetchers/model-capabilities.ts) ที่ตรวจสอบชื่อ model เพื่อ infer vision support

- รองรับ patterns: `claude`, `gpt-4`/`gpt-5`, `gemini`, `vision`, `imagen`, `vl-`, `multimodal`, `gpt4v`, `omni`

### 2. Modified: `src/api/providers/fetchers/modelharbor.ts`

- Import [`inferImageSupport()`](src/api/providers/fetchers/model-capabilities.ts) จาก shared utility แทน local function

### 3. Modified: `src/api/providers/fetchers/litellm.ts`

| Capability                | Before           | After                                                                          |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `supportsNativeTools`     | Hardcoded `true` | `modelInfo.supports_function_calling !== false`                                |
| `defaultToolProtocol`     | ไม่มี            | `"native"` หรือ `"xml"` ตาม supports                                           |
| `supportsComputerUse`     | ไม่มี            | จาก `supports_computer_use`                                                    |
| `supportsReasoningBudget` | ไม่มี            | จาก `litellm_params.thinking.type`                                             |
| `requiredReasoningBudget` | ไม่มี            | `false`                                                                        |
| `supportsReasoningEffort` | ไม่มี            | จาก `supports_reasoning`                                                       |
| `supportsImages`          | ไม่มี fallback   | `supports_vision \|\| supports_embedding_image_input \|\| inferImageSupport()` |
| `contextWindow` default   | `200000`         | `40960`                                                                        |

### 4. Modified: `src/api/providers/fetchers/__tests__/litellm.spec.ts`

- อัปเดต tests ให้ตรงกับ capabilities ใหม่ — ผ่านทั้งหมด 25/25

## Result

LiteLLM provider ตอนนี้รายงาน model capabilities ได้ถูกต้องและสอดคล้องกับ ModelHarbor provider สำหรับ model เดียวกัน

## Phase 2: routerModels Response Matching Bug Fix

### ปัญหา

ถึงแม้ LiteLLM fetcher จะสร้าง `supportsImages: true` ถูกต้องใน cache file แล้ว แต่ UI ยังไม่แสดง vision support (ปุ่ม attach image ยัง disabled)

### Root Cause

- Frontend [`useRouterModels.ts`](webview-ui/src/hooks/useRouterModels.ts) (line 27-33) ตรวจสอบ `message.values.provider` ใน response
- Backend [`webviewMessageHandler.ts`](src/core/webview/webviewMessageHandler.ts) (line ~1012) ส่ง response โดยไม่มี `values.provider`
- เงื่อนไข `"litellm" !== undefined` → return early → ไม่ได้ process response
- หลัง 10 วินาที timeout → model info เป็น undefined

### Failure Chain

1. [`useSelectedModel`](webview-ui/src/hooks/useSelectedModel.ts) เรียก [`useRouterModels`](webview-ui/src/hooks/useRouterModels.ts) พร้อม `provider: "litellm"`
2. Backend ประมวลผลสำเร็จ แต่ response message ไม่มี `values.provider`
3. Frontend handler เจอ provider mismatch → return early ไม่ได้ update state
4. หลัง 10 วิ timeout → `routerModels.data` เป็น `undefined`
5. `isReady = false` → return `{ id: defaultModelId, info: undefined }`
6. [`ChatView`](webview-ui/src/components/chat/ChatView.tsx): `shouldDisableImages = !undefined?.supportsImages = true`

### Fix

เพิ่ม `values: { provider: requestedProvider }` ใน response message ที่ [`webviewMessageHandler.ts`](src/core/webview/webviewMessageHandler.ts) เพื่อให้ตรงกับที่ frontend expects

### ไฟล์ที่แก้ไข

- [`src/core/webview/webviewMessageHandler.ts`](src/core/webview/webviewMessageHandler.ts) - เพิ่ม `values.provider` ใน `getRouterModels` response
- [`src/core/webview/__tests__/webviewMessageHandler.routerModels.spec.ts`](src/core/webview/__tests__/webviewMessageHandler.routerModels.spec.ts) - อัปเดต test expectations

### Impact

Fix นี้ส่งผลกระทบกับทุก dynamic provider ที่ใช้ [`useRouterModels`](webview-ui/src/hooks/useRouterModels.ts) ไม่ใช่แค่ LiteLLM:

- `openrouter`
- `requesty`
- `unbound`
- `modelharbor`
- `deepinfra`
- และ providers อื่นๆ ที่ใช้ dynamic model fetching
