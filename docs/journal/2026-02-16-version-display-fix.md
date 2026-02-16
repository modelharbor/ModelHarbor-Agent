# 2026-02-16: Version Display Fix (3.41.2 → 3.41.3)

## Problem

แอปแสดง version เป็น "v3.41.2" ทั้งที่ `src/package.json` ได้อัปเดตเป็น "3.41.3" แล้ว

## Root Cause

webview-ui ใช้ Vite build-time variable (`process.env.PKG_VERSION`) ที่อ่านจาก `src/package.json` ตอน build time ผ่าน `webview-ui/vite.config.ts` (line 65) หลังจากอัปเดต version ใน `src/package.json` webview-ui ไม่ได้ถูก rebuild ทำให้ built output (`src/webview-ui/build/assets/index.js`) ยังมี version เดิม "3.41.2" อยู่

## Fix

Rebuild webview-ui ด้วย `cd webview-ui && npx vite build` เพื่อให้ built output ใช้ version "3.41.3" ที่ถูกต้อง

## Files Affected

- `src/webview-ui/build/assets/index.js` - rebuilt with correct version

## Version Display Locations (all use dynamic `Package.version`)

1. `webview-ui/src/components/common/VersionIndicator.tsx` - version button on welcome screen
2. `webview-ui/src/components/settings/About.tsx` - Settings > About page
3. `webview-ui/src/components/chat/Announcement.tsx` - Announcement dialog
4. `webview-ui/src/components/ErrorBoundary.tsx` - Error boundary header

## Lesson Learned

เมื่ออัปเดต version ใน `src/package.json` ต้อง rebuild webview-ui ด้วยเสมอ เพราะ version ถูก inline เป็น build-time constant ไม่ใช่ runtime read
