import type { ProviderSettings } from "@roo-code/types"

import { t } from "../../../i18n"
import * as aspectRatioDetection from "./aspect-ratio-detection"
import { routeGeminiImageModel } from "./gemini-image-router"

// Image generation types
interface ImageGenerationResponse {
	choices?: Array<{
		message?: {
			content?: string
			images?: Array<{
				type?: string
				image_url?: {
					url?: string
				}
			}>
		}
	}>
	error?: {
		message?: string
		type?: string
		code?: string
	}
}

interface ImagesApiResponse {
	data?: Array<{
		b64_json?: string
		url?: string
	}>
	error?: {
		message?: string
		type?: string
		code?: string
	}
}

export interface ImageGenerationResult {
	success: boolean
	imageData?: string
	imageFormat?: string
	error?: string
}

interface ImageGenerationOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
	inputImage?: string
}

interface ImagesApiOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
	inputImage?: string
	size?: string
	quality?: string
	outputFormat?: string
}

/**
 * Shared image generation implementation for OpenRouter and Roo Code Cloud providers
 */
export async function generateImageWithProvider(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage } = options

	try {
		const response = await fetch(`${baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Code",
				"X-Title": "Roo Code",
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "user",
						content: inputImage
							? [
									{
										type: "text",
										text: prompt,
									},
									{
										type: "image_url",
										image_url: {
											url: inputImage,
										},
									},
								]
							: prompt,
					},
				],
				modalities: ["image", "text"],
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				if (errorJson.error?.message) {
					errorMessage = t("tools:generateImage.failedWithMessage", {
						message: errorJson.error.message,
					})
				}
			} catch {
				// Use default error message
			}
			return {
				success: false,
				error: errorMessage,
			}
		}

		const result: ImageGenerationResponse = await response.json()

		if (result.error) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", {
					message: result.error.message,
				}),
			}
		}

		// Extract the generated image from the response
		const images = result.choices?.[0]?.message?.images
		if (!images || images.length === 0) {
			return {
				success: false,
				error: t("tools:generateImage.noImageGenerated"),
			}
		}

		const imageData = images[0]?.image_url?.url
		if (!imageData) {
			return {
				success: false,
				error: t("tools:generateImage.invalidImageData"),
			}
		}

		// Extract base64 data from data URL
		const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
		if (!base64Match) {
			return {
				success: false,
				error: t("tools:generateImage.invalidImageFormat"),
			}
		}

		return {
			success: true,
			imageData: imageData,
			imageFormat: base64Match[1],
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}

/**
 * LiteLLM-specific image generation options
 */
interface LiteLLMImageGenerationOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
	inputImage?: string
	apiConfiguration?: ProviderSettings
}

type AspectRatio = ReturnType<typeof aspectRatioDetection.detectAspectRatio>

const LITELLM_GEMINI_AUTO_ROUTER_MODEL = "gemini-image-auto-router"
const GEMINI_25_IMAGE_MODEL = "google/gemini-2.5-flash-image"
const GEMINI_31_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview"

function isGemini31ImageModel(modelId: string): boolean {
	return modelId === GEMINI_31_IMAGE_MODEL
}

function buildLiteLLMUserContent(prompt: string, inputImage?: string): string | Array<Record<string, unknown>> {
	if (!inputImage) {
		return prompt
	}

	return [
		{ type: "text", text: prompt },
		{ type: "image_url", image_url: { url: inputImage } },
	]
}

function resolveLiteLLMAspectRatio(prompt: string, inputImage?: string): AspectRatio {
	// Always call detectAspectRatio for backward-compatibility with existing mocks/callers.
	const promptDetectedRatio = aspectRatioDetection.detectAspectRatio(prompt)
	let aspectRatio: AspectRatio = promptDetectedRatio

	// Determine aspect ratio with priority:
	// 1) user-specified in prompt
	// 2) detected from input image
	// 3) default (16:9)
	// If explicit detector exports are unavailable (e.g. partial test mocks),
	// fallback to detectAspectRatio(prompt) behavior.
	if (Object.prototype.hasOwnProperty.call(aspectRatioDetection, "detectExplicitAspectRatio")) {
		const detectionModule = aspectRatioDetection as unknown as {
			detectExplicitAspectRatio: (value: string) => AspectRatio | null
			detectAspectRatioFromImage?: (value: string) => AspectRatio
			DEFAULT_ASPECT_RATIO?: AspectRatio
		}

		const explicitRatio = detectionModule.detectExplicitAspectRatio(prompt)

		if (explicitRatio) {
			aspectRatio = explicitRatio
		} else if (inputImage && detectionModule.detectAspectRatioFromImage) {
			aspectRatio = detectionModule.detectAspectRatioFromImage(inputImage)
		} else {
			aspectRatio = detectionModule.DEFAULT_ASPECT_RATIO ?? ("16:9" as AspectRatio)
		}
	}

	return aspectRatio
}

/**
 * Generate an image using LiteLLM's chat completions endpoint.
 *
 * For `gemini-image-auto-router`, request routing behavior is:
 * - With `apiConfiguration`: use LLM-based classifier for model/complexity/aspect-ratio.
 * - Without `apiConfiguration` (or when classifier fails): fallback to default Gemini 2.5 routing.
 *
 * Payload routing:
 * - `google/gemini-2.5-flash-image`: uses `image_config.aspect_ratio`
 * - `google/gemini-3.1-flash-image-preview`: uses `tools` + `imageConfig` + `thinkingConfig`
 *
 * The response may contain images in two formats:
 *   1. `choices[0].message.images[].image_url.url`  (OpenRouter style)
 *   2. `choices[0].message.content` as array with `{ type: "image_url", image_url: { url } }` blocks
 */
export async function generateImageWithLiteLLM(options: LiteLLMImageGenerationOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage, apiConfiguration } = options
	const userContent = buildLiteLLMUserContent(prompt, inputImage)

	let effectiveModel = model
	let routerResult: Awaited<ReturnType<typeof routeGeminiImageModel>> | undefined
	let shouldUseRouterAspectRatio = false

	try {
		if (model === LITELLM_GEMINI_AUTO_ROUTER_MODEL) {
			if (apiConfiguration) {
				routerResult = await routeGeminiImageModel(prompt, apiConfiguration, inputImage)
				shouldUseRouterAspectRatio = true
			} else {
				routerResult = await routeGeminiImageModel(prompt, undefined, inputImage)
			}

			effectiveModel = routerResult.model
		}

		const requestBody: Record<string, unknown> = isGemini31ImageModel(effectiveModel)
			? {
					model: effectiveModel,
					messages: [
						{
							role: "user",
							content: userContent,
						},
					],
					modalities: ["text", "image"],
					stream: false,
					tools: [
						{
							googleSearch: {
								searchTypes: {
									webSearch: {},
									imageSearch: {},
								},
							},
						},
					],
					imageConfig: {
						imageSize: "1K",
					},
					thinkingConfig: {
						thinkingLevel: routerResult?.complexity === "complex" ? "HIGH" : "MINIMAL",
					},
				}
			: {
					model: effectiveModel,
					messages: [
						{
							role: "user",
							content: userContent,
						},
					],
					temperature: 1,
					modalities: ["image", "text"],
					image_config: {
						aspect_ratio: shouldUseRouterAspectRatio
							? (routerResult?.aspectRatio ?? "16:9")
							: resolveLiteLLMAspectRatio(prompt, inputImage),
					},
					stream: false,
					stream_options: {
						include_usage: true,
					},
				}

		const response = await fetch(`${baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		})

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				if (errorJson.error?.message) {
					errorMessage = t("tools:generateImage.failedWithMessage", {
						message: errorJson.error.message,
					})
				}
			} catch {
				// Use default error message
			}
			return { success: false, error: errorMessage }
		}

		const result = await response.json()

		if (result.error) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", { message: result.error.message }),
			}
		}

		// Try extracting image from multiple response formats
		const imageData = extractImageFromLiteLLMResponse(result)
		if (!imageData) {
			return { success: false, error: t("tools:generateImage.noImageGenerated") }
		}

		// Validate base64 data URL format
		const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/)
		if (!base64Match) {
			return { success: false, error: t("tools:generateImage.invalidImageFormat") }
		}

		return {
			success: true,
			imageData,
			imageFormat: base64Match[1],
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}

