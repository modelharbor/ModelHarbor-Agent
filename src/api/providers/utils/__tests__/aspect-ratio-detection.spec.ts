import {
	detectAspectRatio,
	detectAspectRatioFromImage,
	detectExplicitAspectRatio,
	SUPPORTED_ASPECT_RATIOS,
} from "../aspect-ratio-detection"

function toDataUrl(mimeType: string, buffer: Buffer): string {
	return `data:${mimeType};base64,${buffer.toString("base64")}`
}

function createPngDataUrl(width: number, height: number): string {
	const buffer = Buffer.alloc(33)

	// PNG signature
	buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)

	// IHDR chunk
	buffer.writeUInt32BE(13, 8) // IHDR data length
	buffer.write("IHDR", 12, 4, "ascii")
	buffer.writeUInt32BE(width, 16)
	buffer.writeUInt32BE(height, 20)
	buffer[24] = 8 // bit depth
	buffer[25] = 2 // color type (truecolor)
	buffer[26] = 0 // compression
	buffer[27] = 0 // filter
	buffer[28] = 0 // interlace
	// CRC left as 0 for test fixture

	return toDataUrl("image/png", buffer)
}

function createJpegDataUrl(width: number, height: number): string {
	const buffer = Buffer.from([
		0xff,
		0xd8, // SOI
		0xff,
		0xc0, // SOF0
		0x00,
		0x11, // segment length (17 bytes)
		0x08, // precision
		0x00,
		0x00, // height placeholder
		0x00,
		0x00, // width placeholder
		0x03, // components
		0x01,
		0x11,
		0x00,
		0x02,
		0x11,
		0x00,
		0x03,
		0x11,
		0x00,
		0xff,
		0xd9, // EOI
	])

	buffer.writeUInt16BE(height, 7)
	buffer.writeUInt16BE(width, 9)

	return toDataUrl("image/jpeg", buffer)
}

function createGifDataUrl(width: number, height: number): string {
	const buffer = Buffer.alloc(10)

	buffer.write("GIF89a", 0, "ascii")
	buffer.writeUInt16LE(width, 6)
	buffer.writeUInt16LE(height, 8)

	return toDataUrl("image/gif", buffer)
}

function createWebPDataUrl(width: number, height: number): string {
	const chunkSize = 10
	const buffer = Buffer.alloc(12 + 8 + chunkSize)

	buffer.write("RIFF", 0, "ascii")
	buffer.writeUInt32LE(buffer.length - 8, 4)
	buffer.write("WEBP", 8, "ascii")

	// VP8 chunk
	buffer.write("VP8 ", 12, "ascii")
	buffer.writeUInt32LE(chunkSize, 16)

	// Minimal VP8 key frame header with start code 9D 01 2A
	buffer[20] = 0x00
	buffer[21] = 0x00
	buffer[22] = 0x00
	buffer[23] = 0x9d
	buffer[24] = 0x01
	buffer[25] = 0x2a

	buffer.writeUInt16LE(width & 0x3fff, 26)
	buffer.writeUInt16LE(height & 0x3fff, 28)

	return toDataUrl("image/webp", buffer)
}

