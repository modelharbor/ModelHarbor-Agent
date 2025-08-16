// npx vitest src/components/welcome/__tests__/WelcomeViewProvider.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"

import * as ExtensionStateContext from "@src/context/ExtensionStateContext"
const { ExtensionStateContextProvider } = ExtensionStateContext

import WelcomeViewProvider from "../WelcomeViewProvider"

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeLink: ({ children, onClick }: any) => (
		<button onClick={onClick} data-testid="vscode-link">
			{children}
		</button>
	),
}))

// Mock Button component
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, variant }: any) => (
		<button onClick={onClick} data-testid={`button-${variant}`}>
			{children}
		</button>
	),
}))

// Mock ApiOptions
vi.mock("../../settings/ApiOptions", () => ({
	default: ({ fromWelcomeView }: any) => (
		<div data-testid="api-options" data-from-welcome={fromWelcomeView}>
			API Options Component
		</div>
	),
}))

// Mock Tab components
vi.mock("../../common/Tab", () => ({
	Tab: ({ children }: any) => <div data-testid="tab">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
}))

// Mock RooHero
vi.mock("../RooHero", () => ({
	default: () => <div data-testid="roo-hero">Roo Hero</div>,
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	Trans: ({ i18nKey, children }: any) => <span data-testid={`trans-${i18nKey}`}>{children || i18nKey}</span>,
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const renderWelcomeViewProvider = (extensionState = {}) => {
	const useExtensionStateMock = vi.spyOn(ExtensionStateContext, "useExtensionState")
	useExtensionStateMock.mockReturnValue({
		apiConfiguration: {},
		currentApiConfigName: "default",
		setApiConfiguration: vi.fn(),
		uri_scheme: "modelharbor-agent",
		...extensionState,
	} as any)

	render(
		<ExtensionStateContextProvider>
			<WelcomeViewProvider />
		</ExtensionStateContextProvider>,
	)

	return useExtensionStateMock
}

describe("WelcomeViewProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Landing Screen", () => {
		it("renders landing screen by default", () => {
			renderWelcomeViewProvider()

			// Should show the landing greeting
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()

			// Should show introduction
			expect(screen.getByTestId("trans-welcome:introduction")).toBeInTheDocument()

			// Should show "Get Started" button
			expect(screen.getByTestId("button-primary")).toBeInTheDocument()
		})

		it("navigates to provider selection when 'Get Started' is clicked", () => {
			renderWelcomeViewProvider()

			// Initially on landing screen
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()

			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should now show provider selection screen
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()
			expect(screen.getByTestId("api-options")).toBeInTheDocument()
		})
	})

	describe("Provider Selection Screen", () => {
		it("shows API configuration screen after clicking Get Started", () => {
			renderWelcomeViewProvider()

			// Navigate to provider selection
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should show heading
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()

			// Should show chooseProvider text
			expect(screen.getByTestId("trans-welcome:chooseProvider")).toBeInTheDocument()

			// Should show API options component
			const apiOptions = screen.getByTestId("api-options")
			expect(apiOptions).toBeInTheDocument()
			expect(apiOptions).toHaveAttribute("data-from-welcome", "true")
		})

		it("shows 'Get Started' button on provider selection screen", () => {
			renderWelcomeViewProvider()

			// Navigate to provider selection
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should show secondary button (Get Started button for saving config)
			const saveButton = screen.getByTestId("button-secondary")
			expect(saveButton).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.getStarted/)).toBeInTheDocument()
		})

		it("returns to landing screen when button is clicked", () => {
			renderWelcomeViewProvider()

			// Navigate to provider selection
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Verify we're on provider selection screen
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()

			// Click the secondary button to go back
			const backButton = screen.getByTestId("button-secondary")
			fireEvent.click(backButton)

			// Should be back on landing screen
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()
			expect(screen.getByTestId("trans-welcome:introduction")).toBeInTheDocument()
		})
	})
})
