# Super YOLO Default Command Timeout Allowlist

**Date:** 2026-03-13

## Summary

เพิ่ม default allowlist สำหรับ long-running command prefixes ที่จะ bypass timeout โดยอัตโนมัติ ค่า timeout ยังคงเป็น 300 วินาที (5 นาที) เดิม โดย commands ที่อยู่ใน allowlist จะไม่ถูก kill เมื่อเกิน timeout

## Problem

Super YOLO mode มี timeout ที่ kill terminal command หลัง 300 วินาที (5 นาที) ซึ่งสั้นเกินไปสำหรับ:

- Build processes (npm run build, cargo build, docker build)
- Package installation (npm install, pip install, brew install)
- File transfer operations (cp, rsync, scp, git clone)
- Test suites (vitest, jest, playwright, cypress)

## Solution

แทนที่จะเพิ่มค่า timeout → ใช้ default allowlist ให้ long-running commands bypass timeout แทน วิธีนี้ดีกว่าเพราะ:

- timeout 5 นาทียังคงปกป้อง commands ทั่วไปที่อาจ hang
- commands ที่รู้ว่าใช้เวลานาน (build, install, transfer) จะไม่ถูก kill
- ผู้ใช้สามารถเพิ่ม custom commands เข้า allowlist ได้ผ่าน settings

## Changes

### Files Modified

1. **`src/package.json`**
    - เพิ่ม default `commandTimeoutAllowlist` ครอบคลุม 64 command prefixes:
        - **Package managers:** npm, pnpm, yarn, pip, cargo, go, brew, apt, choco
        - **Build tools:** make, cmake, gradle, mvn, msbuild, turbo, nx, esbuild, webpack, vite, tsc
        - **Docker:** docker build, pull, push, compose
        - **Git:** clone, pull, push, fetch
        - **File operations:** cp, copy, xcopy, robocopy, rsync, scp, mv, move, tar, zip, unzip, 7z
        - **Network:** wget, curl
        - **Test runners:** vitest, jest, playwright, cypress
        - **Other:** dotnet build/publish, npx

## Testing

- ✅ ExecuteCommandTool tests: passed
- ✅ allowlist bypass logic verified

## Impact

- ค่า timeout ยังคงเป็น 300 วินาที (5 นาที) เดิม สำหรับ commands ทั่วไป
- Long-running commands (build, install, file transfer, test suites) จะ bypass timeout อัตโนมัติผ่าน default allowlist
- ผู้ใช้สามารถเพิ่ม custom commands เข้า allowlist ได้ผ่าน settings
