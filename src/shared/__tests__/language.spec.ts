// npx vitest run src/shared/__tests__/language.spec.ts

import { formatLanguage } from "../language"

describe("formatLanguage", () => {
	it("should return supported languages", () => {
		expect(formatLanguage("en")).toBe("en")
		expect(formatLanguage("th")).toBe("th")
	})

	it("should handle empty or undefined input", () => {
		expect(formatLanguage("")).toBe("en")
		expect(formatLanguage(undefined as unknown as string)).toBe("en")
	})

	it("should default unsupported languages to English", () => {
		expect(formatLanguage("fr")).toBe("en")
		expect(formatLanguage("pt-br")).toBe("en")
		expect(formatLanguage("zh-cn")).toBe("en")
		expect(formatLanguage("en-us")).toBe("en")
		expect(formatLanguage("th-th")).toBe("en")
	})
})
