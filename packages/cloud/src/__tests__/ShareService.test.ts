/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MockedFunction } from "vitest"
import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"

import { ShareService } from "../ShareService"
import type { AuthService } from "../auth/AuthService"
import type { SettingsService } from "../SettingsService"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// Mock fs
vi.mock("fs", () => ({
	existsSync: vi.fn(),
}))

// Mock path
vi.mock("path", () => ({
	join: vi.fn(),
}))

// Mock vscode
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showQuickPick: vi.fn(),
	},
	env: {
		clipboard: {
			writeText: vi.fn(),
		},
		openExternal: vi.fn(),
	},
	Uri: {
		parse: vi.fn(),
		file: vi.fn(),
	},
	extensions: {
		getExtension: vi.fn(() => ({
			packageJSON: { version: "1.0.0" },
		})),
	},
}))

// Mock config
vi.mock("../Config", () => ({
	getRooCodeApiUrl: () => "https://app.roocode.com",
}))

// Mock utils
vi.mock("../utils", () => ({
	getUserAgent: () => "Roo-Code 1.0.0",
}))

describe("ShareService", () => {
	let shareService: ShareService
	let mockAuthService: AuthService
	let mockSettingsService: SettingsService
	let mockLog: MockedFunction<(...args: unknown[]) => void>

	beforeEach(() => {
		vi.clearAllMocks()
		mockFetch.mockClear()

		mockLog = vi.fn()
		mockAuthService = {
			hasActiveSession: vi.fn(),
			getSessionToken: vi.fn(),
			isAuthenticated: vi.fn(),
		} as any

		mockSettingsService = {
			getSettings: vi.fn(),
		} as any

		shareService = new ShareService(mockAuthService, mockSettingsService, mockLog)
	})

	describe("openChatFolder", () => {
		it("should open chat folder when task folder exists", async () => {
			// Mock the task folder exists
			;(fs.existsSync as any).mockReturnValue(true)
			;(path.join as any).mockReturnValue("/workspace/.roo/tasks/task-123")
			const mockUri = { fsPath: "/workspace/.roo/tasks/task-123" }
			;(vscode.Uri.file as any).mockReturnValue(mockUri)
			;(vscode.env.openExternal as any).mockResolvedValue(undefined)

			const result = await shareService.openChatFolder("task-123", "/workspace")

			expect(result.success).toBe(true)
			expect(fs.existsSync).toHaveBeenCalledWith("/workspace/.roo/tasks/task-123")
			expect(vscode.env.openExternal).toHaveBeenCalledWith(mockUri)
		})

		it("should return error when task folder does not exist", async () => {
			// Mock the task folder does not exist
			;(fs.existsSync as any).mockReturnValue(false)
			;(path.join as any).mockReturnValue("/workspace/.roo/tasks/task-123")

			const result = await shareService.openChatFolder("task-123", "/workspace")

			expect(result.success).toBe(false)
			expect(result.error).toBe("Task folder not found")
			expect(fs.existsSync).toHaveBeenCalledWith("/workspace/.roo/tasks/task-123")
			expect(vscode.env.openExternal).not.toHaveBeenCalled()
		})

		it("should return error when workspace path is not provided", async () => {
			const result = await shareService.openChatFolder("task-123", "")

			expect(result.success).toBe(false)
			expect(result.error).toBe("No active task")
			expect(fs.existsSync).not.toHaveBeenCalled()
			expect(vscode.env.openExternal).not.toHaveBeenCalled()
		})

		it("should return error when task ID is not provided", async () => {
			const result = await shareService.openChatFolder("", "/workspace")

			expect(result.success).toBe(false)
			expect(result.error).toBe("No active task")
			expect(fs.existsSync).not.toHaveBeenCalled()
			expect(vscode.env.openExternal).not.toHaveBeenCalled()
		})

		it("should handle errors when opening external folder", async () => {
			// Mock the task folder exists
			;(fs.existsSync as any).mockReturnValue(true)
			;(path.join as any).mockReturnValue("/workspace/.roo/tasks/task-123")
			const mockUri = { fsPath: "/workspace/.roo/tasks/task-123" }
			;(vscode.Uri.file as any).mockReturnValue(mockUri)
			;(vscode.env.openExternal as any).mockRejectedValue(new Error("Failed to open"))

			const result = await shareService.openChatFolder("task-123", "/workspace")

			expect(result.success).toBe(false)
			expect(result.error).toBe("Failed to open chat folder")
			expect(fs.existsSync).toHaveBeenCalledWith("/workspace/.roo/tasks/task-123")
			expect(vscode.env.openExternal).toHaveBeenCalledWith(mockUri)
		})
	})

	describe("shareTask", () => {
		it("should delegate to openChatFolder", async () => {
			// Mock the task folder exists
			;(fs.existsSync as any).mockReturnValue(true)
			;(path.join as any).mockReturnValue("/workspace/.roo/tasks/task-123")
			const mockUri = { fsPath: "/workspace/.roo/tasks/task-123" }
			;(vscode.Uri.file as any).mockReturnValue(mockUri)
			;(vscode.env.openExternal as any).mockResolvedValue(undefined)

			const result = await shareService.shareTask("task-123", "/workspace")

			expect(result.success).toBe(true)
			expect(fs.existsSync).toHaveBeenCalledWith("/workspace/.roo/tasks/task-123")
			expect(vscode.env.openExternal).toHaveBeenCalledWith(mockUri)
		})

		it("should return error when workspace path is not provided", async () => {
			const result = await shareService.shareTask("task-123")

			expect(result.success).toBe(false)
			expect(result.error).toBe("No active task")
		})
	})

	describe("canShareTask", () => {
		it("should return true when authenticated and sharing is enabled", async () => {
			;(mockAuthService.isAuthenticated as any).mockReturnValue(true)
			;(mockSettingsService.getSettings as any).mockReturnValue({
				cloudSettings: {
					enableTaskSharing: true,
				},
			})

			const result = await shareService.canShareTask()

			expect(result).toBe(true)
		})

		it("should return false when authenticated but sharing is disabled", async () => {
			;(mockAuthService.isAuthenticated as any).mockReturnValue(true)
			;(mockSettingsService.getSettings as any).mockReturnValue({
				cloudSettings: {
					enableTaskSharing: false,
				},
			})

			const result = await shareService.canShareTask()

			expect(result).toBe(false)
		})

		it("should return false when authenticated and sharing setting is undefined (default)", async () => {
			;(mockAuthService.isAuthenticated as any).mockReturnValue(true)
			;(mockSettingsService.getSettings as any).mockReturnValue({
				cloudSettings: {},
			})

			const result = await shareService.canShareTask()

			expect(result).toBe(false)
		})

		it("should return false when authenticated and no settings available (default)", async () => {
			;(mockAuthService.isAuthenticated as any).mockReturnValue(true)
			;(mockSettingsService.getSettings as any).mockReturnValue(undefined)

			const result = await shareService.canShareTask()

			expect(result).toBe(false)
		})

		it("should return false when not authenticated", async () => {
			;(mockAuthService.isAuthenticated as any).mockReturnValue(false)

			const result = await shareService.canShareTask()

			expect(result).toBe(false)
		})

		it("should handle errors gracefully", async () => {
			;(mockAuthService.isAuthenticated as any).mockImplementation(() => {
				throw new Error("Auth error")
			})

			const result = await shareService.canShareTask()

			expect(result).toBe(false)
		})
	})
})
