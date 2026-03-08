# Super YOLO follow-up blank answer fix

## วันที่: 2026-03-08

## ปัญหา

ในโหมด Super YOLO เมื่อ agent ใช้ `ask_followup_question` ถามคำถามพร้อมตัวเลือก ระบบ auto-approve ด้วยคำตอบว่างเปล่า แทนที่จะรอให้ผู้ใช้กดเลือก ทำให้ agent เดินต่อโดยไม่มีคำตอบจริง

## Root Cause

เป็น contract mismatch ระหว่าง 2 flow:

- flow follow-up ปกติต้องการคำตอบแบบ `"messageResponse"` + ข้อความจริง (ผ่าน `checkAutoApproval()` ใน `src/core/auto-approval/index.ts`)
- แต่ Super YOLO stuck fallback ใน `Task.startSuperYoloStuckTimer()` (`src/core/task/Task.ts`) ใช้ `"yesButtonClicked"` ซึ่งเป็น approval response ไม่มีข้อความ

downstream:

1. `Task.handleWebviewAskResponse()` นับ `"yesButtonClicked"` ว่า follow-up ถูกตอบแล้ว
2. `AskFollowupQuestionTool.execute()` ไม่ตรวจชนิด response และไม่บังคับว่าต้องมีข้อความ ก่อนจะเขียน feedback ว่างใน UI และส่ง tool result ว่าง

## การแก้ไข

### 1. Fix หลัก - `src/core/task/Task.ts` (startSuperYoloStuckTimer)

- เพิ่ม early return สำหรับ `"followup"` ask type ทำให้ Super YOLO stuck timer ไม่ auto-continue คำถาม follow-up อีกต่อไป
- ปล่อยให้ flow auto-approve ปกติใน `checkAutoApproval()` เป็นผู้จัดการ (ซึ่งเช็ก `alwaysAllowFollowupQuestions` setting อยู่แล้ว)

### 2. Fix เสริม - `src/core/tools/AskFollowupQuestionTool.ts`

- เพิ่ม validation guard ให้รับเฉพาะ response แบบ `"messageResponse"` เท่านั้น
- เพิ่มการกันเคสข้อความว่าง/มีแต่ whitespace
- ถ้า follow-up ได้ response ผิด contract จะถูกจัดเป็น error ผ่าน `formatResponse.toolError()`

## Test Coverage

- `src/core/task/__tests__/Task.super-yolo-stuck-timer.spec.ts` - ทดสอบว่า stuck timer ไม่ auto-continue followup
- `src/core/tools/__tests__/askFollowupQuestionTool.spec.ts` - ทดสอบ validation guard ใน tool
- `src/core/auto-approval/__tests__/super-yolo-mode.spec.ts` - ทดสอบ auto-approval logic
- รวม 39 tests ผ่านทั้งหมด

## ไฟล์ที่เปลี่ยนแปลง

- `src/core/task/Task.ts` - เพิ่ม early return ใน startSuperYoloStuckTimer สำหรับ followup
- `src/core/tools/AskFollowupQuestionTool.ts` - เพิ่ม response validation
- `src/core/task/__tests__/Task.super-yolo-stuck-timer.spec.ts` - test ใหม่
- `src/core/tools/__tests__/askFollowupQuestionTool.spec.ts` - test ใหม่
- `src/core/auto-approval/__tests__/super-yolo-mode.spec.ts` - test ใหม่
