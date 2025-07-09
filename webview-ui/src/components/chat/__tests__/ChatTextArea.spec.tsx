import React from "react"
import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import ChatTextArea from "../ChatTextArea"
import { ExtensionStateContext } from "@/context/ExtensionStateContext"
import { Mode } from "@roo/modes"

// Mock the vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation context
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock the prompt history hook
vi.mock("../hooks/usePromptHistory", () => ({
	usePromptHistory: () => ({
		handleHistoryNavigation: vi.fn(),
		resetHistoryNavigation: vi.fn(),
		resetOnInputChange: vi.fn(),
	}),
}))

// Mock react-use
vi.mock("react-use", () => ({
	useEvent: vi.fn(),
}))

const createMockExtensionState = (codebaseIndexEnabled: boolean) => ({
	version: "1.0.0",
	clineMessages: [],
	taskHistory: [],
	filePaths: [],
	openedTabs: [],
	currentApiConfigName: "test-config",
	listApiConfigMeta: [],
	customModes: [],
	customModePrompts: {},
	cwd: "/test",
	pinnedApiConfigs: {},
	togglePinnedApiConfig: vi.fn(),
	codebaseIndexConfig: codebaseIndexEnabled
		? {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai" as const,
				codebaseIndexEmbedderBaseUrl: "",
				codebaseIndexEmbedderModelId: "",
				codebaseIndexSearchMaxResults: undefined,
				codebaseIndexSearchMinScore: undefined,
			}
		: {
				codebaseIndexEnabled: false,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openai" as const,
				codebaseIndexEmbedderBaseUrl: "",
				codebaseIndexEmbedderModelId: "",
				codebaseIndexSearchMaxResults: undefined,
				codebaseIndexSearchMinScore: undefined,
			},
	codebaseIndexModels: { ollama: {}, openai: {} },
	shouldShowAnnouncement: false,
	allowedCommands: [],
	soundEnabled: false,
	soundVolume: 0.5,
	ttsEnabled: false,
	ttsSpeed: 1.0,
	diffEnabled: false,
	enableCheckpoints: true,
	fuzzyMatchThreshold: 1.0,
	language: "en" as const,
	writeDelayMs: 1000,
	browserViewportSize: "900x600",
	screenshotQuality: 75,
	terminalOutputLineLimit: 500,
	terminalShellIntegrationTimeout: 4000,
	mcpEnabled: true,
	enableMcpServerCreation: false,
	alwaysApproveResubmit: false,
	requestDelaySeconds: 5,
	mode: "code" as Mode,
	customSupportPrompts: {},
	experiments: {},
	enhancementApiConfigId: "",
	condensingApiConfigId: "",
	customCondensingPrompt: "",
	hasOpenedModeSelector: false,
	autoApprovalEnabled: false,
	maxOpenTabsContext: 20,
	maxWorkspaceFiles: 200,
	browserToolEnabled: true,
	telemetrySetting: "unset" as const,
	showRooIgnoredFiles: true,
	renderContext: "sidebar" as const,
	maxReadFileLine: -1,
	terminalZshOhMy: false,
	maxConcurrentFileReads: 5,
	terminalZshP10k: false,
	terminalZdotdir: false,
	terminalCompressProgressBar: true,
	historyPreviewCollapsed: false,
	cloudUserInfo: null,
	cloudIsAuthenticated: false,
	sharingEnabled: false,
	organizationAllowList: { allowAll: true, providers: {} },
	autoCondenseContext: true,
	autoCondenseContextPercent: 100,
	profileThresholds: {},
	alwaysAllowUpdateTodoList: true,
	didHydrateState: true,
	showWelcome: false,
	theme: {},
	mcpServers: [],
	currentCheckpoint: undefined,
	routerModels: undefined,
	marketplaceItems: [],
	marketplaceInstalledMetadata: { project: {}, global: {} },
	alwaysAllowFollowupQuestions: false,
	followupAutoApproveTimeoutMs: undefined,
	// Add minimal setter functions
	setExperimentEnabled: vi.fn(),
	setApiConfiguration: vi.fn(),
	setCustomInstructions: vi.fn(),
	setAlwaysAllowReadOnly: vi.fn(),
	setAlwaysAllowReadOnlyOutsideWorkspace: vi.fn(),
	setAlwaysAllowWrite: vi.fn(),
	setAlwaysAllowWriteOutsideWorkspace: vi.fn(),
	setAlwaysAllowExecute: vi.fn(),
	setAlwaysAllowBrowser: vi.fn(),
	setAlwaysAllowMcp: vi.fn(),
	setAlwaysAllowModeSwitch: vi.fn(),
	setAlwaysAllowSubtasks: vi.fn(),
	setAlwaysAllowFollowupQuestions: vi.fn(),
	setFollowupAutoApproveTimeoutMs: vi.fn(),
	setShowAnnouncement: vi.fn(),
	setAllowedCommands: vi.fn(),
	setAllowedMaxRequests: vi.fn(),
	setSoundEnabled: vi.fn(),
	setSoundVolume: vi.fn(),
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
	setDiffEnabled: vi.fn(),
	setEnableCheckpoints: vi.fn(),
	setBrowserViewportSize: vi.fn(),
	setFuzzyMatchThreshold: vi.fn(),
	setWriteDelayMs: vi.fn(),
	setScreenshotQuality: vi.fn(),
	setTerminalOutputLineLimit: vi.fn(),
	setTerminalShellIntegrationTimeout: vi.fn(),
	setTerminalShellIntegrationDisabled: vi.fn(),
	setTerminalZdotdir: vi.fn(),
	setMcpEnabled: vi.fn(),
	setEnableMcpServerCreation: vi.fn(),
	setAlwaysApproveResubmit: vi.fn(),
	setRequestDelaySeconds: vi.fn(),
	setCurrentApiConfigName: vi.fn(),
	setListApiConfigMeta: vi.fn(),
	setMode: vi.fn(),
	setCustomModePrompts: vi.fn(),
	setCustomSupportPrompts: vi.fn(),
	setEnhancementApiConfigId: vi.fn(),
	setAutoApprovalEnabled: vi.fn(),
	setCustomModes: vi.fn(),
	setMaxOpenTabsContext: vi.fn(),
	setMaxWorkspaceFiles: vi.fn(),
	setBrowserToolEnabled: vi.fn(),
	setTelemetrySetting: vi.fn(),
	setShowRooIgnoredFiles: vi.fn(),
	setRemoteBrowserEnabled: vi.fn(),
	setAwsUsePromptCache: vi.fn(),
	setMaxReadFileLine: vi.fn(),
	setPinnedApiConfigs: vi.fn(),
	setTerminalCompressProgressBar: vi.fn(),
	setHistoryPreviewCollapsed: vi.fn(),
	setHasOpenedModeSelector: vi.fn(),
	setAutoCondenseContext: vi.fn(),
	setAutoCondenseContextPercent: vi.fn(),
	setCondensingApiConfigId: vi.fn(),
	setCustomCondensingPrompt: vi.fn(),
	setProfileThresholds: vi.fn(),
	setAlwaysAllowUpdateTodoList: vi.fn(),
})

