# Fix LiteLLM Embedding Base64 Encoding Error

**Date:** 2026-02-17
**Author:** ModelHarbor Agent

## Summary

แก้ไข bug ที่ทำให้กด "Start Indexing" กับ LiteLLM หรือ OpenAI Compatible embedding provider แล้วเกิด HTTP 400 Bad Request เนื่องจากการส่ง `encoding_format: "base64"` ที่ downstream backend ไม่ support

## Problem

เมื่อกด "Start Indexing" กับ LiteLLM หรือ OpenAI Compatible embedding provider จะเกิด error เรื่อง batch request ส่งไม่ได้ (HTTP 400 Bad Request) แต่ ModelHarbor provider ส่งได้ไม่มีปัญหา แม้จะใช้ base URL เดียวกัน

## Root Cause Analysis

- `OpenAICompatibleEmbedder` ส่ง `encoding_format: "base64"` ในทุก embedding request เพื่อ workaround bug ใน OpenAI SDK (v4.78.1) ที่ truncate embedding dimensions เหลือ 256
- `LiteLLMEmbedder` เป็น thin wrapper ของ `OpenAICompatibleEmbedder` จึง inherit `encoding_format: "base64"` โดยอัตโนมัติ
- LiteLLM proxy forward parameter `encoding_format: "base64"` ไปยัง downstream embedding backend (เช่น vLLM, TEI) ซึ่งไม่ support parameter นี้ → HTTP 400 Bad Request
- `ModelHarborEmbedder` มี implementation แยกที่**ไม่ส่ง** `encoding_format` เลย จึงทำงานได้ปกติ

```
User กด "Start Indexing" (LiteLLM provider)
  → LiteLLMEmbedder (thin wrapper)
    → OpenAICompatibleEmbedder: encoding_format: "base64"
      → LiteLLM Proxy: forward encoding_format: "base64"
        → Downstream Backend (vLLM/TEI): ไม่รู้จัก parameter → HTTP 400
```

## Solution

เพิ่ม constructor parameter `useBase64Encoding` ใน `OpenAICompatibleEmbedder` เพื่อให้ subclass สามารถปิดการส่ง `encoding_format: "base64"` ได้

### 1. เพิ่ม `useBase64Encoding` parameter (`src/services/code-index/embedders/openai-compatible.ts`)

เพิ่ม constructor parameter `useBase64Encoding?: boolean` (default: `true`) ที่ควบคุมว่าจะส่ง `encoding_format: "base64"` หรือไม่ ทั้งใน SDK path, direct HTTP path, และ validation

### 2. ปิด base64 encoding สำหรับ LiteLLM (`src/services/code-index/embedders/litellm.ts`)

ส่ง `useBase64Encoding: false` เมื่อสร้าง `OpenAICompatibleEmbedder` เพื่อหลีกเลี่ยงปัญหากับ downstream backend

## Files Changed

| File                                                     | Change                                                                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/code-index/embedders/openai-compatible.ts` | เพิ่ม constructor parameter `useBase64Encoding?: boolean` (default: `true`) — ควบคุมว่าจะส่ง `encoding_format: "base64"` หรือไม่ ทั้งใน SDK path, direct HTTP path, และ validation |
| `src/services/code-index/embedders/litellm.ts`           | ส่ง `useBase64Encoding: false` เมื่อสร้าง `OpenAICompatibleEmbedder`                                                                                                               |

## Tests Added

| File                                                                    | Tests | Description                                          |
| ----------------------------------------------------------------------- | ----- | ---------------------------------------------------- |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`           | -     | อัปเดต constructor assertions + เพิ่ม test case ใหม่ |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | 4     | เพิ่ม test cases สำหรับ `useBase64Encoding: false`   |

## Test Results

135 tests ผ่านทั้งหมด (6 test files, 0 failures, 0 regressions)

## Provider Comparison

