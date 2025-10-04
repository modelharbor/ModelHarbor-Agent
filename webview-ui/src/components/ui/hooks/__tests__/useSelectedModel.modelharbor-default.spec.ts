// Test for ModelHarbor as default provider
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { Mock } from "vitest"

import { useSelectedModel } from "../useSelectedModel"
import { useRouterModels } from "../useRouterModels"
import { useOpenRouterModelProviders } from "../useOpenRouterModelProviders"

vi.mock("../useRouterModels")
vi.mock("../useOpenRouterModelProviders")

const mockUseRouterModels = useRouterModels as Mock<typeof useRouterModels>
const mockUseOpenRouterModelProviders = useOpenRouterModelProviders as Mock<typeof useOpenRouterModelProviders>

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	})
	return ({ children }: { children: React.ReactNode }) =>
		React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useSelectedModel - ModelHarbor as default", () => {
	beforeEach(() => {
		mockUseRouterModels.mockReturnValue({
			data: {
				openrouter: {},
				requesty: {},
				glama: {},
				unbound: {},
				litellm: {},
				"io-intelligence": {},
				modelharbor: {
					"glm-4.6": {
						maxTokens: 128000,
						contextWindow: 212720,
						supportsComputerUse: false,
						supportsImages: false,
						supportsPromptCache: false,
						inputPrice: 1.0,
						outputPrice: 5.0,
						description: "GLM 4.6 model with strong general-purpose capabilities and large context window.",
					},
					"qwen/qwen3-coder-480b-a35b-instruct": {
						maxTokens: 65536,
						contextWindow: 262000,
						supportsComputerUse: false,
						supportsImages: false,
						supportsPromptCache: false,
						inputPrice: 0.6,
						outputPrice: 1.8,
						description:
							"Qwen3 Coder model optimized for coding tasks with advanced reasoning capabilities.",
					},
				},
			},
			isLoading: false,
			isError: false,
		} as any)

		mockUseOpenRouterModelProviders.mockReturnValue({
			data: {},
			isLoading: false,
			isError: false,
		} as any)
	})

	it("should default to modelharbor provider when no configuration is provided", () => {
		const wrapper = createWrapper()
		const { result } = renderHook(() => useSelectedModel(), { wrapper })

		expect(result.current.provider).toBe("modelharbor")
		expect(result.current.id).toBe("glm-4.6")
		expect(result.current.info).toBeUndefined() // No configuration means fallback to undefined
	})

	it("should use modelharbor provider with proper configuration", () => {
		const wrapper = createWrapper()
		const { result } = renderHook(() => useSelectedModel({ apiProvider: "modelharbor" }), { wrapper })

		expect(result.current.provider).toBe("modelharbor")
		expect(result.current.id).toBe("glm-4.6")
		expect(result.current.info).toEqual({
			maxTokens: 128000,
			contextWindow: 212720,
			supportsImages: false,
			supportsComputerUse: false,
			supportsPromptCache: false,
			inputPrice: 1.0,
			outputPrice: 5.0,
			description: "GLM 4.6 model with strong general-purpose capabilities and large context window.",
		})
	})

	it("should use custom model when specified for modelharbor", () => {
		const wrapper = createWrapper()
		const { result } = renderHook(
			() =>
				useSelectedModel({
					apiProvider: "modelharbor",
					modelharborModelId: "qwen/qwen3-coder-480b-a35b-instruct",
				}),
			{ wrapper },
		)

		expect(result.current.provider).toBe("modelharbor")
		expect(result.current.id).toBe("qwen/qwen3-coder-480b-a35b-instruct")
		expect(result.current.info).toEqual({
			maxTokens: 65536,
			contextWindow: 262000,
			supportsImages: false,
			supportsComputerUse: false,
			supportsPromptCache: false,
			inputPrice: 0.6,
			outputPrice: 1.8,
			description: "Qwen3 Coder model optimized for coding tasks with advanced reasoning capabilities.",
		})
	})
})
