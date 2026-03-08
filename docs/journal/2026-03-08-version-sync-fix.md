# Version sync fix for src/package.json

## วันที่: 2026-03-08

## ปัญหา

version ที่ผู้ใช้เห็นใน webview ยังเป็น `3.50.8` แม้ว่า root [`package.json`](../../package.json) จะถูกอัปเดตเป็น `3.50.9` แล้ว

## Root Cause

webview ใช้ค่า version จาก [`src/package.json`](../../src/package.json) ผ่าน Vite build-time variable `process.env.PKG_VERSION` ที่ถูกอ่านใน [`webview-ui/vite.config.ts`](../../webview-ui/vite.config.ts) ไม่ได้อ่านจาก root [`package.json`](../../package.json) โดยตรง

ผลคือหลังจากมีการ bump version ที่ root อย่างเดียว ค่าใน [`src/package.json`](../../src/package.json) ยังเป็น `3.50.8` ทำให้ UI ยังคงแสดง version เดิม

## การแก้ไข

- เปลี่ยน `"version"` ใน [`src/package.json`](../../src/package.json) จาก `3.50.8` เป็น `3.50.9`
- คงการแก้ไขไว้เฉพาะ field version ตามขอบเขตที่กำหนด

## การตรวจสอบเพิ่มเติม

ตรวจสอบการอ้างอิง version `3.50.8` และ `3.50.9` ทั่ว repository แล้ว พบว่าไม่มีไฟล์อื่นที่ต้อง sync เพิ่มเติมในรอบนี้

- root [`package.json`](../../package.json) มีค่าเป็น `3.50.9` อยู่แล้ว
- [`src/package.json`](../../src/package.json) ถูกอัปเดตให้ตรงกันแล้ว
- ไม่พบ lock file หรือ changelog ที่มีค่า `3.50.8`/`3.50.9` ซึ่งต้องแก้ตามงานนี้

## ไฟล์ที่เปลี่ยนแปลง

- [`src/package.json`](../../src/package.json) - sync version จาก `3.50.8` เป็น `3.50.9`
- [`docs/journal/2026-03-08-version-sync-fix.md`](../../docs/journal/2026-03-08-version-sync-fix.md) - บันทึกสาเหตุและการแก้ไข

## หมายเหตุ

เนื่องจาก webview รับค่า version แบบ build-time injection จาก [`webview-ui/vite.config.ts`](../../webview-ui/vite.config.ts) การ sync ค่าใน [`src/package.json`](../../src/package.json) จึงเป็นจุดที่จำเป็นสำหรับให้ version ที่แสดงใน UI ถูกต้อง