| Feature              | OpenAI Compatible — ใช้โดย LiteLLM        | ModelHarbor         |
| -------------------- | ----------------------------------------- | ------------------- |
| Batch splitting      | ✅ Token-based                            | ✅ Token-based      |
| encoding_format      | `base64` — ก่อนแก้ไข → ปิดได้ — หลังแก้ไข | ไม่ส่ง              |
| Rate limiting        | Global mutex-based                        | Per-request backoff |
| Dimension validation | ✅ (เพิ่มใหม่)                            | ✅                  |
| Batch error wrapping | ✅ (เพิ่มใหม่)                            | ✅                  |

## Dimension Validation + Batch Error Wrapping

**Date:** 2026-02-17 (follow-up)

### สิ่งที่เพิ่มเข้ามา

เพิ่ม 3 features ที่ `ModelHarborEmbedder` มีอยู่แล้ว แต่ `OpenAICompatibleEmbedder` ยังขาด:

#### 1. Dimension Validation ใน `createEmbeddings()`

- หลังจากได้ embeddings จาก API จะตรวจสอบว่าทุกตัวใน batch มี dimension เท่ากัน
- ถ้าไม่เท่ากัน จะ throw error พร้อมระบุ dimensions ที่พบ เช่น `"Inconsistent embedding dimensions: expected 1024, got 768"`
- Log dimension ที่ได้ เช่น `[OpenAICompatibleEmbedder] Generated embeddings with dimension: 1024 for model: text-embedding-3-small`

#### 2. Batch Error Wrapping ใน `createEmbeddings()`

- เพิ่ม try-catch รอบ batch processing
- Wrap error ด้วย context message: `"Failed to create embeddings: batch processing error - {original error message}"`
- Log error ด้วย `console.error("Failed to process batch:", error)` ก่อน throw

#### 3. Dimension Logging ใน `validateConfiguration()`

- Log actual dimension ที่ได้จาก validation request เช่น `[OpenAICompatibleEmbedder] Model text-embedding-3-small has dimension: 1024`
- รองรับทั้ง array embeddings และ base64-encoded embeddings

### ไฟล์ที่แก้ไข

