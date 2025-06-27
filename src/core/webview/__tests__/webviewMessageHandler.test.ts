import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { webviewMessageHandler } from "../webviewMessageHandler"

// Mock vscode
vi.mock("vscode", () => ({
	commands: {
		executeCommand: vi.fn(),
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
	window: {
		showErrorMessage: vi.fn(),
	},
}))

// Mock other dependencies
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(),
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string) => key),
	changeLanguage: vi.fn(),
}))

describe("webviewMessageHandler", () => {
	let mockProvider: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			contextProxy: {
				getValue: vi.fn(),
				setValue: vi.fn(),
			},
			getCurrentCline: vi.fn(() => ({
				taskId: "test-task-123",
			})),
			getTaskWithId: vi.fn().mockResolvedValue({
				taskDirPath: "/test/workspace/.roo/tasks/test-task-123",
			}),
			log: vi.fn(),
			postStateToWebview: vi.fn(),
			postMessageToWebview: vi.fn(),
		}
	})

	describe("openChatFolder", () => {
		it("should open chat folder when task exists", async () => {
			const message = {
				type: "openChatFolder" as const,
			}

			await webviewMessageHandler(mockProvider, message)

			expect(mockProvider.getCurrentCline).toHaveBeenCalled()
			expect(mockProvider.getTaskWithId).toHaveBeenCalledWith("test-task-123")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", {
				fsPath: "/test/workspace/.roo/tasks/test-task-123",
			})
		})

		it("should show error when no active task", async () => {
			mockProvider.getCurrentCline.mockReturnValue(null)

			const message = {
				type: "openChatFolder" as const,
			}

			await webviewMessageHandler(mockProvider, message)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.no_active_task")
		})

		it("should show error when task folder not found", async () => {
			mockProvider.getTaskWithId.mockResolvedValue({ taskDirPath: null })

			const message = {
				type: "openChatFolder" as const,
			}

			await webviewMessageHandler(mockProvider, message)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("common:errors.task_folder_not_found")
		})
	})
})