/**
 * Extract image data URL from a LiteLLM response.
 *
 * Handles two known response shapes:
 *   1. `choices[0].message.images[0].image_url.url`
 *   2. `choices[0].message.content` being an array containing
 *      `{ type: "image_url", image_url: { url: "data:image/..." } }` blocks
 */
function extractImageFromLiteLLMResponse(result: any): string | undefined {
	const message = result?.choices?.[0]?.message
	if (!message) {
		return undefined
	}

	// Format 1: message.images array (OpenRouter / some LiteLLM configs)
	if (Array.isArray(message.images) && message.images.length > 0) {
		const url = message.images[0]?.image_url?.url
		if (url) {
			return url
		}
	}

	// Format 2: message.content is an array of content blocks
	if (Array.isArray(message.content)) {
		for (const block of message.content) {
			if (block.type === "image_url" && block.image_url?.url) {
				return block.image_url.url
			}
		}
	}

	// Format 3: message.content is a string that is itself a data URL
	if (typeof message.content === "string" && message.content.startsWith("data:image/")) {
		return message.content
	}

	return undefined
}

/**
 * Generate an image using OpenAI's Images API (/v1/images/generations)
 * Supports BFL models (Flux) with provider-specific options for image editing
 */
export async function generateImageWithImagesApi(options: ImagesApiOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage, outputFormat = "png" } = options

	try {
		const url = `${baseURL}/images/generations`

		// Build the request body
		// For BFL models, inputImage is passed via providerOptions.blackForestLabs.inputImage
		const requestBody: Record<string, unknown> = {
			model,
			prompt,
			n: 1,
		}

		// Add optional parameters
		if (options.size) {
			requestBody.size = options.size
		}
		if (options.quality) {
			requestBody.quality = options.quality
		}

		// For BFL (Black Forest Labs) models like flux-pro-1.1, use providerOptions
		if (model.startsWith("bfl/")) {
			requestBody.providerOptions = {
				blackForestLabs: {
					outputFormat: outputFormat,
					// inputImage: Base64 encoded image or URL of image to use as reference
					...(inputImage && { inputImage }),
				},
			}
		} else {
			// For other models, use standard output_format parameter
			requestBody.output_format = outputFormat
		}

		const fetchOptions: RequestInit = {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Code",
				"X-Title": "Roo Code",
			},
			body: JSON.stringify(requestBody),
		}

		const response = await fetch(url, fetchOptions)

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				if (errorJson.error?.message) {
					errorMessage = t("tools:generateImage.failedWithMessage", {
						message: errorJson.error.message,
					})
				}
			} catch {
				// Use default error message
			}
			return {
				success: false,
				error: errorMessage,
			}
		}

		const result: ImagesApiResponse = await response.json()

		if (result.error) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", {
					message: result.error.message,
				}),
			}
		}

		// Extract the generated image from the response
		const images = result.data
		if (!images || images.length === 0) {
			return {
				success: false,
				error: t("tools:generateImage.noImageGenerated"),
			}
		}

		const imageItem = images[0]

		// Handle b64_json response (most common)
		if (imageItem?.b64_json) {
			// Convert base64 to data URL
			const dataUrl = `data:image/${outputFormat};base64,${imageItem.b64_json}`
			return {
				success: true,
				imageData: dataUrl,
				imageFormat: outputFormat,
			}
		}

		// Handle URL response (fallback)
		if (imageItem?.url) {
			// If it's already a data URL, use it directly
			if (imageItem.url.startsWith("data:image/")) {
				const formatMatch = imageItem.url.match(/^data:image\/(\w+);/)
				const format = formatMatch?.[1] || outputFormat
				return {
					success: true,
					imageData: imageItem.url,
					imageFormat: format,
				}
			}
			// For external URLs, return as-is (the caller will need to handle fetching)
			return {
				success: true,
				imageData: imageItem.url,
				imageFormat: outputFormat,
			}
		}

		return {
			success: false,
			error: t("tools:generateImage.invalidImageData"),
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}