| File                                                                    | Change                                                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/code-index/embedders/openai-compatible.ts`                | เพิ่ม dimension validation + batch error wrapping ใน `createEmbeddings()`, เพิ่ม dimension logging ใน `validateConfiguration()`  |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | เพิ่ม 7 test cases: dimension validation (2), batch error wrapping (2), dimension logging ใน validation (2), console.log spy (1) |

### Test Results

77 tests ผ่านทั้งหมด (63 openai-compatible + 14 litellm, 0 failures, 0 regressions)

## Dimension Mismatch Auto-Detection + Pre-Upsert Validation

**Date:** 2026-02-17 (follow-up #2)

### Problem

เมื่อใช้ LiteLLM provider สำหรับ code indexing, embedding ยิงได้สำเร็จ แต่ตอน upsert vectors เข้า Qdrant เกิด "Bad Request" เพราะ **vector dimension ไม่ตรงกับ collection dimension**

สาเหตุ:

- `EMBEDDING_MODEL_PROFILES.litellm = {}` → ไม่มีค่า dimension สำหรับ LiteLLM models
- `getModelDimension("litellm", modelId)` return `undefined` → ต้องใช้ `config.modelDimension` จาก user config เท่านั้น
- ถ้า user config dimension ไม่ตรงกับ embedding dimension จริงจาก LiteLLM backend → Qdrant reject

### Solution

#### 1. เพิ่ม `detectDimension?()` ใน `IEmbedder` interface

- เพิ่ม optional method `detectDimension?(): Promise<number | undefined>` เพื่อ backward compatibility
- Embedder ที่ไม่ implement ก็ยังใช้ได้ตามเดิม

#### 2. Implement `detectDimension()` ใน `OpenAICompatibleEmbedder`

- ส่ง test embedding request ด้วย text สั้นๆ ("test") แล้ว return actual dimension ของ vector
- รองรับทั้ง array embeddings และ base64-encoded embeddings
- Catches errors gracefully, return `undefined` on failure

#### 3. Implement `detectDimension()` ใน `LiteLLMEmbedder`

- Delegate ไปที่ `OpenAICompatibleEmbedder.detectDimension()`

#### 4. เพิ่ม `createVectorStoreWithDimensionDetection()` ใน `CodeIndexServiceFactory`

- Async method ใหม่ที่ใช้ dimension resolution hierarchy:
    1. Profile dimension (จาก `EMBEDDING_MODEL_PROFILES`)
    2. Auto-detected dimension (จาก `embedder.detectDimension()`)
    3. User config dimension (จาก `config.modelDimension`)
    4. Throw clear error ถ้าไม่ได้ค่าจากทุก source

#### 5. เพิ่ม dimension validation ก่อน upsert ใน `QdrantVectorStore`

- ใน `upsertPoints()` ตรวจสอบ dimension ของ vector แรกกับ `this.vectorSize`
- ถ้าไม่ตรง → throw error ที่ชัดเจน: `"Vector dimension mismatch: collection expects X but embedding has Y"`
- ช่วยให้ user เข้าใจปัญหาแทนที่จะเจอแค่ "Bad Request" จาก Qdrant

### Files Changed

| File                                                     | Change                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/services/code-index/interfaces/embedder.ts`         | เพิ่ม `detectDimension?(): Promise<number \| undefined>` ใน `IEmbedder` interface |
| `src/services/code-index/embedders/openai-compatible.ts` | Implement `detectDimension()` — ส่ง test request แล้ว return actual dimension     |
| `src/services/code-index/embedders/litellm.ts`           | Implement `detectDimension()` — delegate ไปที่ base class                         |
| `src/services/code-index/service-factory.ts`             | เพิ่ม `createVectorStoreWithDimensionDetection()` async method                    |
| `src/services/code-index/vector-store/qdrant-client.ts`  | เพิ่ม dimension validation ใน `upsertPoints()`                                    |

### Tests Added/Updated