describe("detectAspectRatio", () => {
	describe("direct ratio patterns", () => {
		test.each([
			["21:9", "21:9"],
			["16:9", "16:9"],
			["9:16", "9:16"],
			["4:5", "4:5"],
			["5:4", "5:4"],
			["4:3", "4:3"],
			["3:4", "3:4"],
			["3:2", "3:2"],
			["2:3", "2:3"],
			["1:1", "1:1"],
		])('detects explicit ratio "%s" → "%s"', (ratio, expected) => {
			expect(detectAspectRatio(`Create an image with ratio ${ratio}`)).toBe(expected)
		})

		it("handles ratios with spaces around separator", () => {
			expect(detectAspectRatio("make it 16 : 9 please")).toBe("16:9")
		})

		it("handles x as separator", () => {
			expect(detectAspectRatio("generate at 9x16")).toBe("9:16")
		})
	})

	describe("detectExplicitAspectRatio", () => {
		it("returns explicit ratio when prompt contains a supported ratio", () => {
			expect(detectExplicitAspectRatio("generate 16:9 image")).toBe("16:9")
		})

		it("returns null when prompt does not contain any ratio keyword", () => {
			expect(detectExplicitAspectRatio("generate a dreamy fantasy scene")).toBeNull()
		})

		it("returns null for empty or invalid prompt", () => {
			expect(detectExplicitAspectRatio("")).toBeNull()
			expect(detectExplicitAspectRatio(undefined as any)).toBeNull()
		})
	})

	describe("detectAspectRatioFromImage", () => {
		it("detects ratio from minimal valid PNG header", () => {
			expect(detectAspectRatioFromImage(createPngDataUrl(800, 600))).toBe("4:3")
		})

		it("detects ratio from minimal valid JPEG header", () => {
			expect(detectAspectRatioFromImage(createJpegDataUrl(1920, 1080))).toBe("16:9")
		})

		it("detects ratio from minimal valid GIF header", () => {
			expect(detectAspectRatioFromImage(createGifDataUrl(600, 800))).toBe("3:4")
		})

		it("detects ratio from minimal valid WebP header", () => {
			expect(detectAspectRatioFromImage(createWebPDataUrl(1080, 1920))).toBe("9:16")
		})

		test.each([
			[1920, 1080, "16:9"],
			[1080, 1080, "1:1"],
			[800, 600, "4:3"],
			[1080, 1920, "9:16"],
			[600, 800, "3:4"],
		] as const)("maps %ix%i to %s", (width, height, expected) => {
			expect(detectAspectRatioFromImage(createPngDataUrl(width, height))).toBe(expected)
		})

		it('returns default "16:9" for invalid data', () => {
			expect(detectAspectRatioFromImage("not-a-valid-data-url")).toBe("16:9")
		})

		it('returns default "16:9" for empty string', () => {
			expect(detectAspectRatioFromImage("")).toBe("16:9")
		})
	})

	describe("English keywords", () => {
		it("detects 'panorama' → 21:9", () => {
			expect(detectAspectRatio("Create a panorama of mountains")).toBe("21:9")
		})

		it("detects 'ultra-wide' → 21:9", () => {
			expect(detectAspectRatio("ultra-wide shot of the city")).toBe("21:9")
		})

		it("detects 'ultrawide' → 21:9", () => {
			expect(detectAspectRatio("ultrawide monitor wallpaper")).toBe("21:9")
		})

		it("detects 'wallpaper' → 16:9", () => {
			expect(detectAspectRatio("a beautiful desktop wallpaper")).toBe("16:9")
		})

		it("detects 'widescreen' → 16:9", () => {
			expect(detectAspectRatio("widescreen image of forest")).toBe("16:9")
		})

		it("detects 'landscape' → 16:9", () => {
			expect(detectAspectRatio("landscape photo of sunset")).toBe("16:9")
		})

		it("detects 'portrait' → 9:16", () => {
			expect(detectAspectRatio("portrait photo of a woman")).toBe("9:16")
		})

		it("detects 'vertical' → 9:16", () => {
			expect(detectAspectRatio("vertical image of a tower")).toBe("9:16")
		})

		it("detects 'story' → 9:16", () => {
			expect(detectAspectRatio("make a story image for instagram")).toBe("9:16")
		})

		it("detects 'stories' → 9:16", () => {
			expect(detectAspectRatio("create content for stories")).toBe("9:16")
		})

		it("detects 'reels' → 9:16", () => {
			expect(detectAspectRatio("create reels thumbnail")).toBe("9:16")
		})

		it("detects 'tiktok' → 9:16", () => {
			expect(detectAspectRatio("tiktok video thumbnail")).toBe("9:16")
		})

		it("detects 'square' → 1:1", () => {
			expect(detectAspectRatio("a square image of a cat")).toBe("1:1")
		})

		it("detects 'desktop background' → 16:9", () => {
			expect(detectAspectRatio("create a desktop background")).toBe("16:9")
		})
	})

	describe("Thai keywords", () => {
		it("detects 'พาโนรามา' → 21:9", () => {
			expect(detectAspectRatio("สร้างรูปพาโนรามาภูเขา")).toBe("21:9")
		})

		it("detects 'วอลเปเปอร์' → 16:9", () => {
			expect(detectAspectRatio("สร้างวอลเปเปอร์สวยๆ")).toBe("16:9")
		})

		it("detects 'วอลล์เปเปอร์' → 16:9", () => {
			expect(detectAspectRatio("วอลล์เปเปอร์ทะเล")).toBe("16:9")
		})

		it("detects 'แนวนอน' → 16:9", () => {
			expect(detectAspectRatio("สร้างรูปฮัสกี้แนวนอน")).toBe("16:9")
		})

		it("detects 'แนวตั้ง' → 9:16", () => {
			expect(detectAspectRatio("รูปแนวตั้งของตึก")).toBe("9:16")
		})

		it("detects 'สตอรี่' → 9:16", () => {
			expect(detectAspectRatio("สร้างรูปสตอรี่")).toBe("9:16")
		})

		it("detects 'รูปสตอรี่' → 9:16", () => {
			expect(detectAspectRatio("ทำรูปสตอรี่ให้หน่อย")).toBe("9:16")
		})

		it("detects 'สี่เหลี่ยมจัตุรัส' → 1:1", () => {
			expect(detectAspectRatio("รูปสี่เหลี่ยมจัตุรัสแมว")).toBe("1:1")
		})

		it("detects 'จตุรัส' → 1:1", () => {
			expect(detectAspectRatio("สร้างรูปจตุรัส")).toBe("1:1")
		})
	})

	describe("defaults and edge cases", () => {
		it("returns 16:9 when no pattern matches", () => {
			expect(detectAspectRatio("cute cat playing with yarn")).toBe("16:9")
		})

		it("returns 16:9 for empty string", () => {
			expect(detectAspectRatio("")).toBe("16:9")
		})

		it("returns 16:9 for undefined-like input", () => {
			expect(detectAspectRatio(undefined as any)).toBe("16:9")
			expect(detectAspectRatio(null as any)).toBe("16:9")
		})

		it("prioritises explicit ratio over keywords", () => {
			// "21:9" direct ratio is checked before "landscape"
			expect(detectAspectRatio("landscape at 21:9")).toBe("21:9")
		})

		it("prioritises more specific keywords (panorama > landscape)", () => {
			// panorama rules appear before landscape rules
			expect(detectAspectRatio("a panorama landscape shot")).toBe("21:9")
		})
	})

	describe("SUPPORTED_ASPECT_RATIOS constant", () => {
		it("contains all expected ratios", () => {
			expect(SUPPORTED_ASPECT_RATIOS).toEqual([
				"1:1",
				"3:2",
				"2:3",
				"3:4",
				"4:3",
				"4:5",
				"5:4",
				"9:16",
				"16:9",
				"21:9",
			])
		})
	})
})
