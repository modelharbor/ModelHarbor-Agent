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
					"anthropic/claude-sonnet-4-code": {
						maxTokens: 16384,
						contextWindow: 128000,
						supportsComputerUse: false,
						supportsImages: true,
						supportsPromptCache: false,
						inputPrice: 3.0,
						outputPrice: 15.0,
						description: "Anthropic Claude Sonnet 4 with advanced language understanding and generation.",
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
		expect(result.current.id).toBe("anthropic/claude-sonnet-4-code")
		expect(result.current.info).toBeUndefined() // No configuration means fallback to undefined
	})

	it("should use modelharbor provider with proper configuration", () => {
		const wrapper = createWrapper()
		const { result } = renderHook(() => useSelectedModel({ apiProvider: "modelharbor" }), { wrapper })

		expect(result.current.provider).toBe("modelharbor")
		expect(result.current.id).toBe("anthropic/claude-sonnet-4-code")
		expect(result.current.info).toEqual({
			maxTokens: 16384,
			contextWindow: 128000,
			supportsImages: true,
			supportsComputerUse: false,
			supportsPromptCache: false,
			inputPrice: 3.0,
			outputPrice: 15.0,
			description: "Anthropic Claude Sonnet 4 with advanced language understanding and generation.",
		})
	})

	it("should use custom model when specified for modelharbor", () => {
		const wrapper = createWrapper()
		const { result } = renderHook(
			() =>
				useSelectedModel({
					apiProvider: "modelharbor",
					modelharborModelId: "anthropic/claude-sonnet-4-code",
				}),
			{ wrapper },
		)

		expect(result.current.provider).toBe("modelharbor")
		expect(result.current.id).toBe("anthropic/claude-sonnet-4-code")
		expect(result.current.info).toEqual({
			maxTokens: 16384,
			contextWindow: 128000,
			supportsImages: true,
			supportsComputerUse: false,
			supportsPromptCache: false,
			inputPrice: 3.0,
			outputPrice: 15.0,
			description: "Anthropic Claude Sonnet 4 with advanced language understanding and generation.",
		})
	})
})
