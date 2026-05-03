# Journal: Extension Metadata Feature in About Page

**Date:** 2026-05-02

## บริบท (Context)

มีการเพิ่ม extension metadata feature ในหน้า About ของ ModelHarbor Agent เพื่อให้ข้อมูลที่แสดงตรงกับที่ VSCode Extensions panel แสดง

## ปัญหา (Problem)

- หน้า About ModelHarbor Agent แสดงข้อมูลไม่ครบเมื่อเทียบกับ VSCode Extensions panel
- ข้อมูลที่ขาด: Identifier, Source (VSIX/Marketplace), Extension Size, Last Updated
- `PKG_OUTPUT_CHANNEL` ยังเป็น "Roo-Code" แทนที่จะเป็น "ModelHarbor-Agent"

## การเปลี่ยนแปลง (Changes)

**ไฟล์ที่ถูกแก้ไข:**

1. `webview-ui/vite.config.ts` — เปลี่ยน `PKG_OUTPUT_CHANNEL` จาก "Roo-Code" เป็น "ModelHarbor-Agent"
2. `packages/types/src/vscode-extension-host.ts` — เพิ่ม `ExtensionMetaInfo` interface และ `extensionMetaInfo` field ใน `ExtensionState`
3. `src/core/webview/ClineProvider.ts` — เพิ่ม `getExtensionMetaInfo()` method ที่ดึง metadata จาก VSCode API
4. `src/utils/cacheInfo.ts` — เพิ่ม `calculateDirectorySize()` function
5. `webview-ui/src/components/settings/About.tsx` — เพิ่ม "Extension Information" section

**ไฟล์ tests ที่เพิ่ม/แก้ไข:**

1. `src/utils/__tests__/cacheInfo.test.ts` — เพิ่ม 5 test cases สำหรับ `calculateDirectorySize()`
2. `src/core/webview/__tests__/ClineProvider.getExtensionMetaInfo.spec.ts` — สร้างใหม่ 12 test cases

## สถาปัตยกรรม (Architecture)

- `ExtensionMetaInfo` ถูกส่งจาก backend (`ClineProvider`) ไป webview ผ่าน `ExtensionState`
- ข้อมูลมาจาก `vscode.extensions.getExtension()` API และ file system
- Fields ใหม่เป็น optional เพื่อ backward compatibility

## ผลลัพธ์ (Results)

- Backend tests ผ่าน 38 tests
- Frontend tests มีอยู่แล้ว 24 tests (มี React dual-instance issue เดิมของ pnpm monorepo)
