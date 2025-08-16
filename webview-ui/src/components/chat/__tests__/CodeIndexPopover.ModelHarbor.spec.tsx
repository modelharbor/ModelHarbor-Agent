// npx vitest run src/components/chat/__tests__/CodeIndexPopover.ModelHarbor.spec.tsx

import React from "react"
import { render, fireEvent, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import { CodeIndexPopover } from "../CodeIndexPopover"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: function MockVSCodeButton({
		children,
		onClick,
		appearance,
		disabled,
	}: {
		children: React.ReactNode
		onClick?: () => void
		appearance?: string
		disabled?: boolean
	}) {
		return (
			<button
				onClick={disabled ? undefined : onClick}
				data-appearance={appearance}
				disabled={disabled}
				data-testid={children?.toString().toLowerCase().includes("save") ? "save-button" : undefined}>
				{children}
			</button>
		)
	},
	VSCodeTextField: function MockVSCodeTextField({
		value,
		onInput,
		placeholder,
		type,
		"data-testid": dataTestId,
	}: {
		value?: string
		onInput?: (e: { target: { value: string } }) => void
		placeholder?: string
		type?: string
		"data-testid"?: string
	}) {
		return (
			<input
				type={type || "text"}
				value={value}
				onChange={(e) => onInput?.({ target: { value: e.target.value } })}
				placeholder={placeholder}
				data-testid={dataTestId || placeholder?.toLowerCase().replace(/\s+/g, "-")}
			/>
		)
	},
	VSCodeDropdown: function MockVSCodeDropdown({
		value,
		onChange,
		children,
	}: {
		value?: string
		onChange?: (e: { target: { value: string } }) => void
		children: React.ReactNode
	}) {
		return (
			<select
				value={value}
				onChange={(e) => onChange?.({ target: { value: e.target.value } })}
				data-testid="embedding-provider-dropdown">
				{children}
			</select>
		)
	},
	VSCodeOption: function MockVSCodeOption({ value, children }: { value: string; children: React.ReactNode }) {
		return <option value={value}>{children}</option>
	},
	VSCodeLink: function MockVSCodeLink({
		children,
		href,
		style,
	}: {
		children: React.ReactNode
		href?: string
		style?: React.CSSProperties
	}) {
		return (
			<a href={href} style={style}>
				{children}
			</a>
		)
	},
	VSCodeCheckbox: function MockVSCodeCheckbox({
		children,
		checked,
		onChange,
	}: {
		children: React.ReactNode
		checked?: boolean
		onChange?: (e: { target: { checked: boolean } }) => void
	}) {
		return (
			<label>
				<input
					type="checkbox"
					checked={checked}
					onChange={(e) => onChange?.({ target: { checked: e.target.checked } })}
				/>
				{children}
			</label>
		)
	},
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => {
		return <>{children || i18nKey}</>
	},
}))

const defaultProps = {
	children: <button>Test Trigger</button>,
	indexingStatus: {
		systemStatus: "Standby" as const,
		message: "",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	},
}

const queryClient = new QueryClient()

// Mock window.postMessage to trigger state hydration
const mockPostMessage = (state: any) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				cloudIsAuthenticated: false,
				codebaseIndexConfig: {
					codebaseIndexEnabled: true,
					codebaseIndexEmbedderProvider: "modelharbor",
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderModelId: "",
				},
				codebaseIndexModelHarborApiKey: "",
				secretStatus: {
					hasModelHarborApiKey: false,
				},
				...state,
			},
		},
		"*",
	)
}

// Mock secret status response
const mockSecretStatusResponse = (secretStatus: any) => {
	window.postMessage(
		{
			type: "codeIndexSecretStatus",
			values: secretStatus,
		},
		"*",
	)
}

