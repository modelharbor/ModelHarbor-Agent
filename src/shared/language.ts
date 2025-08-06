import { type Language, isLanguage } from "@roo-code/types"

/**
 * Language name mapping from ISO codes to full language names.
 */

export const LANGUAGES: Record<Language, string> = {
	ca: "Català",
	de: "Deutsch",
	en: "English",
	es: "Español",
	fr: "Français",
	hi: "हिन्दी",
	id: "Bahasa Indonesia",
	it: "Italiano",
	ja: "日本語",
	ko: "한국어",
	nl: "Nederlands",
	pl: "Polski",
	"pt-BR": "Português",
	ru: "Русский",
	th: "ไทย",
	tr: "Türkçe",
	vi: "Tiếng Việt",
	"zh-CN": "简体中文",
	"zh-TW": "繁體中文",
}

/**
 * Returns a sorted array of language entries with English and Thai in the first two positions,
 * followed by other languages sorted alphabetically by their display names.
 */
export function getSortedLanguages(): [Language, string][] {
	const entries = Object.entries(LANGUAGES) as [Language, string][]

	// Find English and Thai entries
	const englishIndex = entries.findIndex(([code]) => code === "en")
	const thaiIndex = entries.findIndex(([code]) => code === "th")

	// Extract English and Thai entries
	const englishEntry = entries[englishIndex]
	const thaiEntry = entries[thaiIndex]

	// Remove English and Thai from the array
	const remainingEntries = entries.filter(([code]) => code !== "en" && code !== "th")

	// Sort remaining entries alphabetically by display name
	remainingEntries.sort((a, b) => a[1].localeCompare(b[1]))

	// Return with English and Thai first, followed by sorted remaining languages
	return [englishEntry, thaiEntry, ...remainingEntries]
}

/**
 * Formats a VSCode locale string to ensure the region code is uppercase.
 * For example, transforms "en-us" to "en-US" or "fr-ca" to "fr-CA".
 *
 * @param vscodeLocale - The VSCode locale string to format (e.g., "en-us", "fr-ca")
 * @returns The formatted locale string with uppercase region code
 */

export function formatLanguage(vscodeLocale: string): Language {
	if (!vscodeLocale) {
		return "en"
	}

	const formattedLocale = vscodeLocale.replace(/-(\w+)$/, (_, region) => `-${region.toUpperCase()}`)
	return isLanguage(formattedLocale) ? formattedLocale : "en"
}
