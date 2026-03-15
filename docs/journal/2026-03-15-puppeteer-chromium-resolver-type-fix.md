# puppeteer-chromium-resolver type declaration fix

## วันที่: 2026-03-15

## ปัญหา

`pnpm check-types` ล้มเหลวด้วย error TS7016:

```
services/browser/__tests__/BrowserSession.spec.ts(116,30): error TS7016:
Could not find a declaration file for module 'puppeteer-chromium-resolver'.
```

module `puppeteer-chromium-resolver` ไม่มี type declaration มาให้ และไม่มี `@types/puppeteer-chromium-resolver` บน npm

โค้ดใน `BrowserSession.ts` และ `UrlContentFetcher.ts` ใช้ `// @ts-ignore` เพื่อ suppress error ที่ import statement แต่ไฟล์ test (`BrowserSession.spec.ts`) ไม่ได้ใช้ `// @ts-ignore` ที่ dynamic import บรรทัด 116 ทำให้ `tsc --noEmit` fail

## Root Cause

package `puppeteer-chromium-resolver` เป็น JavaScript-only ไม่มี type definitions ที่แนบมา และไม่มี DefinitelyTyped package

## การแก้ไข

สร้างไฟล์ ambient module declaration ที่ `src/types/puppeteer-chromium-resolver.d.ts` ตาม pattern เดียวกับ `src/types/global-agent.d.ts` ที่มีอยู่แล้วในโปรเจค:

```typescript
declare module "puppeteer-chromium-resolver"
```

ใช้ shorthand ambient module declaration (ไม่ระบุ type details) เพราะทั้ง `BrowserSession.ts` และ `UrlContentFetcher.ts` นิยาม `PCRStats` interface เป็นของตัวเองอยู่แล้ว การระบุ type ใน declaration จะทำให้เกิด conflict กับ local interface

`src/tsconfig.json` มี `"include": ["."]` อยู่แล้ว ทำให้ไฟล์ `.d.ts` ทุกไฟล์ใน `src/` ถูก include อัตโนมัติ

## การตรวจสอบ

- `cd src && npx tsc --noEmit` — ผ่าน (exit code 0)
- `cd src && npx vitest run services/browser/__tests__/BrowserSession.spec.ts` — 22 tests ผ่านทั้งหมด

## ไฟล์ที่เปลี่ยนแปลง

- `src/types/puppeteer-chromium-resolver.d.ts` — ไฟล์ใหม่ (ambient module declaration)
