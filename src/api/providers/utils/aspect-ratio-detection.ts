/**
 * Aspect ratio detection utility for LiteLLM image generation.
 *
 * Detects desired aspect ratio from:
 * 1. User prompt keywords / explicit ratio text
 * 2. Input image dimensions (for image editing)
 */
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

export const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9"

/**
 * Mapping from keyword / phrase → aspect ratio.
 * Order matters: more-specific patterns are checked first via the
 * ordered array below so that e.g. "ultra-wide" wins over "wide".
 */
interface RatioRule {
	pattern: RegExp
	ratio: AspectRatio
}

interface ImageDimensions {
	width: number
	height: number
}

interface ParsedImageDataUrl {
	mimeType: string
	data: Buffer
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

const JPEG_SOF_MARKERS = new Set<number>([
	0xc0, // Baseline DCT
	0xc1, // Extended sequential DCT
	0xc2, // Progressive DCT
	0xc3, // Lossless sequential
	0xc5,
	0xc6,
	0xc7,
	0xc9,
	0xca,
	0xcb,
	0xcd,
	0xce,
	0xcf,
])

function parseBase64ImageDataUrl(base64DataUrl: string): ParsedImageDataUrl | null {
	if (!base64DataUrl || typeof base64DataUrl !== "string") {
		return null
	}

	const dataUrlMatch = base64DataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/i)
	if (!dataUrlMatch) {
		return null
	}

	const mimeType = dataUrlMatch[1].toLowerCase()
	const base64Payload = dataUrlMatch[2].replace(/\s+/g, "")
	if (!base64Payload) {
		return null
	}

	try {
		const data = Buffer.from(base64Payload, "base64")
		if (data.length === 0) {
			return null
		}
		return { mimeType, data }
	} catch {
		return null
	}
}

function parsePngDimensions(data: Buffer): ImageDimensions | null {
	if (data.length < 24) {
		return null
	}

	// PNG signature: 89 50 4E 47 0D 0A 1A 0A
	const isPng =
		data[0] === 0x89 &&
		data[1] === 0x50 &&
		data[2] === 0x4e &&
		data[3] === 0x47 &&
		data[4] === 0x0d &&
		data[5] === 0x0a &&
		data[6] === 0x1a &&
		data[7] === 0x0a

	if (!isPng) {
		return null
	}

	const width = data.readUInt32BE(16)
	const height = data.readUInt32BE(20)

	if (width <= 0 || height <= 0) {
		return null
	}

	return { width, height }
}

function parseJpegDimensions(data: Buffer): ImageDimensions | null {
	// JPEG starts with FF D8
	if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
		return null
	}

	let offset = 2

	while (offset < data.length) {
		// Find marker prefix (FF)
		while (offset < data.length && data[offset] !== 0xff) {
			offset += 1
		}
		if (offset >= data.length) {
			break
		}

		// Skip fill bytes (multiple FF)
		while (offset < data.length && data[offset] === 0xff) {
			offset += 1
		}
		if (offset >= data.length) {
			break
		}

		const marker = data[offset]
		offset += 1

		// Standalone markers without segment length
		if (marker === 0x01 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
			continue
		}

		if (offset + 1 >= data.length) {
			break
		}

		const segmentLength = data.readUInt16BE(offset)
		if (segmentLength < 2) {
			break
		}

		const segmentDataOffset = offset + 2
		const segmentEndOffset = offset + segmentLength
		if (segmentEndOffset > data.length) {
			break
		}

		if (JPEG_SOF_MARKERS.has(marker) && segmentLength >= 7 && segmentDataOffset + 5 <= data.length) {
			// SOF segment payload:
			// [0] precision, [1..2] height, [3..4] width, ...
			const height = data.readUInt16BE(segmentDataOffset + 1)
			const width = data.readUInt16BE(segmentDataOffset + 3)

			if (width > 0 && height > 0) {
				return { width, height }
			}
		}

		offset = segmentEndOffset
	}

	return null
}

function parseGifDimensions(data: Buffer): ImageDimensions | null {
	if (data.length < 10) {
		return null
	}

	const signature = data.toString("ascii", 0, 6)
	if (signature !== "GIF87a" && signature !== "GIF89a") {
		return null
	}

	const width = data.readUInt16LE(6)
	const height = data.readUInt16LE(8)

	if (width <= 0 || height <= 0) {
		return null
	}

	return { width, height }
}

