/**
 * Shared utility functions for inferring model capabilities from model names.
 * Used by both LiteLLM and ModelHarbor fetchers as a fallback when API fields are missing.
 */

/**
 * Determine if a model supports images based on its name (fallback when API fields are missing)
 */
export function inferImageSupport(modelName: string): boolean {
	// Models known to support vision/images
	const visionModelPatterns = [
		/claude.*(?:sonnet|opus|haiku)/i, // Anthropic Claude vision models
		/gpt-[45]/i, // OpenAI GPT-4 and GPT-5
		/gemini/i, // Google Gemini
		/vision/i, // Any model with "vision" in name
		/imagen/i, // Google Imagen
		/vl-/i, // Vision-Language models (like qwen/qwen3-vl)
		/multimodal/i, // Multimodal models
		/gpt4v/i, // GPT-4 Vision
		/omni/i, // Omni models (multimodal)
	]

	return visionModelPatterns.some((pattern) => pattern.test(modelName))
}
