// npx vitest run src/shared/__tests__/language.spec.ts

import { formatLanguage, getSortedLanguages, LANGUAGES } from "../language"

describe("formatLanguage", () => {
	it("should uppercase region code in locale string", () => {
		expect(formatLanguage("pt-br")).toBe("pt-BR")
		expect(formatLanguage("zh-cn")).toBe("zh-CN")
	})

	it("should return original string if no region code present", () => {
		expect(formatLanguage("en")).toBe("en")
		expect(formatLanguage("fr")).toBe("fr")
	})

	it("should handle empty or undefined input", () => {
		expect(formatLanguage("")).toBe("en")
		expect(formatLanguage(undefined as unknown as string)).toBe("en")
	})
})

describe("getSortedLanguages", () => {
	it("should return languages with English and Thai in first two positions", () => {
		const sortedLanguages = getSortedLanguages()

		// Check that English is first
		expect(sortedLanguages[0][0]).toBe("en")
		expect(sortedLanguages[0][1]).toBe("English")

		// Check that Thai is second
		expect(sortedLanguages[1][0]).toBe("th")
		expect(sortedLanguages[1][1]).toBe("ไทย")
	})

	it("should sort remaining languages alphabetically by display name", () => {
		const sortedLanguages = getSortedLanguages()

		// Check that we have the expected number of languages
		expect(sortedLanguages.length).toBe(Object.keys(LANGUAGES).length)

		// Check that remaining languages are sorted alphabetically (skip first two)
		const remainingLanguages = sortedLanguages.slice(2)
		for (let i = 1; i < remainingLanguages.length; i++) {
			expect(remainingLanguages[i - 1][1].localeCompare(remainingLanguages[i][1]) <= 0).toBe(true)
		}
	})

	it("should include all languages from LANGUAGES", () => {
		const sortedLanguages = getSortedLanguages()
		const languageCodes = sortedLanguages.map(([code]) => code)

		// Check that all language codes from LANGUAGES are present
		Object.keys(LANGUAGES).forEach((code) => {
			expect(languageCodes).toContain(code)
		})

		// Check that no extra language codes are present
		languageCodes.forEach((code) => {
			expect(LANGUAGES).toHaveProperty(code)
		})
	})
})