| File                                                                    | Tests         | Description                                                                                                                     |
| ----------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | 6             | `detectDimension` — array response, base64 response, empty data, API failure, full endpoint URL, useBase64Encoding=false        |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`           | 2             | `detectDimension` — delegation + error handling                                                                                 |
| `src/services/code-index/__tests__/service-factory.spec.ts`             | 6             | `createVectorStoreWithDimensionDetection` — auto-detect, profile priority, config fallback, no method, all fail, error handling |
| `src/services/code-index/vector-store/__tests__/qdrant-client.spec.ts`  | 3 + 4 updated | dimension mismatch error, matching dimension passes, empty array skips + updated existing tests to use correct vector sizes     |

### Test Results

201 tests ผ่านทั้งหมด (69 openai-compatible + 16 litellm + 47 service-factory + 69 qdrant-client, 0 failures, 0 regressions)

## LiteLLM Embedding Model Cache + Auto-fetch

**Date:** 2026-02-17 (follow-up #3)

### Problem

LiteLLM embedding model selection มีปัญหา 3 ข้อ:

1. **ไม่มี caching** — ทุกครั้งที่กด "Fetch Models" ต้อง call API ใหม่
2. **Fallback text field** — ถ้ายังไม่ได้ fetch models มี VSCodeTextField ให้พิมพ์ชื่อโมเดลเอง ซึ่งเสี่ยงพิมพ์ผิดหรือใส่ dimension ไม่ตรง
3. **ไม่มี auto-fetch** — ต้องกดปุ่ม Fetch Models ทุกครั้ง

### Solution

ทำให้ LiteLLM embedding model selection ทำงานเหมือน LiteLLM chat model — ดึงโมเดลจาก proxy, cache ไว้ในไฟล์, ใช้ dropdown เท่านั้น

#### 1. Cache Layer (`src/services/code-index/litellm-model-fetcher.ts`)

เพิ่ม `getCachedLiteLLMEmbeddingModels()` function ที่ใช้ multi-level cache strategy:

| Level  | Storage                                                   | TTL    | Access  |
| ------ | --------------------------------------------------------- | ------ | ------- |
| Memory | NodeCache                                                 | 5 นาที | Instant |
| Disk   | `{globalStoragePath}/cache/litellm_embedding_models.json` | ถาวร   | Fast    |
| API    | LiteLLM `/v1/model/info`                                  | —      | Network |

- **forceRefresh=false**: memory → disk → API
- **forceRefresh=true**: API (bypass cache)
- **In-flight dedup**: ใช้ `Map<string, Promise>` ป้องกัน concurrent API calls
- **Graceful degradation**: ถ้า API fail หรือ return empty → return stale cache (memory → disk sync)
- **Atomic disk writes**: ใช้ `safeWriteJson()` สำหรับ disk cache

#### 2. Message Handler (`src/core/webview/webviewMessageHandler.ts`)

- ปรับ `fetchLiteLLMEmbeddingModels` handler → ใช้ `getCachedLiteLLMEmbeddingModels()` กับ `forceRefresh: true`
- เพิ่ม `getLiteLLMEmbeddingModelsFromCache` handler ใหม่ → ใช้ cache ก่อน (`forceRefresh: false`)

#### 3. UI (`webview-ui/src/components/chat/CodeIndexPopover.tsx`)

- **ลบ fallback VSCodeTextField** — ใช้ VSCodeDropdown เสมอ ไม่ว่าจะมี models หรือไม่
- **เพิ่ม auto-fetch**: เมื่อ popover เปิด + provider = litellm + มี baseUrl → ส่ง `getLiteLLMEmbeddingModelsFromCache` อัตโนมัติ
- **เปลี่ยนปุ่ม** จาก "Fetch Models" เป็น "Refresh Models" สำหรับ force refresh
- **แสดง hint message** เมื่อยังไม่มี models: "Click Refresh Models to load available models"

#### 4. Types (`packages/types/src/vscode-extension-host.ts`)

เพิ่ม `"getLiteLLMEmbeddingModelsFromCache"` ใน `WebviewMessage.type` union

### Files Changed

| File                                                  | Change                                                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/code-index/litellm-model-fetcher.ts`    | เพิ่ม cache layer: NodeCache memory cache, disk cache via safeWriteJson, `getCachedLiteLLMEmbeddingModels()`, in-flight dedup, graceful degradation |
| `src/core/webview/webviewMessageHandler.ts`           | ปรับ `fetchLiteLLMEmbeddingModels` handler ใช้ cached version, เพิ่ม `getLiteLLMEmbeddingModelsFromCache` handler                                   |
| `webview-ui/src/components/chat/CodeIndexPopover.tsx` | ลบ fallback text field, เพิ่ม auto-fetch effect, เปลี่ยนปุ่มเป็น "Refresh Models", dropdown-only                                                    |
| `packages/types/src/vscode-extension-host.ts`         | เพิ่ม `"getLiteLLMEmbeddingModelsFromCache"` message type                                                                                           |

### Tests Added

