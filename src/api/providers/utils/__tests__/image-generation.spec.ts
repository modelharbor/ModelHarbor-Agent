import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { generateImageWithImagesApi, generateImageWithLiteLLM, generateImageWithProvider } from "../image-generation"

// Mock the i18n module
vi.mock("../../../i18n", () => ({
	t: (key: string, options?: any) => {
		// Return a sensible mock for i18n
		if (key === "tools:generateImage.failedWithMessage" && options?.message) {
			return options.message
		}
		if (key === "tools:generateImage.failedWithStatus" && options?.status) {
			return `Failed with status ${options.status}: ${options.statusText}`
		}
		return key
	},
}))

// Mock aspect-ratio-detection
vi.mock("../aspect-ratio-detection", () => ({
	detectAspectRatio: vi.fn().mockReturnValue("1:1"),
}))

// Mock fetch globally
global.fetch = vi.fn()
global.FormData = vi.fn(() => ({
	append: vi.fn(),
})) as any
global.Blob = vi.fn() as any
global.atob = vi.fn((str: string) => {
	return Buffer.from(str, "base64").toString("binary")
})

describe("generateImageWithImagesApi", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("image generation (text-to-image)", () => {
		it("should successfully generate an image", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				outputFormat: "png",
			})

			expect(result.success).toBe(true)
			expect(result.imageData).toContain("data:image/png;base64,")
			expect(result.imageFormat).toBe("png")

			// Verify fetch was called with correct parameters
			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.example.com/v1/images/generations",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"Content-Type": "application/json",
					}),
				}),
			)
		})

		it("should handle API errors gracefully", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: vi.fn().mockResolvedValue("{}"),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle missing image data in response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{}], // Missing b64_json and url
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle URL response instead of b64_json", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ url: "data:image/png;base64,iVBORw0KGgo=" }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(true)
			expect(result.imageData).toBe("data:image/png;base64,iVBORw0KGgo=")
			expect(result.imageFormat).toBe("png")
		})

		it("should handle external URL response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ url: "https://example.com/generated-image.png" }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				outputFormat: "png",
			})

			expect(result.success).toBe(true)
			expect(result.imageData).toBe("https://example.com/generated-image.png")
			expect(result.imageFormat).toBe("png")
		})

		it("should handle empty data array in response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle API error response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					error: {
						message: "Rate limit exceeded",
						type: "rate_limit_error",
					},
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should include optional parameters when provided", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				size: "1024x1024",
				quality: "hd",
				outputFormat: "png",
			})

			expect(result.success).toBe(true)

			// Verify fetch was called with optional parameters
			const callArgs = vi.mocked(global.fetch).mock.calls[0]
			const body = JSON.parse(callArgs[1]?.body as string)
			expect(body.size).toBe("1024x1024")
			expect(body.quality).toBe("hd")
		})

		it("should handle network errors", async () => {
			vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"))

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain("Network error")
		})
	})

	describe("image editing", () => {
		it("should use /images/generations endpoint with inputImage in request body", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const inputImageDataUrl = `data:image/png;base64,${mockBase64}`

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "Make it blue",
				inputImage: inputImageDataUrl,
				outputFormat: "png",
			})

			expect(result.success).toBe(true)

			// Verify /images/generations endpoint was used (not /images/edits)
			const callUrl = vi.mocked(global.fetch).mock.calls[0][0]
			expect(callUrl).toContain("/images/generations")
		})

		it("should handle edit operation errors", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: vi.fn().mockResolvedValue("{}"),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const inputImageDataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "Make it blue",
				inputImage: inputImageDataUrl,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})
	})

	describe("output format handling", () => {
		it("should use png format by default", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.imageFormat).toBe("png")
			expect(result.imageData).toContain("data:image/png;base64,")
		})

		it("should use specified output format", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				outputFormat: "jpeg",
			})

			expect(result.imageFormat).toBe("jpeg")
			expect(result.imageData).toContain("data:image/jpeg;base64,")
		})
	})
})

