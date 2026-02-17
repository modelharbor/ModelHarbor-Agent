// npx vitest core/webview/__tests__/webviewMessageHandler.codeIndex.spec.ts

import type { Mock } from "vitest"

// Mock dependencies - must come before imports
vi.mock("../../../api/providers/fetchers/modelCache")

vi.mock("../diagnosticsHandler", () => ({
	generateErrorDiagnostics: vi.fn().mockResolvedValue({ success: true, filePath: "/tmp/diagnostics.json" }),
}))

vi.mock("vscode", () => {
	const showInformationMessage = vi.fn()
	const showErrorMessage = vi.fn()
	const openTextDocument = vi.fn().mockResolvedValue({})
	const showTextDocument = vi.fn().mockResolvedValue(undefined)

	return {
		window: {
			showInformationMessage,
			showErrorMessage,
			showTextDocument,
		},
		workspace: {
			workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
			openTextDocument,
		},
	}
})

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

vi.mock("fs/promises", () => ({
	default: {
		rm: vi.fn().mockResolvedValue(undefined),
		mkdir: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		writeFile: vi.fn().mockResolvedValue(undefined),
	},
	rm: vi.fn().mockResolvedValue(undefined),
	mkdir: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("[]"),
	writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../mentions/resolveImageMentions", () => ({
	resolveImageMentions: vi.fn(async ({ text, images }: { text: string; images?: string[] }) => ({
		text,
		images: images ?? [],
	})),
}))

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

describe("webviewMessageHandler - saveCodeIndexSettingsAtomic", () => {
	let mockProvider: ClineProvider

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			getState: vi.fn().mockResolvedValue({ apiConfiguration: {} }),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			customModesManager: {
				getCustomModes: vi.fn().mockResolvedValue([]),
				deleteCustomMode: vi.fn(),
			},
			context: {
				extensionPath: "/mock/extension/path",
				globalStorageUri: { fsPath: "/mock/global/storage" },
				secrets: {
					get: vi.fn().mockResolvedValue(undefined),
				},
			},
			contextProxy: {
				context: {
					extensionPath: "/mock/extension/path",
					globalStorageUri: { fsPath: "/mock/global/storage" },
				},
				setValue: vi.fn().mockResolvedValue(undefined),
				getValue: vi.fn().mockReturnValue({}),
				storeSecret: vi.fn().mockResolvedValue(undefined),
				globalStorageUri: { fsPath: "/mock/global/storage" },
			},
			log: vi.fn(),
			getCurrentTask: vi.fn().mockReturnValue(null),
			getCurrentWorkspaceCodeIndexManager: vi.fn().mockReturnValue(null),
			cwd: "/mock/workspace",
		} as unknown as ClineProvider

		// Default: no existing config in global state
		vi.mocked(mockProvider.contextProxy.getValue).mockReturnValue({})
	})

	it("saves codebaseIndexLitellmBaseUrl to globalState config", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "litellm",
				codebaseIndexEmbedderModelId: "text-embedding-ada-002",
				codebaseIndexLitellmBaseUrl: "http://localhost:4000",
			},
		})

		// Verify globalState was updated with codebaseIndexLitellmBaseUrl
		expect(mockProvider.contextProxy.setValue).toHaveBeenCalledWith(
			"codebaseIndexConfig",
			expect.objectContaining({
				codebaseIndexLitellmBaseUrl: "http://localhost:4000",
				codebaseIndexEmbedderProvider: "litellm",
				codebaseIndexEmbedderModelId: "text-embedding-ada-002",
			}),
		)

		// Verify success response was sent
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "codeIndexSettingsSaved",
				success: true,
			}),
		)
	})

	it("saves codebaseIndexLitellmApiKey as a secret", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "litellm",
				codebaseIndexEmbedderModelId: "text-embedding-ada-002",
				codebaseIndexLitellmBaseUrl: "http://localhost:4000",
				codebaseIndexLitellmApiKey: "sk-litellm-test-key",
			},
		})

		// Verify LiteLLM API key was stored as a secret
		expect(mockProvider.contextProxy.storeSecret).toHaveBeenCalledWith(
			"codebaseIndexLitellmApiKey",
			"sk-litellm-test-key",
		)
	})

	it("saves codebaseIndexOpenRouterApiKey as a secret", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "openrouter",
				codebaseIndexEmbedderModelId: "openai/text-embedding-ada-002",
				codebaseIndexOpenRouterApiKey: "sk-or-test-key",
			},
		})

		// Verify OpenRouter API key was stored as a secret
		expect(mockProvider.contextProxy.storeSecret).toHaveBeenCalledWith(
			"codebaseIndexOpenRouterApiKey",
			"sk-or-test-key",
		)
	})

	it("does not store LiteLLM API key when not provided", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "litellm",
				codebaseIndexEmbedderModelId: "text-embedding-ada-002",
				codebaseIndexLitellmBaseUrl: "http://localhost:4000",
				// no codebaseIndexLitellmApiKey
			},
		})

		// Verify LiteLLM API key was NOT stored (undefined means not sent from UI)
		expect(mockProvider.contextProxy.storeSecret).not.toHaveBeenCalledWith(
			"codebaseIndexLitellmApiKey",
			expect.anything(),
		)
	})

	it("preserves codebaseIndexLitellmBaseUrl in globalState when merging with existing config", async () => {
		// Simulate existing config
		vi.mocked(mockProvider.contextProxy.getValue).mockReturnValue({
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderModelId: "text-embedding-ada-002",
		})

		await webviewMessageHandler(mockProvider, {
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: {
				codebaseIndexEnabled: true,
				codebaseIndexQdrantUrl: "http://localhost:6333",
				codebaseIndexEmbedderProvider: "litellm",
				codebaseIndexEmbedderModelId: "embedding-model",
				codebaseIndexLitellmBaseUrl: "http://my-litellm:4000",
			},
		})

		const savedConfig = vi
			.mocked(mockProvider.contextProxy.setValue)
			.mock.calls.find((call) => call[0] === "codebaseIndexConfig")?.[1] as any

		expect(savedConfig).toBeDefined()
		expect(savedConfig.codebaseIndexLitellmBaseUrl).toBe("http://my-litellm:4000")
		expect(savedConfig.codebaseIndexEmbedderProvider).toBe("litellm")
	})
})