| File                                                              | Tests | Description                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/code-index/__tests__/litellm-model-fetcher.spec.ts` | 14    | memory cache hit, disk cache hit, force refresh, API fetch + cache update, disk write, graceful degradation (stale memory, stale disk, no cache), in-flight dedup, cleanup on success/failure, buildCacheKey consistency |

### Test Results

37 tests ผ่านทั้งหมด (23 fetchLiteLLMEmbeddingModels + 14 getCachedLiteLLMEmbeddingModels, 0 failures, 0 regressions)

## Refactor: Move features from OpenAICompatible to LiteLLM

**Date:** 2026-02-17 (follow-up #4)

### เหตุผลในการย้าย

Features ที่เพิ่มเข้าไปใน `OpenAICompatibleEmbedder` (dimension validation, batch error wrapping, detectDimension, dimension logging) เป็น features เฉพาะสำหรับ LiteLLM use case ซึ่งทำให้ `OpenAICompatibleEmbedder` ไม่เป็น upstream-friendly — หาก upstream merge กลับเข้า Roo Code จะมี code ที่ไม่จำเป็นสำหรับ OpenAI-compatible provider ทั่วไป

การย้ายทำให้:

- `OpenAICompatibleEmbedder` กลับไปเป็น generic embedder ที่ upstream ยอมรับ
- `LiteLLMEmbedder` มี features เฉพาะที่ต้องการ โดยไม่กระทบ upstream

### สิ่งที่ย้าย

| Feature                                                        | จาก                                                | ไป                                                           |
| -------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Dimension validation (ตรวจ embedding dimensions ทุกตัวเท่ากัน) | `OpenAICompatibleEmbedder.createEmbeddings()`      | `LiteLLMEmbedder.createEmbeddings()`                         |
| Batch error wrapping (try-catch + context message)             | `OpenAICompatibleEmbedder.createEmbeddings()`      | `LiteLLMEmbedder.createEmbeddings()`                         |
| `detectDimension()` method                                     | `OpenAICompatibleEmbedder`                         | `LiteLLMEmbedder` (own implementation with OpenAI client)    |
| Dimension logging ใน `validateConfiguration()`                 | `OpenAICompatibleEmbedder.validateConfiguration()` | ลบออก (ไม่จำเป็น เพราะ `detectDimension()` ทำหน้าที่นี้แล้ว) |

### สิ่งที่เก็บไว้ใน OpenAICompatibleEmbedder

- `useBase64Encoding` parameter — เป็น general feature ที่ upstream น่าจะยอมรับ
- `handleOpenAIError` wrapping — เป็น bug fix ทั่วไป

### การเปลี่ยนแปลงใน LiteLLMEmbedder

- เพิ่ม private fields: `normalizedBaseUrl`, `apiKey` — เก็บไว้ใช้ใน `detectDimension()`
- `createEmbeddings()` — wrap ด้วย dimension validation + batch error wrapping
- `detectDimension()` — implement เองโดยใช้ OpenAI client โดยตรง (ไม่ delegate ให้ OpenAICompatible)

### ไฟล์ที่แก้ไข

| File                                                                    | Change                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/services/code-index/embedders/openai-compatible.ts`                | ลบ dimension validation, batch error wrapping, `detectDimension()`, dimension logging          |
| `src/services/code-index/embedders/litellm.ts`                          | เพิ่ม private fields, dimension validation ใน `createEmbeddings()`, own `detectDimension()`    |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | ลบ tests สำหรับ dimension validation, batch error wrapping, detectDimension, dimension logging |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`           | เพิ่ม tests สำหรับ dimension validation, batch error wrapping, detectDimension                 |

### Test Results

82 tests ผ่านทั้งหมด (57 openai-compatible + 25 litellm, 0 failures, 0 regressions)

## Standalone LiteLLM Embedder

**Date:** 2026-02-17 (follow-up #5)

### เหตุผลในการเปลี่ยนจาก delegation เป็น standalone

แม้ follow-up #4 จะย้าย features ออกจาก `OpenAICompatibleEmbedder` แล้ว แต่ `LiteLLMEmbedder` ยังคงเป็น **thin wrapper** ที่ delegate ไปที่ `OpenAICompatibleEmbedder` สำหรับ `createEmbeddings()` และ `validateConfiguration()` ทำให้:

1. **Coupling สูง** — LiteLLM ยังขึ้นอยู่กับ internal behavior ของ OpenAICompatibleEmbedder เช่น global rate limiting, mutex, `handleOpenAIError` wrapping, base64 encoding toggle
2. **ความซับซ้อนที่ไม่จำเป็น** — LiteLLM ไม่ต้องการ features หลายอย่างของ OpenAICompatible เช่น `isFullEndpointUrl`, `makeDirectEmbeddingRequest`, base64 encoding/decoding
3. **Testing ซับซ้อน** — ต้อง mock ทั้ง OpenAICompatibleEmbedder และ OpenAI SDK ซึ่งทำให้ tests fragile
4. **Upstream cleanliness** — การ discard changes ใน `openai-compatible.ts` ทำได้สะอาดเพราะ LiteLLM ไม่ขึ้นกับมันอีกต่อไป

### Solution: Copy Pattern จาก ModelHarborEmbedder

Rewrite `LiteLLMEmbedder` เป็น standalone implementation ที่ใช้ OpenAI SDK โดยตรง — เหมือน `ModelHarborEmbedder`:

| Feature                   | LiteLLMEmbedder (standalone)          | ModelHarborEmbedder                   |
| ------------------------- | ------------------------------------- | ------------------------------------- |
| OpenAI client             | ✅ สร้างเอง                           | ✅ สร้างเอง                           |
| Batching                  | ✅ MAX_BATCH_TOKENS + MAX_ITEM_TOKENS | ✅ MAX_BATCH_TOKENS + MAX_ITEM_TOKENS |
| Retry                     | ✅ Exponential backoff, 429 detection | ✅ Exponential backoff, 429 detection |
| encoding_format           | ❌ ไม่ส่ง                             | ❌ ไม่ส่ง                             |
| Dimension validation      | ✅ ตรวจทุกตัวใน batch                 | ✅ ตรวจทุกตัวใน batch                 |
| `detectDimension()`       | ✅ array + base64                     | ❌ ไม่มี                              |
| `validateConfiguration()` | ✅ withValidationErrorHandling        | ✅ withValidationErrorHandling        |
| URL normalization         | ✅ append `/v1`                       | ❌ ไม่จำเป็น                          |
| Default API key           | ✅ `"dummy-key"`                      | ❌ ต้องมี API key                     |

### สิ่งที่เปลี่ยน

- **ลบ** import และ dependency ต่อ `OpenAICompatibleEmbedder` ทั้งหมด
- **เพิ่ม** private fields: `client: OpenAI`, `model`, `normalizedBaseUrl`, `apiKey`, `dimension`
- **เพิ่ม** `createEmbeddings()` — batching loop เต็มรูปแบบ + dimension validation + batch error wrapping
- **เพิ่ม** `_embedBatchWithRetries()` — retry logic with exponential backoff, 429 detection
- **เปลี่ยน** `validateConfiguration()` — ใช้ `withValidationErrorHandling` โดยตรง แทนการ delegate
- **เก็บ** `detectDimension()` — ใช้ `this.client` แทนการสร้าง OpenAI client ใหม่ทุกครั้ง
- **เก็บ** URL normalization (strip trailing slash + append `/v1`)
- **เก็บ** default `"dummy-key"` สำหรับ API key

### ไฟล์ที่แก้ไข

| File                                                                    | Change                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/services/code-index/embedders/litellm.ts`                          | Rewrite เป็น standalone — ลบ OpenAICompatibleEmbedder dependency, เพิ่ม batching/retry/validation logic |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`           | Rewrite tests — mock OpenAI SDK โดยตรง, ลบ OpenAICompatibleEmbedder mock                                |
| `src/services/code-index/embedders/openai-compatible.ts`                | Discard all changes (git checkout HEAD)                                                                 |
| `src/services/code-index/embedders/__tests__/openai-compatible.spec.ts` | Discard all changes (git checkout HEAD)                                                                 |

### Test Results

83 tests ผ่านทั้งหมด (53 openai-compatible + 30 litellm, 0 failures, 0 errors, 0 regressions)

## Fix: createServices() dimension auto-detection integration

**Date:** 2026-02-17 (follow-up #6)

### Problem

`createVectorStoreWithDimensionDetection()` ที่สร้างไว้ใน follow-up #2 ไม่เคยถูกเรียกใน production!

`manager.ts` เรียก `createServices()` ซึ่งใช้ `createVectorStore()` (sync version ที่ไม่มี auto-detect) แทน async version `createVectorStoreWithDimensionDetection()`

ผลลัพธ์: ค่า dimension มาจาก:

1. `getModelDimension("litellm", modelId)` → `undefined` (เพราะ `EMBEDDING_MODEL_PROFILES.litellm = {}`)
2. Fallback: `config.modelDimension` (ค่า manual จาก user config) → อาจเป็นค่าผิด เช่น 2056 แทน 2560

### Solution

#### 1. เปลี่ยน `createServices()` เป็น async

เปลี่ยน `createServices()` ใน `service-factory.ts` จาก sync → async แล้วใช้ `createVectorStoreWithDimensionDetection(embedder)` แทน `createVectorStore()`:

```typescript
// Before (sync, ไม่มี auto-detect)
public createServices(...): { ... } {
    const vectorStore = this.createVectorStore()
}