const renderCodeIndexPopover = (props: Partial<typeof defaultProps> = {}) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<CodeIndexPopover {...defaultProps} {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("CodeIndexPopover - ModelHarbor API Key Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should display ModelHarbor API key input when provider is modelharbor", async () => {
		const { getByTestId, getByRole, getByText } = renderCodeIndexPopover()

		// Click trigger to open popover
		fireEvent.click(getByRole("button", { name: /test trigger/i }))

		// Hydrate state with ModelHarbor as the provider
		mockPostMessage({
			codebaseIndexConfig: {
				codebaseIndexEmbedderProvider: "modelharbor",
			},
			codebaseIndexModelHarborApiKey: "",
			secretStatus: {
				hasModelHarborApiKey: false,
			},
		})

		// Wait for popover to be open
		await waitFor(() => {
			expect(getByText("settings:codeIndex.setupConfigLabel")).toBeInTheDocument()
		})

		// Click to expand setup settings
		fireEvent.click(getByText("settings:codeIndex.setupConfigLabel"))

		// Wait for the component to render the ModelHarbor API key input
		await waitFor(() => {
			expect(getByTestId("modelharbor-api-key")).toBeInTheDocument()
		})
	})

	it("should display placeholder when ModelHarbor API key exists", async () => {
		const { getByTestId, getByRole, getByText } = renderCodeIndexPopover()

		// Click trigger to open popover
		fireEvent.click(getByRole("button", { name: /test trigger/i }))

		// Hydrate state with ModelHarbor as the provider
		mockPostMessage({
			codebaseIndexConfig: {
				codebaseIndexEmbedderProvider: "modelharbor",
			},
		})

		// Send secret status response indicating API key exists
		mockSecretStatusResponse({
			hasModelHarborApiKey: true,
		})

		// Wait for popover to be open
		await waitFor(() => {
			expect(getByText("settings:codeIndex.setupConfigLabel")).toBeInTheDocument()
		})

		// Click to expand setup settings
		fireEvent.click(getByText("settings:codeIndex.setupConfigLabel"))

		// Wait for the component to render and update with secret status
		await waitFor(() => {
			expect(getByTestId("modelharbor-api-key")).toBeInTheDocument()
			const apiKeyInput = getByTestId("modelharbor-api-key") as HTMLInputElement
			expect(apiKeyInput.value).toBe("••••••••••••••••")
		})
	})

	it("should not display ModelHarbor API key input when provider is not modelharbor", async () => {
		const { queryByTestId, getByRole } = renderCodeIndexPopover()

		// Click trigger to open popover
		fireEvent.click(getByRole("button", { name: /test trigger/i }))

		// Hydrate state with a different provider
		mockPostMessage({
			codebaseIndexConfig: {
				codebaseIndexEmbedderProvider: "openai",
			},
		})

		// Wait a bit to ensure component renders
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Verify ModelHarbor API key input is not present
		expect(queryByTestId("modelharbor-api-key")).not.toBeInTheDocument()
	})

	it("should handle updating from empty to filled ModelHarbor API key", async () => {
		const { getByTestId, getByRole, getByText } = renderCodeIndexPopover()

		// Click trigger to open popover
		fireEvent.click(getByRole("button", { name: /test trigger/i }))

		// Initially hydrate with empty API key
		mockPostMessage({
			codebaseIndexConfig: {
				codebaseIndexEmbedderProvider: "modelharbor",
			},
		})

		// Send initial secret status response - no API key
		mockSecretStatusResponse({
			hasModelHarborApiKey: false,
		})

		// Wait for popover to be open
		await waitFor(() => {
			expect(getByText("settings:codeIndex.setupConfigLabel")).toBeInTheDocument()
		})

		// Click to expand setup settings
		fireEvent.click(getByText("settings:codeIndex.setupConfigLabel"))

		// Wait for initial render
		await waitFor(() => {
			expect(getByTestId("modelharbor-api-key")).toBeInTheDocument()
		})

		// Verify initial empty state
		const apiKeyInput = getByTestId("modelharbor-api-key") as HTMLInputElement
		expect(apiKeyInput.value).toBe("")

		// Simulate state update after API key is saved - send new secret status
		mockSecretStatusResponse({
			hasModelHarborApiKey: true,
		})

		// Wait for update
		await waitFor(() => {
			const updatedInput = getByTestId("modelharbor-api-key") as HTMLInputElement
			expect(updatedInput.value).toBe("••••••••••••••••")
		})
	})
})
