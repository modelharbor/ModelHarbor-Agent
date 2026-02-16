// npx vitest run core/task/__tests__/Task.super-yolo-stuck-timer.spec.ts

import * as os from "os"
import * as path from "path"

import * as vscode from "vscode"

import type { GlobalState, ProviderSettings } from "@roo-code/types"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"

// Mock delay before any imports that might use it
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("uuid", async (importOriginal) => {
	const actual = await importOriginal<typeof import("uuid")>()
	return {
		...actual,
		v7: vi.fn(() => "00000000-0000-7000-8000-000000000000"),
	}
})

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	const mockFunctions = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
	}

	return {
		...actual,
		...mockFunctions,
		default: mockFunctions,
	}
})

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	const mockEventEmitter = { event: vi.fn(), fire: vi.fn() }
	const mockTextDocument = { uri: { fsPath: "/mock/workspace/path/file.ts" } }
	const mockTextEditor = { document: mockTextDocument }
	const mockTab = { input: { uri: { fsPath: "/mock/workspace/path/file.ts" } } }
	const mockTabGroup = { tabs: [mockTab] }

	return {
		TabInputTextDiff: vi.fn(),
		CodeActionKind: {
			QuickFix: { value: "quickfix" },
			RefactorRewrite: { value: "refactor.rewrite" },
		},
		window: {
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			visibleTextEditors: [mockTextEditor],
			tabGroups: {
				all: [mockTabGroup],
				close: vi.fn(),
				onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			},
			showErrorMessage: vi.fn(),
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: "/mock/workspace/path" },
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
			fs: {
				stat: vi.fn().mockResolvedValue({ type: 1 }),
			},
			onDidSaveTextDocument: vi.fn(() => mockDisposable),
			getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: vi.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: vi.fn(),
		},
		TabInputText: vi.fn(),
	}
})

vi.mock("../../mentions", () => ({
	parseMentions: vi.fn().mockImplementation((text) => {
		return Promise.resolve({ text: `processed: ${text}`, mode: undefined })
	}),
	openMention: vi.fn(),
	getLatestTerminalOutput: vi.fn(),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")

vi.mock("../../condense", async (importOriginal) => {
	const actual = (await importOriginal()) as any
	return {
		...actual,
		summarizeConversation: vi.fn().mockResolvedValue({
			messages: [{ role: "user", content: [{ type: "text", text: "continued" }], ts: Date.now() }],
			summary: "summary",
			cost: 0,
			newContextTokens: 1,
		}),
	}
})

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(false),
}))

describe("startSuperYoloStuckTimer", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings

	beforeEach(() => {
		vi.useFakeTimers()

		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		const mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation((_key: keyof GlobalState) => undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockImplementation((_key) => undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			extensionUri: { fsPath: "/mock/extension/path" },
			extension: { packageJSON: { version: "1.0.0" } },
		} as unknown as vscode.ExtensionContext

		const mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}

		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.updateTaskHistory = vi.fn().mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	/**
	 * Helper to create a Task with startTask: false and call the private
	 * startSuperYoloStuckTimer method.
	 */
	function createTask(getStateOverride?: any): Task {
		if (getStateOverride) {
			mockProvider.getState = vi.fn().mockResolvedValue(getStateOverride)
		} else {
			mockProvider.getState = vi.fn().mockResolvedValue({})
		}

		return new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})
	}

	describe("should NOT start timer for terminal ask types", () => {
		it("should not start timer for completion_result", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			// Call the private method
			await (task as any).startSuperYoloStuckTimer("completion_result")

			// Timer should NOT be set
			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})

		it("should not start timer for resume_completed_task", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("resume_completed_task")

			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})

		it("should not start timer for resume_task", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("resume_task")

			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})
	})

	describe("should start timer for other ask types when Super YOLO is enabled", () => {
		it("should start timer for command ask type", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("command")

			// Timer SHOULD be set
			expect((task as any).superYoloStuckTimeoutRef).toBeDefined()
		})

		it("should start timer for tool ask type", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("tool")

			expect((task as any).superYoloStuckTimeoutRef).toBeDefined()
		})

		it("should start timer for followup ask type", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("followup")

			expect((task as any).superYoloStuckTimeoutRef).toBeDefined()
		})

		it("should start timer for command_output ask type", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("command_output")

			expect((task as any).superYoloStuckTimeoutRef).toBeDefined()
		})
	})

	describe("should NOT start timer when Super YOLO is disabled", () => {
		it("should not start timer when autoApprovalEnabled is false", async () => {
			const task = createTask({
				autoApprovalEnabled: false,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("command")

			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})

		it("should not start timer when superYoloMode is false", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: false,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("command")

			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})

		it("should not start timer when both are disabled", async () => {
			const task = createTask({
				autoApprovalEnabled: false,
				superYoloMode: false,
			})

			await (task as any).startSuperYoloStuckTimer("tool")

			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})
	})

	describe("timer cancellation", () => {
		it("should cancel existing timer before starting a new one", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			// Start first timer
			await (task as any).startSuperYoloStuckTimer("command")
			const firstTimerRef = (task as any).superYoloStuckTimeoutRef
			expect(firstTimerRef).toBeDefined()

			// Start second timer - should cancel first
			await (task as any).startSuperYoloStuckTimer("tool")
			const secondTimerRef = (task as any).superYoloStuckTimeoutRef
			expect(secondTimerRef).toBeDefined()
			expect(secondTimerRef).not.toBe(firstTimerRef)
		})

		it("should cancel timer via cancelSuperYoloStuckTimer", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("command")
			expect((task as any).superYoloStuckTimeoutRef).toBeDefined()
			;(task as any).cancelSuperYoloStuckTimer()
			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})

		it("should cancel timer via cancelAutoApprovalTimeout", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			await (task as any).startSuperYoloStuckTimer("command")
			expect((task as any).superYoloStuckTimeoutRef).toBeDefined()

			task.cancelAutoApprovalTimeout()
			expect((task as any).superYoloStuckTimeoutRef).toBeUndefined()
		})
	})

	describe("guard clause return-early behavior", () => {
		it("should return early for completion_result without calling getState", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			// Clear mock call count after construction
			mockProvider.getState.mockClear()

			await (task as any).startSuperYoloStuckTimer("completion_result")

			// getState should NOT be called because the guard clause returns early
			expect(mockProvider.getState).not.toHaveBeenCalled()
		})

		it("should return early for resume_completed_task without calling getState", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			mockProvider.getState.mockClear()

			await (task as any).startSuperYoloStuckTimer("resume_completed_task")

			expect(mockProvider.getState).not.toHaveBeenCalled()
		})

		it("should return early for resume_task without calling getState", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			mockProvider.getState.mockClear()

			await (task as any).startSuperYoloStuckTimer("resume_task")

			expect(mockProvider.getState).not.toHaveBeenCalled()
		})

		it("should call getState for non-guarded ask types", async () => {
			const task = createTask({
				autoApprovalEnabled: true,
				superYoloMode: true,
				superYoloStuckTimeoutMs: 60000,
			})

			mockProvider.getState.mockClear()

			await (task as any).startSuperYoloStuckTimer("command")

			// getState SHOULD be called because "command" is not in the guard list
			expect(mockProvider.getState).toHaveBeenCalled()
		})
	})
})
