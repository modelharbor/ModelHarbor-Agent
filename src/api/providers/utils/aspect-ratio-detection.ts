/**
 * Aspect ratio detection utility for LiteLLM image generation.
 *
 * Detects the desired aspect ratio from a user prompt by matching
 * keywords in both Thai and English. Used exclusively with the
 * `google/gemini-2.5-flash-image` model via LiteLLM because that
 * model defaults to 1:1 unless an explicit aspect_ratio is provided.
 */

/** All supported aspect ratios. */
export const SUPPORTED_ASPECT_RATIOS = [
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
] as const

export type AspectRatio = (typeof SUPPORTED_ASPECT_RATIOS)[number]

const DEFAULT_ASPECT_RATIO: AspectRatio = "1:1"

/**
 * Mapping from keyword / phrase → aspect ratio.
 * Order matters: more-specific patterns are checked first via the
 * ordered array below so that e.g. "ultra-wide" wins over "wide".
 */
interface RatioRule {
	pattern: RegExp
	ratio: AspectRatio
}

const RATIO_RULES: RatioRule[] = [
	// ── Direct ratio patterns (highest priority) ──────────────────
	// Match explicit ratio strings like "16:9", "9:16", "21:9" etc.
	{ pattern: /\b21\s*[:/x×]\s*9\b/i, ratio: "21:9" },
	{ pattern: /\b16\s*[:/x×]\s*9\b/i, ratio: "16:9" },
	{ pattern: /\b9\s*[:/x×]\s*16\b/i, ratio: "9:16" },
	{ pattern: /\b4\s*[:/x×]\s*5\b/i, ratio: "4:5" },
	{ pattern: /\b5\s*[:/x×]\s*4\b/i, ratio: "5:4" },
	{ pattern: /\b4\s*[:/x×]\s*3\b/i, ratio: "4:3" },
	{ pattern: /\b3\s*[:/x×]\s*4\b/i, ratio: "3:4" },
	{ pattern: /\b3\s*[:/x×]\s*2\b/i, ratio: "3:2" },
	{ pattern: /\b2\s*[:/x×]\s*3\b/i, ratio: "2:3" },
	{ pattern: /\b1\s*[:/x×]\s*1\b/i, ratio: "1:1" },

	// ── Panorama / ultra-wide ─────────────────────────────────────
	{ pattern: /panorama/i, ratio: "21:9" },
	{ pattern: /พาโนรามา/i, ratio: "21:9" },
	{ pattern: /ultra[\s-]?wide/i, ratio: "21:9" },
	{ pattern: /อัลตร้าไวด์/i, ratio: "21:9" },

	// ── Story / สตอรี่ (vertical 9:16) ────────────────────────────
	{ pattern: /\bstory\b/i, ratio: "9:16" },
	{ pattern: /\bstories\b/i, ratio: "9:16" },
	{ pattern: /สตอรี่/i, ratio: "9:16" },
	{ pattern: /รูปสตอรี่/i, ratio: "9:16" },
	{ pattern: /\breels?\b/i, ratio: "9:16" },
	{ pattern: /\btiktok\b/i, ratio: "9:16" },

	// ── Wallpaper / วอลเปเปอร์ (landscape 16:9) ──────────────────
	{ pattern: /wallpaper/i, ratio: "16:9" },
	{ pattern: /วอลเปเปอร์/i, ratio: "16:9" },
	{ pattern: /วอลล์เปเปอร์/i, ratio: "16:9" },
	{ pattern: /desktop\s*background/i, ratio: "16:9" },
	{ pattern: /พื้นหลังเดสก์ท็อป/i, ratio: "16:9" },

	// ── Widescreen / landscape ────────────────────────────────────
	{ pattern: /widescreen/i, ratio: "16:9" },
	{ pattern: /ไวด์สกรีน/i, ratio: "16:9" },
	{ pattern: /\blandscape\b/i, ratio: "16:9" },
	{ pattern: /แนวนอน/i, ratio: "16:9" },
	{ pattern: /แลนด์สเคป/i, ratio: "16:9" },

	// ── Portrait / vertical ───────────────────────────────────────
	{ pattern: /\bportrait\b/i, ratio: "9:16" },
	{ pattern: /แนวตั้ง/i, ratio: "9:16" },
	{ pattern: /พอร์ตเทรต/i, ratio: "9:16" },
	{ pattern: /\bvertical\b/i, ratio: "9:16" },

	// ── Square / สี่เหลี่ยมจัตุรัส ───────────────────────────────
	{ pattern: /\bsquare\b/i, ratio: "1:1" },
	{ pattern: /สี่เหลี่ยมจัตุรัส/i, ratio: "1:1" },
	{ pattern: /จตุรัส/i, ratio: "1:1" },
]

/**
 * Detect the desired aspect ratio from a user prompt.
 *
 * @param prompt - The user's image generation prompt (may contain Thai or English).
 * @returns The detected {@link AspectRatio}, or `"1:1"` when no pattern matches.
 *
 * @example
 * ```ts
 * detectAspectRatio("สร้างรูปฮัสกี้แนวนอน")   // "16:9"
 * detectAspectRatio("Generate a 9:16 poster")  // "9:16"
 * detectAspectRatio("cute cat")                 // "1:1"
 * ```
 */
export function detectAspectRatio(prompt: string): AspectRatio {
	if (!prompt || typeof prompt !== "string") {
		return DEFAULT_ASPECT_RATIO
	}

	for (const rule of RATIO_RULES) {
		if (rule.pattern.test(prompt)) {
			return rule.ratio
		}
	}

	return DEFAULT_ASPECT_RATIO
}