describe("webviewMessageHandler - requestCodeIndexSecretStatus", () => {
	let mockProvider: ClineProvider

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			getState: vi.fn().mockResolvedValue({ apiConfiguration: {} }),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			customModesManager: {
				getCustomModes: vi.fn().mockResolvedValue([]),
			},
			context: {
				extensionPath: "/mock/extension/path",
				globalStorageUri: { fsPath: "/mock/global/storage" },
				secrets: {
					get: vi.fn().mockResolvedValue(undefined),
				},
			},
			contextProxy: {
				context: {
					extensionPath: "/mock/extension/path",
					globalStorageUri: { fsPath: "/mock/global/storage" },
				},
				setValue: vi.fn().mockResolvedValue(undefined),
				getValue: vi.fn().mockReturnValue({}),
				storeSecret: vi.fn().mockResolvedValue(undefined),
				globalStorageUri: { fsPath: "/mock/global/storage" },
			},
			log: vi.fn(),
			getCurrentTask: vi.fn().mockReturnValue(null),
			cwd: "/mock/workspace",
		} as unknown as ClineProvider
	})

	it("includes hasLitellmApiKey in secret status response", async () => {
		vi.mocked(mockProvider.context.secrets.get).mockImplementation(async (key: string) => {
			if (key === "codebaseIndexLitellmApiKey") return "sk-litellm-key"
			return undefined
		})

		await webviewMessageHandler(mockProvider, {
			type: "requestCodeIndexSecretStatus",
		})

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "codeIndexSecretStatus",
			values: expect.objectContaining({
				hasLitellmApiKey: true,
			}),
		})
	})

	it("includes hasOpenRouterApiKey in secret status response", async () => {
		vi.mocked(mockProvider.context.secrets.get).mockImplementation(async (key: string) => {
			if (key === "codebaseIndexOpenRouterApiKey") return "sk-or-key"
			return undefined
		})

		await webviewMessageHandler(mockProvider, {
			type: "requestCodeIndexSecretStatus",
		})

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "codeIndexSecretStatus",
			values: expect.objectContaining({
				hasOpenRouterApiKey: true,
			}),
		})
	})

	it("returns false for missing LiteLLM and OpenRouter keys", async () => {
		// All secrets return undefined (default mock)
		await webviewMessageHandler(mockProvider, {
			type: "requestCodeIndexSecretStatus",
		})

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "codeIndexSecretStatus",
			values: expect.objectContaining({
				hasLitellmApiKey: false,
				hasOpenRouterApiKey: false,
			}),
		})
	})

	it("returns all secret status fields", async () => {
		await webviewMessageHandler(mockProvider, {
			type: "requestCodeIndexSecretStatus",
		})

		const callArgs = vi
			.mocked(mockProvider.postMessageToWebview)
			.mock.calls.find((call) => (call[0] as any).type === "codeIndexSecretStatus")

		expect(callArgs).toBeDefined()
		const values = (callArgs![0] as any).values
		expect(values).toHaveProperty("hasOpenAiKey")
		expect(values).toHaveProperty("hasQdrantApiKey")
		expect(values).toHaveProperty("hasOpenAiCompatibleApiKey")
		expect(values).toHaveProperty("hasGeminiApiKey")
		expect(values).toHaveProperty("hasMistralApiKey")
		expect(values).toHaveProperty("hasModelHarborApiKey")
		expect(values).toHaveProperty("hasVercelAiGatewayApiKey")
		expect(values).toHaveProperty("hasOpenRouterApiKey")
		expect(values).toHaveProperty("hasLitellmApiKey")
	})
})