function parseWebPDimensions(data: Buffer): ImageDimensions | null {
	if (data.length < 16) {
		return null
	}

	// RIFF....WEBP
	if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") {
		return null
	}

	let offset = 12

	while (offset + 8 <= data.length) {
		const chunkType = data.toString("ascii", offset, offset + 4)
		const chunkSize = data.readUInt32LE(offset + 4)
		const chunkDataOffset = offset + 8
		const chunkDataEndOffset = chunkDataOffset + chunkSize

		if (chunkDataEndOffset > data.length) {
			break
		}

		if (chunkType === "VP8X" && chunkSize >= 10) {
			const widthMinusOne =
				data[chunkDataOffset + 4] | (data[chunkDataOffset + 5] << 8) | (data[chunkDataOffset + 6] << 16)
			const heightMinusOne =
				data[chunkDataOffset + 7] | (data[chunkDataOffset + 8] << 8) | (data[chunkDataOffset + 9] << 16)

			const width = widthMinusOne + 1
			const height = heightMinusOne + 1

			if (width > 0 && height > 0) {
				return { width, height }
			}
		}

		if (chunkType === "VP8L" && chunkSize >= 5 && data[chunkDataOffset] === 0x2f) {
			const b0 = data[chunkDataOffset + 1]
			const b1 = data[chunkDataOffset + 2]
			const b2 = data[chunkDataOffset + 3]
			const b3 = data[chunkDataOffset + 4]

			const width = 1 + (((b1 & 0x3f) << 8) | b0)
			const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))

			if (width > 0 && height > 0) {
				return { width, height }
			}
		}

		if (chunkType === "VP8 " && chunkSize >= 10) {
			// Frame header start code: 9D 01 2A
			if (
				data[chunkDataOffset + 3] === 0x9d &&
				data[chunkDataOffset + 4] === 0x01 &&
				data[chunkDataOffset + 5] === 0x2a
			) {
				const width = data.readUInt16LE(chunkDataOffset + 6) & 0x3fff
				const height = data.readUInt16LE(chunkDataOffset + 8) & 0x3fff

				if (width > 0 && height > 0) {
					return { width, height }
				}
			}
		}

		// Chunks are padded to even sizes
		offset = chunkDataEndOffset + (chunkSize % 2)
	}

	return null
}

function getImageDimensions(data: Buffer, mimeType: string): ImageDimensions | null {
	const preferredParsers: Array<(input: Buffer) => ImageDimensions | null> = []

	if (mimeType.includes("png")) {
		preferredParsers.push(parsePngDimensions)
	}
	if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
		preferredParsers.push(parseJpegDimensions)
	}
	if (mimeType.includes("gif")) {
		preferredParsers.push(parseGifDimensions)
	}
	if (mimeType.includes("webp")) {
		preferredParsers.push(parseWebPDimensions)
	}

	for (const parser of preferredParsers) {
		const dimensions = parser(data)
		if (dimensions) {
			return dimensions
		}
	}

	// Fallback by probing all supported formats
	const fallbackParsers = [parsePngDimensions, parseJpegDimensions, parseGifDimensions, parseWebPDimensions]
	for (const parser of fallbackParsers) {
		const dimensions = parser(data)
		if (dimensions) {
			return dimensions
		}
	}

	return null
}

function ratioToNumber(ratio: AspectRatio): number {
	const [width, height] = ratio.split(":").map(Number)
	return width / height
}

function getClosestSupportedAspectRatio(actualRatio: number): AspectRatio {
	let closestRatio = DEFAULT_ASPECT_RATIO
	let smallestDifference = Number.POSITIVE_INFINITY

	for (const candidate of SUPPORTED_ASPECT_RATIOS) {
		const difference = Math.abs(ratioToNumber(candidate) - actualRatio)

		if (difference < smallestDifference) {
			smallestDifference = difference
			closestRatio = candidate
		}
	}

	return closestRatio
}

/**
 * Detect an explicitly requested aspect ratio from a prompt.
 *
 * @param prompt - The user's image generation prompt.
 * @returns The detected {@link AspectRatio}, or `null` if no rule matches.
 */
export function detectExplicitAspectRatio(prompt: string): AspectRatio | null {
	if (!prompt || typeof prompt !== "string") {
		return null
	}

	for (const rule of RATIO_RULES) {
		if (rule.pattern.test(prompt)) {
			return rule.ratio
		}
	}

	return null
}

/**
 * Detect the desired aspect ratio from a user prompt.
 *
 * Backward-compatible wrapper around {@link detectExplicitAspectRatio} that
 * falls back to {@link DEFAULT_ASPECT_RATIO}.
 */
export function detectAspectRatio(prompt: string): AspectRatio {
	return detectExplicitAspectRatio(prompt) ?? DEFAULT_ASPECT_RATIO
}

/**
 * Detect the closest supported aspect ratio from an input image data URL.
 *
 * Supports PNG, JPEG, GIF, and WebP header parsing.
 * Returns {@link DEFAULT_ASPECT_RATIO} when parsing fails.
 */
export function detectAspectRatioFromImage(base64DataUrl: string): AspectRatio {
	const parsedDataUrl = parseBase64ImageDataUrl(base64DataUrl)
	if (!parsedDataUrl) {
		return DEFAULT_ASPECT_RATIO
	}

	const dimensions = getImageDimensions(parsedDataUrl.data, parsedDataUrl.mimeType)
	if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
		return DEFAULT_ASPECT_RATIO
	}

	const actualRatio = dimensions.width / dimensions.height
	if (!Number.isFinite(actualRatio) || actualRatio <= 0) {
		return DEFAULT_ASPECT_RATIO
	}

	return getClosestSupportedAspectRatio(actualRatio)
}
