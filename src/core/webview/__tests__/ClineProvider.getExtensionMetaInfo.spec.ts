// Tests for ClineProvider.getExtensionMetaInfo()
// pnpm --filter roo-cline test core/webview/__tests__/ClineProvider.getExtensionMetaInfo.spec.ts

import * as vscode from "vscode"

import { ContextProxy } from "../../config/ContextProxy"

import { ClineProvider } from "../ClineProvider"

// Use vi.hoisted to create mock functions that are available in vi.mock factories
const { mockGetExtension, mockCalculateDirectorySize } = vi.hoisted(() => ({
	mockGetExtension: vi.fn(),
	mockCalculateDirectorySize: vi.fn(),
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

// Mock delay
vi.mock("delay", () => {
	const delayFn = (_ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

// Mock axios
vi.mock("axios", () => ({
	default: {
		get: vi.fn().mockResolvedValue({ data: { data: [] } }),
		post: vi.fn(),
	},
	get: vi.fn().mockResolvedValue({ data: { data: [] } }),
	post: vi.fn(),
}))

// Mock storage utils
vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
}))

// Mock MCP SDK
vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolResultSchema: {},
	ListResourcesResultSchema: {},
	ListResourceTemplatesResultSchema: {},
	ListToolsResultSchema: {},
	ReadResourceResultSchema: {},
	ErrorCode: {
		InvalidRequest: "InvalidRequest",
		MethodNotFound: "MethodNotFound",
		InternalError: "InternalError",
	},
	McpError: class McpError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
			this.name = "McpError"
		}
	},
}))

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		listTools: vi.fn().mockResolvedValue({ tools: [] }),
		callTool: vi.fn().mockResolvedValue({ content: [] }),
	})),
}))

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
	})),
}))

// Mock vscode - uses hoisted mockGetExtension
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
	extensions: {
		getExtension: mockGetExtension,
	},
}))

// Mock TTS
vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

// Mock API
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
		}),
	}),
}))

// Mock prompts
vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../prompts/sections/custom-instructions", () => ({
	addCustomInstructions: vi.fn().mockResolvedValue(""),
}))

// Mock WorkspaceTracker
vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))

// Mock Task
vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options: any) => ({
		api: undefined,
		abortTask: vi.fn(),
		handleWebviewAskResponse: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
		overwriteClineMessages: vi.fn(),
		overwriteApiConversationHistory: vi.fn(),
		getTaskNumber: vi.fn().mockReturnValue(0),
		setTaskNumber: vi.fn(),
		setParentTask: vi.fn(),
		setRootTask: vi.fn(),
		taskId: options?.historyItem?.id || "test-task-id",
		emit: vi.fn(),
	})),
}))

// Mock modes
vi.mock("../../../shared/modes", () => ({
	modes: [
		{
			slug: "code",
			name: "Code Mode",
			roleDefinition: "You are a code assistant",
			groups: ["read", "edit", "browser"],
		},
	],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	getGroupName: vi.fn().mockReturnValue("General Tools"),
	defaultModeSlug: "code",
}))

vi.mock("../../../shared/experiments", () => ({
	experimentDefault: {},
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
}))