describe("generateImageWithLiteLLM", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should build correct request payload with model, modalities, and image_config", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [
								{
									image_url: {
										url: "data:image/png;base64,iVBORw0KGgo=",
									},
								},
							],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-litellm-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cute cat",
		})

		expect(global.fetch).toHaveBeenCalledWith(
			"http://localhost:4000/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-litellm-key",
					"Content-Type": "application/json",
				}),
			}),
		)

		const callArgs = vi.mocked(global.fetch).mock.calls[0]
		const body = JSON.parse(callArgs[1]?.body as string)

		expect(body.model).toBe("google/gemini-2.5-flash-image")
		expect(body.modalities).toEqual(["image", "text"])
		expect(body.temperature).toBe(1)
		expect(body.stream).toBe(false)
		expect(body.image_config).toEqual({ aspect_ratio: "1:1" })
		expect(body.messages).toHaveLength(1)
		expect(body.messages[0].role).toBe("user")
		expect(body.messages[0].content).toBe("A cute cat")
	})

	it("should detect aspect ratio from prompt and include in image_config", async () => {
		const { detectAspectRatio } = await import("../aspect-ratio-detection")
		vi.mocked(detectAspectRatio).mockReturnValue("16:9")

		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [{ image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } }],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A landscape wallpaper of mountains",
		})

		expect(detectAspectRatio).toHaveBeenCalledWith("A landscape wallpaper of mountains")

		const callArgs = vi.mocked(global.fetch).mock.calls[0]
		const body = JSON.parse(callArgs[1]?.body as string)
		expect(body.image_config.aspect_ratio).toBe("16:9")
	})

	it("should include input image in messages content as multipart array", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [{ image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } }],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const inputImageData = "data:image/png;base64,aW5wdXRJbWFnZURhdGE="

		await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "Make this image brighter",
			inputImage: inputImageData,
		})

		const callArgs = vi.mocked(global.fetch).mock.calls[0]
		const body = JSON.parse(callArgs[1]?.body as string)

		// When inputImage is provided, content should be an array
		expect(Array.isArray(body.messages[0].content)).toBe(true)
		expect(body.messages[0].content).toHaveLength(2)
		expect(body.messages[0].content[0]).toEqual({ type: "text", text: "Make this image brighter" })
		expect(body.messages[0].content[1]).toEqual({
			type: "image_url",
			image_url: { url: inputImageData },
		})
	})

	it("should extract image from format 1: message.images array", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [
								{
									image_url: {
										url: "data:image/png;base64,Zm9ybWF0MW RhdGE=",
									},
								},
							],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		expect(result.success).toBe(true)
		expect(result.imageData).toBe("data:image/png;base64,Zm9ybWF0MW RhdGE=")
		expect(result.imageFormat).toBe("png")
	})

	it("should extract image from format 2: message.content array with image_url blocks", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: [
								{ type: "text", text: "Here is your image" },
								{
									type: "image_url",
									image_url: { url: "data:image/jpeg;base64,Zm9ybWF0MmRhdGE=" },
								},
							],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A dog",
		})

		expect(result.success).toBe(true)
		expect(result.imageData).toBe("data:image/jpeg;base64,Zm9ybWF0MmRhdGE=")
		expect(result.imageFormat).toBe("jpeg")
	})

	it("should extract image from format 3: message.content as data URL string", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: "data:image/webp;base64,Zm9ybWF0M2RhdGE=",
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A bird",
		})

		expect(result.success).toBe(true)
		expect(result.imageData).toBe("data:image/webp;base64,Zm9ybWF0M2RhdGE=")
		expect(result.imageFormat).toBe("webp")
	})

	it("should return error when API responds with non-ok status", async () => {
		const mockResponse = {
			ok: false,
			status: 401,
			statusText: "Unauthorized",
			text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "Invalid API key" } })),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "bad-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})

	it("should return error when API responds with error in body", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				error: {
					message: "Model not supported",
					type: "invalid_request_error",
				},
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "invalid-model",
			prompt: "A cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})

	it("should return error when no image is found in response", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: "I cannot generate images",
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})

	it("should return error when image data is not a valid data URL", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [{ image_url: { url: "not-a-valid-data-url" } }],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})

	it("should handle network errors gracefully", async () => {
		vi.mocked(global.fetch).mockRejectedValue(new Error("Connection refused"))

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBe("Connection refused")
	})

	it("should not include OpenRouter-specific headers", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [{ image_url: { url: "data:image/png;base64,dGVzdA==" } }],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		const callArgs = vi.mocked(global.fetch).mock.calls[0]
		const headers = callArgs[1]?.headers as Record<string, string>

		// LiteLLM should NOT include OpenRouter-specific headers
		expect(headers["HTTP-Referer"]).toBeUndefined()
		expect(headers["X-Title"]).toBeUndefined()
	})

	it("should include stream_options with include_usage", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [{ image_url: { url: "data:image/png;base64,dGVzdA==" } }],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		const callArgs = vi.mocked(global.fetch).mock.calls[0]
		const body = JSON.parse(callArgs[1]?.body as string)
		expect(body.stream_options).toEqual({ include_usage: true })
	})

	it("should handle non-ok status with non-JSON error text", async () => {
		const mockResponse = {
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
			text: vi.fn().mockResolvedValue("Something went wrong"),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithLiteLLM({
			baseURL: "http://localhost:4000",
			authToken: "test-key",
			model: "google/gemini-2.5-flash-image",
			prompt: "A cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})
})

describe("generateImageWithProvider (chat completions)", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should use /chat/completions endpoint", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [
								{
									image_url: {
										url: "data:image/png;base64,iVBORw0KGgo=",
									},
								},
							],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithProvider({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "gpt-4-vision",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(true)

		// Verify /chat/completions endpoint was used
		const callUrl = vi.mocked(global.fetch).mock.calls[0][0]
		expect(callUrl).toContain("/chat/completions")
	})

	it("should handle missing images in response", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [{ message: { content: "No images" } }],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithProvider({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "gpt-4-vision",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})
})
