# LiteLLM Image Generation — Nano Banana Prompt Instruction

**Date:** 2026-03-18

## Summary

เพิ่ม system message instruction สำหรับ LiteLLM image generation ตาม model ที่ใช้ เพื่อให้แต่ละ model ได้รับ prompt instruction ที่เหมาะสม

## Changes

### System Instruction per Model

เพิ่ม `systemInstruction` variable ที่ determine ค่าจาก `isGemini31ImageModel(effectiveModel)`:

- **Gemini 2.5** (`google/gemini-2.5-flash-image`): system message `"Generate images in Nano banana style."`
- **Gemini 3.1** (`google/gemini-3.1-flash-image-preview`): system message `"Generate images in Nano banana 2 style."`

System message จะถูกใส่เป็น message แรกใน messages array ของทั้ง 2 payload paths (image generation และ image editing)

## ไฟล์ที่แก้ไข

### 1) [`src/api/providers/utils/image-generation.ts`](../../src/api/providers/utils/image-generation.ts)

- เพิ่ม `systemInstruction` variable ที่เลือกค่าตาม model:
    - `isGemini31ImageModel(effectiveModel)` → `"Generate images in Nano banana 2 style."`
    - อื่นๆ (Gemini 2.5) → `"Generate images in Nano banana style."`
- ใส่ system message เป็น entry แรกใน messages array ของทั้ง 2 payload paths

### 2) [`src/api/providers/utils/__tests__/image-generation.spec.ts`](../../src/api/providers/utils/__tests__/image-generation.spec.ts)

- เพิ่ม test cases 2 ตัวสำหรับ nano banana prompt:
    - ตรวจสอบว่า Gemini 2.5 ได้รับ system message `"Generate images in Nano banana style."`
    - ตรวจสอบว่า Gemini 3.1 ได้รับ system message `"Generate images in Nano banana 2 style."`
- อัปเดต existing tests ให้สอดคล้องกับ system message ใหม่

## วิธีการ

เพิ่ม `systemInstruction` variable ที่ determine ค่าจาก `isGemini31ImageModel(effectiveModel)` แล้วใส่เป็น system message แรกใน messages array ของทั้ง 2 payload paths (generation path และ editing path)

## ผลการทดสอบ

- `image-generation.spec.ts`: **41/41 tests passed**
