import type { ProviderSettings } from "@roo-code/types"

import { singleCompletionHandler } from "../../../utils/single-completion-handler"

/**
 * Router result for Gemini image model selection.
 */
type GeminiImageModelId = "google/gemini-2.5-flash-image" | "google/gemini-3.1-flash-image-preview"

export interface GeminiRouterResult {
	model: GeminiImageModelId
	reason: string
	requiresThaiText: boolean
	complexity: "simple" | "complex"
	aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "9:21" | "21:9"
}

const GEMINI_25_IMAGE_MODEL = "google/gemini-2.5-flash-image" as const
const GEMINI_31_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview" as const

const CLASSIFIER_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "9:21", "21:9"] as const
type ClassifierAspectRatio = (typeof CLASSIFIER_ASPECT_RATIOS)[number]
const CLASSIFIER_ASPECT_RATIO_SET = new Set<ClassifierAspectRatio>(CLASSIFIER_ASPECT_RATIOS)

const FALLBACK_RESULT: GeminiRouterResult = {
	model: GEMINI_25_IMAGE_MODEL,
	reason: "LLM classification failed, using default",
	requiresThaiText: false,
	complexity: "simple",
	aspectRatio: "16:9",
}

interface GeminiImageClassifierResponse {
	requiresThaiText: boolean
	complexity: "simple" | "complex"
	aspectRatio: GeminiRouterResult["aspectRatio"]
	reason: string
}

function normalizeAspectRatio(value: string): GeminiRouterResult["aspectRatio"] {
	return CLASSIFIER_ASPECT_RATIO_SET.has(value as ClassifierAspectRatio)
		? (value as GeminiRouterResult["aspectRatio"])
		: "16:9"
}

function buildGeminiImageClassifierPrompt(prompt: string, hasInputImage: boolean): string {
	return `You are a classifier for image generation requests. Analyze the user's prompt and return a JSON object with these fields:

1. "requiresThaiText": boolean - true if the prompt requires Thai text/characters to be rendered IN the generated image (e.g., Thai slides, Thai banners, Thai text overlay). Note: a prompt written in Thai that asks for a general image (like "วาดรูปแมว" = draw a cat) should return false because no Thai text needs to appear in the image.

2. "complexity": "simple" | "complex" - "complex" if the prompt involves multiple elements, detailed layouts, infographics, multi-section designs, or intricate instructions. "simple" for straightforward single-subject requests.

3. "aspectRatio": one of "1:1", "3:4", "4:3", "9:16", "16:9", "9:21", "21:9" - the best aspect ratio for the requested image. Consider:
   - Slides/presentations → "16:9"
   - Phone wallpaper/stories → "9:16"
   - Social media posts → "1:1"
   - Portraits → "3:4" or "9:16"
   - Landscapes/banners → "16:9" or "21:9"
   - Default if unclear → "16:9"

4. "reason": string - brief explanation of your classification

Input image provided: ${hasInputImage ? "yes" : "no"}

Return ONLY valid JSON, no other text.

User's image generation prompt: ${JSON.stringify(prompt)}`
}

function parseGeminiClassifierResponse(responseText: string): GeminiImageClassifierResponse | null {
	const normalizedResponse = responseText?.trim()
	if (!normalizedResponse) {
		return null
	}

	const withoutCodeFence = normalizedResponse
		.replace(/^```json\s*/i, "")
		.replace(/^```\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim()

	const jsonCandidate = withoutCodeFence.match(/\{[\s\S]*\}/)?.[0] ?? withoutCodeFence

	try {
		const parsed = JSON.parse(jsonCandidate) as Partial<GeminiImageClassifierResponse>

		if (typeof parsed.requiresThaiText !== "boolean") {
			return null
		}
		if (parsed.complexity !== "simple" && parsed.complexity !== "complex") {
			return null
		}
		if (typeof parsed.aspectRatio !== "string") {
			return null
		}

		return {
			requiresThaiText: parsed.requiresThaiText,
			complexity: parsed.complexity,
			aspectRatio: normalizeAspectRatio(parsed.aspectRatio),
			reason:
				typeof parsed.reason === "string" && parsed.reason.trim().length > 0
					? parsed.reason.trim()
					: "LLM classifier completed.",
		}
	} catch {
		return null
	}
}

function createResolvedRouterResult(result: GeminiRouterResult): Promise<GeminiRouterResult> {
	return Object.assign(Promise.resolve(result), result)
}

/**
 * Use the current chat model to analyze an image-generation prompt and decide:
 * 1) model routing, 2) complexity for thinking level, and 3) aspect ratio.
 *
 * If no API configuration is provided, or if LLM classification cannot run,
 * this function falls back to the default Gemini 2.5 routing result.
 */
export function routeGeminiImageModel(
	prompt: string,
	apiConfiguration?: ProviderSettings,
	inputImage?: string,
): Promise<GeminiRouterResult> {
	if (!apiConfiguration) {
		return createResolvedRouterResult(FALLBACK_RESULT)
	}

	const llmRoutePromise = (async (): Promise<GeminiRouterResult> => {
		try {
			const classifierPrompt = buildGeminiImageClassifierPrompt(prompt, Boolean(inputImage))
			const classifierResponse = await singleCompletionHandler(apiConfiguration, classifierPrompt)
			const parsedResponse = parseGeminiClassifierResponse(classifierResponse)

			if (!parsedResponse) {
				return FALLBACK_RESULT
			}

			return {
				model: parsedResponse.requiresThaiText ? GEMINI_31_IMAGE_MODEL : GEMINI_25_IMAGE_MODEL,
				reason: parsedResponse.reason,
				requiresThaiText: parsedResponse.requiresThaiText,
				complexity: parsedResponse.complexity,
				aspectRatio: parsedResponse.aspectRatio,
			}
		} catch {
			return FALLBACK_RESULT
		}
	})()

	return Object.assign(llmRoutePromise, FALLBACK_RESULT)
}
