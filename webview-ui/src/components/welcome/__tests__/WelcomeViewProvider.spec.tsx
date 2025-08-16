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
	VSCodeTextField: ({ value, onKeyUp, placeholder }: any) => (
		<input data-testid="text-field" type="text" value={value} onChange={onKeyUp} placeholder={placeholder} />
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
	default: () => <div data-testid="api-options">API Options Component</div>,
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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
	ArrowRight: () => <span data-testid="arrow-right-icon">→</span>,
	BadgeInfo: () => <span data-testid="badge-info-icon">ℹ</span>,
	Brain: () => <span data-testid="brain-icon">🧠</span>,
	TriangleAlert: () => <span data-testid="triangle-alert-icon">⚠</span>,
}))

// Mock vscode utility
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
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

// Mock buildDocLink
vi.mock("@/utils/docLinks", () => ({
	buildDocLink: (path: string, source: string) => `https://docs.roocode.com/${path}?utm_source=${source}`,
}))

const renderWelcomeViewProvider = (extensionState = {}) => {
	const useExtensionStateMock = vi.spyOn(ExtensionStateContext, "useExtensionState")
	useExtensionStateMock.mockReturnValue({
		apiConfiguration: {},
		currentApiConfigName: "default",
		setApiConfiguration: vi.fn(),
		uriScheme: "vscode",
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

			// Should show the Roo Hero
			expect(screen.getByTestId("roo-hero")).toBeInTheDocument()

			// Should show the landing greeting
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()

			// Should show introduction via Trans component
			expect(screen.getByTestId("trans-welcome:introduction")).toBeInTheDocument()

			// Should show "Get Started" button (primary variant)
			expect(screen.getByTestId("button-primary")).toBeInTheDocument()
		})

		it("navigates to provider selection when 'Get Started' is clicked", () => {
			renderWelcomeViewProvider()

			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)

			// Should now show provider selection screen
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()

			// Should show ApiOptions
			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			// Should show back button
			expect(screen.getByTestId("button-secondary")).toBeInTheDocument()
		})

		it("shows Roo Hero component on landing", () => {
			renderWelcomeViewProvider()

			expect(screen.getByTestId("roo-hero")).toBeInTheDocument()
		})
	})

	describe("Provider Selection Screen", () => {
		const navigateToProviderSelection = () => {
			const getStartedButton = screen.getByTestId("button-primary")
			fireEvent.click(getStartedButton)
		}

		it("shows provider selection heading", () => {
			renderWelcomeViewProvider()
			navigateToProviderSelection()

			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()
		})

		it("shows choose provider text", () => {
			renderWelcomeViewProvider()
			navigateToProviderSelection()

			expect(screen.getByTestId("trans-welcome:chooseProvider")).toBeInTheDocument()
		})

		it("shows ApiOptions component", () => {
			renderWelcomeViewProvider()
			navigateToProviderSelection()

			expect(screen.getByTestId("api-options")).toBeInTheDocument()
		})

		it("shows back button to return to landing", () => {
			renderWelcomeViewProvider()
			navigateToProviderSelection()

			const backButton = screen.getByTestId("button-secondary")
			expect(backButton).toBeInTheDocument()
			expect(backButton.textContent).toContain("welcome:providerSignup.getStarted")
		})

		it("returns to landing screen when back button is clicked", () => {
			renderWelcomeViewProvider()
			navigateToProviderSelection()

			// Verify we're on provider selection
			expect(screen.getByTestId("api-options")).toBeInTheDocument()

			// Click back button
			const backButton = screen.getByTestId("button-secondary")
			fireEvent.click(backButton)

			// Should be back on landing screen
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()
			expect(screen.getByTestId("roo-hero")).toBeInTheDocument()
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})
	})

	describe("Navigation Flow", () => {
		it("can navigate from landing to provider selection and back", () => {
			renderWelcomeViewProvider()

			// Start on landing screen
			expect(screen.getByTestId("roo-hero")).toBeInTheDocument()
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()

			// Navigate to provider selection
			fireEvent.click(screen.getByTestId("button-primary"))

			// Verify provider selection screen
			expect(screen.getByTestId("api-options")).toBeInTheDocument()
			expect(screen.getByText(/welcome:providerSignup.heading/)).toBeInTheDocument()

			// Navigate back to landing
			fireEvent.click(screen.getByTestId("button-secondary"))

			// Verify back on landing
			expect(screen.getByTestId("roo-hero")).toBeInTheDocument()
			expect(screen.getByText(/welcome:greeting/)).toBeInTheDocument()
			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})

		it("does not show ApiOptions on landing screen", () => {
			renderWelcomeViewProvider()

			expect(screen.queryByTestId("api-options")).not.toBeInTheDocument()
		})

		it("does not show RooHero on provider selection screen", () => {
			renderWelcomeViewProvider()

			// Navigate to provider selection
			fireEvent.click(screen.getByTestId("button-primary"))

			expect(screen.queryByTestId("roo-hero")).not.toBeInTheDocument()
		})
	})
})