const defaultProps = {
	inputValue: "",
	setInputValue: vi.fn(),
	sendingDisabled: false,
	selectApiConfigDisabled: false,
	placeholderText: "Type your message...",
	selectedImages: [],
	setSelectedImages: vi.fn(),
	onSend: vi.fn(),
	onSelectImages: vi.fn(),
	shouldDisableImages: false,
	mode: "code" as Mode,
	setMode: vi.fn(),
	modeShortcutText: "Ctrl+M",
}

describe("ChatTextArea", () => {
	it("renders indexing status icon when codebase indexing is enabled", () => {
		const mockState = createMockExtensionState(true)

		render(
			<ExtensionStateContext.Provider value={mockState}>
				<ChatTextArea {...defaultProps} />
			</ExtensionStateContext.Provider>,
		)

		// Look for the indexing status dot by checking for the component
		const indexingStatusElement = screen.getByTestId("indexing-status-dot")
		expect(indexingStatusElement).toBeInTheDocument()
	})

	it("does not render indexing status icon when codebase indexing is disabled", () => {
		const mockState = createMockExtensionState(false)

		render(
			<ExtensionStateContext.Provider value={mockState}>
				<ChatTextArea {...defaultProps} />
			</ExtensionStateContext.Provider>,
		)

		// The indexing status dot should not be present
		const indexingStatusElement = screen.queryByTestId("indexing-status-dot")
		expect(indexingStatusElement).not.toBeInTheDocument()
	})
})
