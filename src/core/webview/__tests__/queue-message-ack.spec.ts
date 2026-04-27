// npx vitest core/webview/__tests__/queue-message-ack.spec.ts

// Mock dependencies - must come before imports
vi.mock("../../../api/providers/fetchers/modelCache")

vi.mock("../diagnosticsHandler", () => ({
	generateErrorDiagnostics: vi.fn().mockResolvedValue({ success: true, filePath: "/tmp/diagnostics.json" }),
}))

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

const mockAddMessage = vi.fn()

// Mock ClineProvider
const mockClineProvider = {
	getState: vi.fn(),
	postMessageToWebview: vi.fn(),
	customModesManager: {
		getCustomModes: vi.fn(),
		deleteCustomMode: vi.fn(),
	},
	context: {
		extensionPath: "/mock/extension/path",
		globalStorageUri: { fsPath: "/mock/global/storage" },
	},
	contextProxy: {
		context: {
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/global/storage" },
		},
		setValue: vi.fn(),
		getValue: vi.fn(),
	},
	log: vi.fn(),
	postStateToWebview: vi.fn(),
	getCurrentTask: vi.fn(),
	getTaskWithId: vi.fn(),
	createTaskWithHistoryItem: vi.fn(),
} as unknown as ClineProvider

vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showTextDocument: vi.fn().mockResolvedValue(undefined),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
		openTextDocument: vi.fn().mockResolvedValue({}),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

vi.mock("fs/promises", () => {
	const mockRm = vi.fn().mockResolvedValue(undefined)
	const mockMkdir = vi.fn().mockResolvedValue(undefined)
	const mockReadFile = vi.fn().mockResolvedValue("[]")
	const mockWriteFile = vi.fn().mockResolvedValue(undefined)
	return {
		default: { rm: mockRm, mkdir: mockMkdir, readFile: mockReadFile, writeFile: mockWriteFile },
		rm: mockRm,
		mkdir: mockMkdir,
		readFile: mockReadFile,
		writeFile: mockWriteFile,
	}
})

vi.mock("../../../utils/fs")
vi.mock("../../../utils/path")
vi.mock("../../../utils/globalContext")

vi.mock("../../mentions/resolveImageMentions", () => ({
	resolveImageMentions: vi.fn(async ({ text, images }: { text: string; images?: string[] }) => ({
		text,
		images: images ?? [],
	})),
}))

describe("webviewMessageHandler - queueMessage acknowledgment", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockClineProvider.getState = vi.fn().mockResolvedValue({
			maxImageFileSize: 5,
			maxTotalImageSize: 20,
		})
	})

	it("sends queueMessageAck when message is queued successfully with requestId", async () => {
		vi.mocked(mockClineProvider.getCurrentTask).mockReturnValue({
			messageQueueService: { addMessage: mockAddMessage },
		} as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "queueMessage",
			text: "hello world",
			images: [],
			requestId: "test-req-id-123",
		})

		// Should call addMessage on the queue service
		expect(mockAddMessage).toHaveBeenCalledWith("hello world", [])

		// Should send ack back to webview with the matching requestId
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "queueMessageAck",
			requestId: "test-req-id-123",
		})
	})

	it("sends queueMessageError when no active task", async () => {
		vi.mocked(mockClineProvider.getCurrentTask).mockReturnValue(null as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "queueMessage",
			text: "hello world",
			images: [],
			requestId: "test-req-id-456",
		})

		// Should send error back to webview
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "queueMessageError",
			requestId: "test-req-id-456",
			error: "No active task",
		})

		// Should NOT send ack
		expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "queueMessageAck" }),
		)
	})

	it("sends queueMessageError when addMessage throws", async () => {
		mockAddMessage.mockImplementation(() => {
			throw new Error("Queue validation failed")
		})

		vi.mocked(mockClineProvider.getCurrentTask).mockReturnValue({
			messageQueueService: { addMessage: mockAddMessage },
		} as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "queueMessage",
			text: "hello world",
			images: [],
			requestId: "test-req-id-789",
		})

		// Should send error back to webview with the thrown error message
		expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "queueMessageError",
			requestId: "test-req-id-789",
			error: "Queue validation failed",
		})
	})

	it("does not send ack or error when requestId is missing (backward compatible)", async () => {
		vi.mocked(mockClineProvider.getCurrentTask).mockReturnValue({
			messageQueueService: { addMessage: mockAddMessage },
		} as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "queueMessage",
			text: "hello world",
			images: [],
		} as any)

		// addMessage should still be called normally
		expect(mockAddMessage).toHaveBeenCalledWith("hello world", [])

		// But no ack or error should be sent (no requestId to correlate)
		expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
	})

	it("does not send error when requestId is missing and no active task", async () => {
		vi.mocked(mockClineProvider.getCurrentTask).mockReturnValue(null as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "queueMessage",
			text: "hello world",
			images: [],
		} as any)

		// No error should be sent without requestId — backward compatible
		expect(mockClineProvider.postMessageToWebview).not.toHaveBeenCalled()
	})
})
