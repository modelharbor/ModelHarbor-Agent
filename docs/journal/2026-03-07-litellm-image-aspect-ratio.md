# Journal: LiteLLM Image Aspect Ratio Update (2026-03-07)

## บริบท

ปรับพฤติกรรม LiteLLM image generation (`gemini-2.5-flash-image`) ให้รองรับการเลือก aspect ratio แบบมีลำดับความสำคัญชัดเจน และเหมาะกับทั้งกรณีสร้างภาพใหม่และแก้ไขภาพจาก input เดิม โดยมีการเปลี่ยนแปลงหลักดังนี้:

1. เปลี่ยนค่า default aspect ratio จาก `1:1` เป็น `16:9`
2. เมื่อเป็นงาน image editing (มีรูป input) และ user ไม่ได้ระบุ ratio ใน prompt:
    - ระบบจะ detect ขนาดรูปจาก input image อัตโนมัติ
    - map เป็น ratio ที่ใกล้เคียงที่สุดจาก `SUPPORTED_ASPECT_RATIOS`
3. หาก user ระบุ aspect ratio ใน prompt ให้ใช้ค่าของ user เป็นอันดับแรก (priority สูงสุด)

## ลำดับ Priority ของ Aspect Ratio

ระบบใช้ลำดับตัดสินใจดังนี้:

1. **User specified ใน prompt (สูงสุด)**

    - ถ้า prompt ระบุ ratio ชัดเจน เช่น `16:9`, `9:16`, หรือคำเชิงทิศทาง (เช่น แนวตั้ง) ให้ใช้ตามนั้นทันที

2. **Detect จาก input image**

    - ใช้เมื่อมี input image และไม่มีการระบุ ratio ใน prompt
    - อ่านขนาดจาก header ของรูป (รองรับ `PNG/JPEG/GIF/WebP`)
    - เลือก ratio ที่ใกล้ที่สุดจาก `SUPPORTED_ASPECT_RATIOS`

3. **Default `16:9` (ต่ำสุด)**
    - ใช้เมื่อไม่มี input image และไม่มีการระบุ ratio ใน prompt

## ไฟล์ที่แก้ไข

### 1) `src/api/providers/utils/aspect-ratio-detection.ts`

- เปลี่ยน `DEFAULT_ASPECT_RATIO` จาก `"1:1"` เป็น `"16:9"`
- เพิ่มฟังก์ชัน `detectExplicitAspectRatio()`
    - คืนค่า `AspectRatio | null` (`null` = ไม่พบ explicit ratio ใน prompt)
- เพิ่มฟังก์ชัน `detectAspectRatioFromImage()`
    - อ่านขนาดภาพจาก base64 data URL
- เพิ่ม helper functions:
    - `parsePngDimensions`
    - `parseJpegDimensions`
    - `parseGifDimensions`
    - `parseWebPDimensions`
    - `getClosestSupportedAspectRatio`

### 2) `src/api/providers/utils/image-generation.ts`

- ปรับ `generateImageWithLiteLLM()` ให้ใช้ลำดับ priority ใหม่:
    1. explicit จาก prompt
    2. detect จาก input image
    3. default `16:9`

### 3) `src/api/providers/utils/__tests__/aspect-ratio-detection.spec.ts`

- ปรับ default expectation จาก `1:1` เป็น `16:9`
- เพิ่ม test สำหรับ `detectExplicitAspectRatio()` (รวมผ่าน 55 tests)
- เพิ่ม test สำหรับ `detectAspectRatioFromImage()` ครอบคลุม:
    - `PNG`
    - `JPEG`
    - `GIF`
    - `WebP`
    - invalid data

### 4) `src/api/providers/utils/__tests__/image-generation.spec.ts`

- อัปเดต mock และ expectation ให้ default เป็น `16:9`
- เพิ่ม 3 test cases สำหรับ priority logic ใหม่ (รวมผ่าน 32 tests)

## ผลการทดสอบ

- `aspect-ratio-detection.spec.ts`: **55 tests passed**
- `image-generation.spec.ts`: **32 tests passed**
- รวมการเปลี่ยนแปลงฝั่ง test:
    - เพิ่มใหม่ **17 tests**
    - ปรับเดิม **4 tests**