vi.mock("../diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getToolDescription: () => "test",
		getName: () => "test-strategy",
		applyDiff: vi.fn(),
	})),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(true),
		get instance() {
			return {
				isAuthenticated: vi.fn().mockReturnValue(false),
			}
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

// Mock cacheInfo module - uses hoisted mockCalculateDirectorySize
vi.mock("../../../utils/cacheInfo", () => ({
	calculateCacheInfo: vi.fn(),
	clearAllCache: vi.fn(),
	calculateDirectorySize: mockCalculateDirectorySize,
	formatBytes: vi.fn(),
}))

afterAll(() => {
	vi.restoreAllMocks()
})

describe("ClineProvider.getExtensionMetaInfo", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		vi.clearAllMocks()

		const globalState: Record<string, string | undefined> = {
			mode: "code",
			currentApiConfigName: "default",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/extension/path",
			extensionUri: {
				fsPath: "/test/extension/path",
			} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (globalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "3.45.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Mock customModesManager
		;(provider as any).customModesManager = {
			getCustomModes: vi.fn().mockResolvedValue([]),
			dispose: vi.fn(),
		}

		// Mock MCP hub
		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})
	})

	it("returns extension meta info when extension is found with marketplace source", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.45.0",
				__metadata: {
					source: "marketplace",
					galleryExtensionId: "some-gallery-id",
					lastUpdated: "2026-01-15T10:30:00.000Z",
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(13_107_200) // 12.5 MB

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.identifier).toBe("modelharbor.modelharbor-agent")
		expect(result.version).toBe("3.45.0")
		expect(result.source).toBe("Marketplace")
		expect(result.lastUpdated).toBeDefined()
		expect(result.lastUpdated).not.toBe("Unknown")
		expect(result.extensionSize).toBe("12.50 MB")
	})

	it("returns extension meta info with VSIX source", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.44.0",
				__metadata: {
					source: "vsix",
					lastUpdated: "2026-02-20T14:00:00.000Z",
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(5_242_880) // 5 MB

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.source).toBe("VSIX")
		expect(result.extensionSize).toBe("5.00 MB")
	})

	it("returns extension meta info with installed:true metadata (VSIX)", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.43.0",
				__metadata: {
					installed: true,
					lastUpdated: "2026-03-01T08:00:00.000Z",
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(3_145_728) // 3 MB

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.source).toBe("VSIX")
	})

	it("returns 'Unknown' source when no metadata is present", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.42.0",
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(2_097_152) // 2 MB

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.source).toBe("Unknown")
		expect(result.lastUpdated).toBe("Unknown")
	})

	it("returns undefined when extension is not found", async () => {
		mockGetExtension.mockReturnValue(undefined)

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeUndefined()
	})

	it("uses Package.version as fallback when packageJSON.version is missing", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				// No version field
				__metadata: {
					source: "marketplace",
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(1_048_576) // 1 MB

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		// Should fall back to Package.version
		expect(result.version).toBeDefined()
	})

	it("returns 'Unknown' extensionSize when size is 0", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.45.0",
				__metadata: {
					source: "marketplace",
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(0)

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.extensionSize).toBe("Unknown")
	})

	it("returns 'Unknown' extensionSize when size calculation throws", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.45.0",
				__metadata: {
					source: "marketplace",
				},
			},
		})

		mockCalculateDirectorySize.mockRejectedValue(new Error("Permission denied"))

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.extensionSize).toBe("Unknown")
	})

	it("formats lastUpdated date correctly", async () => {
		const testDate = new Date("2026-04-15T10:30:00.000Z")
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.45.0",
				__metadata: {
					source: "marketplace",
					lastUpdated: testDate.toISOString(),
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(10_485_760)

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.lastUpdated).not.toBe("Unknown")
		// The date should be formatted with toLocaleDateString
		// Just verify it's not "Unknown" and contains year info
		expect(result.lastUpdated).toContain("2026")
	})

	it("returns undefined and logs error when an exception occurs", async () => {
		mockGetExtension.mockImplementation(() => {
			throw new Error("Unexpected error")
		})

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeUndefined()
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("[getExtensionMetaInfo] Error"),
		)
	})

	it("passes extension path to calculateDirectorySize", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.45.0",
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(5_242_880)

		await (provider as any).getExtensionMetaInfo()

		expect(mockCalculateDirectorySize).toHaveBeenCalledWith("/test/extension/path")
	})

	it("handles custom source value from metadata", async () => {
		mockGetExtension.mockReturnValue({
			packageJSON: {
				version: "3.45.0",
				__metadata: {
					source: "custom-registry",
				},
			},
		})

		mockCalculateDirectorySize.mockResolvedValue(4_194_304)

		const result = await (provider as any).getExtensionMetaInfo()

		expect(result).toBeDefined()
		expect(result.source).toBe("custom-registry")
	})
})
