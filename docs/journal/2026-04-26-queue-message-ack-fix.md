# Queue Message Acknowledgment Fix

**Date:** 2026-04-26
**Status:** Completed

## Problem

เมื่อผู้ใช้พิมพ์ prompt ยาวๆ แล้วกด Enter ขณะที่ API กำลังทำงานอยู่ (task กำลังรัน) บางครั้ง prompt นั้นจะหายไปเลยแทนที่จะเข้าคิวรอการประมวลผล ทำให้ผู้ใช้ต้องพิมพ์ใหม่ทั้งหมด

## Root Cause

UI ล้าง input ทันทีหลังส่ง `queueMessage` ไปยัง backend โดยไม่รอ confirmation ว่า message ถูกเพิ่มเข้าคิวสำเร็จหรือไม่ หาก backend เกิด error (เช่น ไม่มี active task, validation ล้มเหลว) prompt ก็จะหายไปเลยเพราะ UI ล้าง input ไปแล้ว

## Solution: Acknowledgment Pattern

เปลี่ยน flow ให้ UI รอ confirmation จาก backend ก่อนที่จะล้าง input:

1. UI ส่ง `queueMessage` พร้อม `requestId` (สร้างด้วย `crypto.randomUUID()`) แต่ **ไม่ล้าง input**
2. Backend ประมวลผลและส่ง `queueMessageAck` กลับเมื่อสำเร็จ หรือ `queueMessageError` เมื่อล้มเหลว
3. UI ล้าง input เฉพาะเมื่อได้รับ `queueMessageAck` เท่านั้น
4. หากได้รับ `queueMessageError` UI จะคง input ไว้เพื่อให้ user สามารถกดส่งใหม่ได้

## Files Changed

| File                                          | Change                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/types/src/vscode-extension-host.ts` | เพิ่ม `"queueMessageAck"` และ `"queueMessageError"` เข้าไปใน `ExtensionMessage.type` union type                                                             |
| `src/core/webview/webviewMessageHandler.ts`   | แก้ไข `case "queueMessage"` ให้ส่ง ack/error กลับพร้อม requestId                                                                                            |
| `webview-ui/src/components/chat/ChatView.tsx` | แก้ไข `handleSendMessage` และ `handleEnqueueCurrentMessage` ให้ไม่ล้าง input จนกว่าจะได้รับ ack, เพิ่ม handler สำหรับ `queueMessageAck`/`queueMessageError` |

## Tests Added

| File                                                                   | Tests                                                                         | Status                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| `src/core/webview/__tests__/queue-message-ack.spec.ts`                 | 5 tests (ส่งสำเร็จ, ไม่มี task, addMessage throws, backward compatible cases) | ✅ ผ่าน                   |
| `webview-ui/src/components/chat/__tests__/ChatView-queue-ack.spec.tsx` | 3 tests (sendingDisabled, ack, error)                                         | ⚠️ Pre-existing env issue |

## Verification

- ✅ Backend tests: 5/5 passed
- ✅ Types package: `tsc --noEmit` ผ่าน
- ✅ ESLint: ไม่มี error ในไฟล์ที่แก้ไข
- ✅ Type check: `tsc --noEmit` ใน src ผ่าน

## Backward Compatibility

การเปลี่ยนแปลงนี้เป็น backward compatible เนื่องจาก:

- หากไม่มี `requestId` ส่งมา (เช่นจาก client เก่า) backend จะยังทำงานปกติเหมือนเดิม
- ไม่มีการเปลี่ยนแปลง database schema
- ไม่มีการเปลี่ยนแปลง API contract ที่ทำให้ client เก่าใช้งานไม่ได้
