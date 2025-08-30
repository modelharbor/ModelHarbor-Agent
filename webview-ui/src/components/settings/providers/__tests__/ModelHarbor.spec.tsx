import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ModelHarbor } from "../ModelHarbor"

let routerModelsMock = {
	data: {
		modelharbor: {
			"qwen/qwen3-coder-480b-a35b-instruct": {
				maxTokens: 65536,
				contextWindow: 262000,
				supportsImages: false,
				supportsPromptCache: false,
			},
		},
	} as any,
	isLoading: false,
	isError: false,
}
vi.mock("@src/components/ui/hooks/useRouterModels", () => ({
	useRouterModels: () => routerModelsMock,
}))

vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({
		provider: "modelharbor",
		id: "qwen/qwen3-coder-480b-a35b-instruct",
		info: {
			maxTokens: 65536,
			contextWindow: 262000,
			supportsImages: false,
			supportsPromptCache: false,
		},
		isLoading: false,
		isError: false,
	}),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: (props: any) => <div data-testid="mock-vscode-text-field" {...props} />,
	VSCodeLink: (props: any) => <a data-testid="mock-vscode-link" {...props} />,
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("ModelHarbor integration", () => {
	const queryClient = new QueryClient()

	const defaultApiConfiguration = {
		apiProvider: "modelharbor" as const,
		modelharborApiKey: "dummy-key",
		modelharborModelId: "",
	}

	// Remove fake timers to avoid interfering with React Query and async rendering
	it("renders ModelHarbor and shows the model picker button", async () => {
		await act(async () => {
			render(
				<QueryClientProvider client={queryClient}>
					<ModelHarbor apiConfiguration={defaultApiConfiguration} setApiConfigurationField={() => {}} />
				</QueryClientProvider>,
			)
		})
		expect(await screen.findByTestId("model-picker-button")).toBeInTheDocument()
	})

	it("updates model list when a routerModels message is received", async () => {
		let rerender: any
		await act(async () => {
			const renderResult = render(
				<QueryClientProvider client={queryClient}>
					<ModelHarbor apiConfiguration={defaultApiConfiguration} setApiConfigurationField={() => {}} />
				</QueryClientProvider>,
			)
			rerender = renderResult.rerender
		})

		// Model picker button should show the fallback model as selected
		const pickerButton = await screen.findByTestId("model-picker-button")
		expect(pickerButton.textContent).toContain("qwen/qwen3-coder-480b-a35b-instruct")

		// Open the model picker dropdown
		fireEvent.click(pickerButton)

		// Wait for dropdown animation (skip timer advance, rely on real timers)
		await act(async () => {})

		// Simulate routerModels message with new models
		const newModels = {
			modelA: { name: "Model A", description: "New Model A", maxTokens: 8192 },
			modelB: { name: "Model B", description: "New Model B", maxTokens: 8192 },
		}
		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "routerModels",
						routerModels: { modelharbor: newModels },
					},
				}),
			)
			// Update the mock to simulate receiving new models
			routerModelsMock = { data: { modelharbor: newModels }, isLoading: false, isError: false }
		})

		// Re-render to pick up new mock value
		rerender(
			<QueryClientProvider client={queryClient}>
				<ModelHarbor apiConfiguration={defaultApiConfiguration} setApiConfigurationField={() => {}} />
			</QueryClientProvider>,
		)

		// Wait for UI update (skip timer advance, rely on real timers)
		await act(async () => {})

		// Should update to show new model keys in the dropdown
		expect(screen.getByText("modelA")).toBeInTheDocument()
		expect(screen.getByText("modelB")).toBeInTheDocument()
	})
})
