import { routeGeminiImageModel } from "../gemini-image-router"
import { singleCompletionHandler } from "../../../../utils/single-completion-handler"

vi.mock("../../../../utils/single-completion-handler", () => ({
	singleCompletionHandler: vi.fn(),
}))

const mockApiConfiguration = {
	apiProvider: "openrouter",
} as any

const expectedFallbackResult = {
	model: "google/gemini-2.5-flash-image",
	reason: "LLM classification failed, using default",
	requiresThaiText: false,
	complexity: "simple",
	aspectRatio: "16:9",
} as const

describe("gemini-image-router", () => {
	describe("routeGeminiImageModel", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("uses LLM classification when apiConfiguration is provided and JSON is valid", async () => {
			const prompt = "create thai banner with text"
			vi.mocked(singleCompletionHandler).mockResolvedValueOnce(
				JSON.stringify({
					requiresThaiText: true,
					complexity: "complex",
					aspectRatio: "9:16",
					reason: "Thai text rendering requested",
				}),
			)

			const result = await routeGeminiImageModel(prompt, mockApiConfiguration)

			expect(singleCompletionHandler).toHaveBeenCalledTimes(1)
			expect(singleCompletionHandler).toHaveBeenCalledWith(mockApiConfiguration, expect.any(String))
			expect(vi.mocked(singleCompletionHandler).mock.calls[0][1]).toContain(prompt)

			expect(result).toMatchObject({
				model: "google/gemini-3.1-flash-image-preview",
				requiresThaiText: true,
				complexity: "complex",
				aspectRatio: "9:16",
				reason: "Thai text rendering requested",
			})
		})

		it("returns aspectRatio from LLM classifier result", async () => {
			vi.mocked(singleCompletionHandler).mockResolvedValueOnce(
				JSON.stringify({
					requiresThaiText: false,
					complexity: "simple",
					aspectRatio: "21:9",
					reason: "Cinematic wide scene",
				}),
			)

			const result = await routeGeminiImageModel("draw a cinematic skyline", mockApiConfiguration)

			expect(result.model).toBe("google/gemini-2.5-flash-image")
			expect(result.aspectRatio).toBe("21:9")
		})

		it("falls back to default values when LLM returns invalid JSON", async () => {
			vi.mocked(singleCompletionHandler).mockResolvedValueOnce('{"unexpected":"shape"}')

			const result = await routeGeminiImageModel("draw a cute cat", mockApiConfiguration)

			expect(result).toEqual(expectedFallbackResult)
		})

		it("falls back to default values when LLM call throws", async () => {
			vi.mocked(singleCompletionHandler).mockRejectedValueOnce(new Error("classifier unavailable"))

			const result = await routeGeminiImageModel("เขียนตัวอักษร 'สวัสดี' บนรูป", mockApiConfiguration)

			expect(singleCompletionHandler).toHaveBeenCalledTimes(1)
			expect(result).toEqual(expectedFallbackResult)
		})

		it("falls back to default values when apiConfiguration is not provided", async () => {
			const result = await routeGeminiImageModel("สร้างสไลด์หัวข้อ 'การศึกษาไทย'")

			expect(singleCompletionHandler).not.toHaveBeenCalled()
			expect(result).toEqual(expectedFallbackResult)
		})

		it("always includes a non-empty reason field", async () => {
			vi.mocked(singleCompletionHandler).mockResolvedValueOnce(
				JSON.stringify({
					requiresThaiText: false,
					complexity: "simple",
					aspectRatio: "16:9",
					reason: "LLM classifier completed.",
				}),
			)

			const llmResult = await routeGeminiImageModel("draw a cinematic skyline", mockApiConfiguration)
			const fallbackResult = await routeGeminiImageModel("draw a cute cat")

			expect(llmResult.reason.trim().length).toBeGreaterThan(0)
			expect(fallbackResult.reason.trim().length).toBeGreaterThan(0)
		})
	})
})
