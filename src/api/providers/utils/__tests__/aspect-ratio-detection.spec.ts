import { detectAspectRatio, SUPPORTED_ASPECT_RATIOS } from "../aspect-ratio-detection"

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
		it("returns 1:1 when no pattern matches", () => {
			expect(detectAspectRatio("cute cat playing with yarn")).toBe("1:1")
		})

		it("returns 1:1 for empty string", () => {
			expect(detectAspectRatio("")).toBe("1:1")
		})

		it("returns 1:1 for undefined-like input", () => {
			expect(detectAspectRatio(undefined as any)).toBe("1:1")
			expect(detectAspectRatio(null as any)).toBe("1:1")
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
