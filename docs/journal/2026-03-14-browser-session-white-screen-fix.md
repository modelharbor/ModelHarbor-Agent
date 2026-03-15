# Browser Session White Screen Fix - เพิ่ม Chromium Launch Flags

## วันที่: 2026-03-14

## ปัญหา

เมื่อใช้ Browser Session จะเห็นแต่หน้าจอขาว ไม่สามารถเห็นหน้าตาของเว็บที่เปิดได้ Screenshot ที่จับภาพจะเป็นภาพสีขาวว่างเปล่า

## Root Cause

`BrowserSession.launchLocalBrowser()` ใน `src/services/browser/BrowserSession.ts` บรรทัด 75 ขาด Chromium launch flags สำคัญ มีแค่ `--user-agent` flag เท่านั้น

ในขณะที่ `UrlContentFetcher.launchBrowser()` ใน `src/services/browser/UrlContentFetcher.ts` บรรทัด 48 มี flags ครบทั้งหมด

Flag ที่สำคัญที่สุดคือ `--disable-gpu` ซึ่งป้องกัน GPU compositing failure ใน headless environment

## การแก้ไข

เพิ่ม launch flags ใน `BrowserSession.launchLocalBrowser()`:

- `--disable-dev-shm-usage` - ป้องกัน shared memory issues ใน containers
- `--disable-accelerated-2d-canvas` - ป้องกัน canvas acceleration failure
- `--no-first-run` - ข้าม first run dialogs
- `--disable-gpu` - ป้องกัน GPU compositing failure (สำคัญที่สุด)
- `--disable-features=VizDisplayCompositor` - ป้องกัน Viz display compositor failure
- `--no-sandbox` เฉพาะ Linux

## Test Coverage

- `src/services/browser/__tests__/BrowserSession.spec.ts` - เพิ่ม 3 unit tests ใหม่
- รวม 22 tests ผ่านทั้งหมด

## ไฟล์ที่เปลี่ยนแปลง

- `src/services/browser/BrowserSession.ts` - เพิ่ม launch args
- `src/services/browser/__tests__/BrowserSession.spec.ts` - เพิ่ม 3 unit tests
