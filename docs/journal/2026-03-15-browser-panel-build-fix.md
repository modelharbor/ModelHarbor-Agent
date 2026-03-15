# 2026-03-15: Browser Panel Build Entry Point Fix

## Problem

เมื่อใช้ browser session ใน production mode (extension ที่ติดตั้งจาก VSIX), webview แสดงหน้าจอขาว เนื่องจาก `browser-panel.js` ไม่ถูกสร้างใน production build

### Error

```
ERR Webview.loadLocalResource - Error using fileReader
GET .../webview-ui/build/assets/browser-panel.js net::ERR_ABORTED 404 (Not Found)
```

## Root Cause

`webview-ui/vite.config.ts` กำหนด rollup input เพียง entry point เดียว (`index.html`) ทำให้ Vite build สร้างเฉพาะ `assets/index.js` แต่ไม่สร้าง `assets/browser-panel.js`

Dev mode ทำงานปกติเพราะ Vite dev server เสิร์ฟ raw source file ได้ทุกไฟล์ (`http://localhost/src/browser-panel.tsx`)

## Fix

1. สร้าง `webview-ui/browser-panel.html` — HTML entry point สำหรับ browser session panel
2. เพิ่ม `"browser-panel"` เป็น rollup input ใน `webview-ui/vite.config.ts`

### Files Changed

- `webview-ui/browser-panel.html` (สร้างใหม่)
- `webview-ui/vite.config.ts` (เพิ่ม entry point)
- `src/__tests__/dist_assets.spec.ts` (เพิ่ม test case)

## Verification

- Build สำเร็จ: `assets/browser-panel.js` (21.76 kB) ถูกสร้างใน build output
- Pattern `entryFileNames: 'assets/[name].js'` ผลิตชื่อไฟล์ตรงตามที่ `BrowserSessionPanelManager.getHtmlContent()` ต้องการ