// After (async, มี auto-detect)
public async createServices(...): Promise<{ ... }> {
    const vectorStore = await this.createVectorStoreWithDimensionDetection(embedder)
}
```

#### 2. อัปเดต caller ใน `manager.ts`

เพิ่ม `await` ที่ `_recreateServices()`:

```typescript
const { embedder, vectorStore, scanner, fileWatcher } = await this._serviceFactory.createServices(...)
```

#### 3. เพิ่ม dimension source logging

ใน `createVectorStoreWithDimensionDetection()` เพิ่ม logging ที่ชัดเจนว่า dimension มาจาก source ไหน:

```
[CodeIndex] Dimension source: profile (1024) for model: baai/bge-m3 (provider: litellm)
[CodeIndex] Dimension source: auto-detected from API (2560) for model: custom-model (provider: litellm)
[CodeIndex] Dimension source: manual config (2056) for model: custom-model (provider: litellm)
```

#### 4. เพิ่ม common LiteLLM models ใน EMBEDDING_MODEL_PROFILES

เพิ่ม profiles สำหรับ common embedding models ที่ใช้ผ่าน LiteLLM เป็น fallback ถ้า auto-detect ล้มเหลว:

```typescript
litellm: {
    "baai/bge-m3": { dimension: 1024, scoreThreshold: 0.3 },
    "qwen/qwen3-embedding-4b": { dimension: 2560, scoreThreshold: 0.3 },
},
```

### Dimension Resolution Hierarchy (ตอนนี้ทำงานจริง)

1. **Profile dimension** — จาก `EMBEDDING_MODEL_PROFILES[provider][modelId]`
2. **Auto-detected dimension** — จาก `embedder.detectDimension()` (probe API)
3. **Manual config dimension** — จาก `config.modelDimension` (user setting)
4. **Error** — throw ถ้าไม่ได้ค่าจากทุก source

### Files Changed

| File                                                | Change                                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/code-index/service-factory.ts`        | เปลี่ยน `createServices()` เป็น async, ใช้ `createVectorStoreWithDimensionDetection()`, เพิ่ม dimension source logging                    |
| `src/services/code-index/manager.ts`                | เพิ่ม `await` ที่ `createServices()` call                                                                                                 |
| `src/shared/embeddingModels.ts`                     | เพิ่ม common LiteLLM models ใน `EMBEDDING_MODEL_PROFILES.litellm`                                                                         |
| `src/services/code-index/__tests__/manager.spec.ts` | เปลี่ยน `mockReturnValue` → `mockResolvedValue` สำหรับ `createServices` mock, fix `mock.results[0].value` → `await mock.results[0].value` |

### Test Results

90 tests ผ่านทั้งหมด (47 service-factory + 13 manager + 30 litellm, 0 failures, 0 regressions)
