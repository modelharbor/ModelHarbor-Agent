import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"

// import { shareResponseSchema } from "@roo-code/types"
// import { getRooCodeApiUrl } from "./Config"
import type { AuthService } from "./AuthService"
import type { SettingsService } from "./SettingsService"
// import { getUserAgent } from "./utils"

export type ShareVisibility = "organization" | "public"

export class TaskNotFoundError extends Error {
	constructor(taskId?: string) {
		super(taskId ? `Task '${taskId}' not found` : "Task not found")
		Object.setPrototypeOf(this, TaskNotFoundError.prototype)
	}
}

export class ShareService {
	private authService: AuthService
	private settingsService: SettingsService
	private log: (...args: unknown[]) => void

	constructor(authService: AuthService, settingsService: SettingsService, log?: (...args: unknown[]) => void) {
		this.authService = authService
		this.settingsService = settingsService
		this.log = log || console.log
	}

	/**
	 * Open the chat folder for a task in the system's file explorer
	 */
	async openChatFolder(taskId: string, workspacePath: string): Promise<{ success: boolean; error?: string }> {
		try {
			if (!taskId || !workspacePath) {
				return { success: false, error: "No active task" }
			}

			const taskFolder = path.join(workspacePath, ".roo", "tasks", taskId)

			if (!fs.existsSync(taskFolder)) {
				return { success: false, error: "Task folder not found" }
			}

			// Open the folder in the system's file explorer
			await vscode.env.openExternal(vscode.Uri.file(taskFolder))

			return { success: true }
		} catch (error) {
			this.log("[share] Error opening chat folder:", error)
			return { success: false, error: "Failed to open chat folder" }
		}
	}

	/**
	 * Share a task by opening its chat folder
	 * @deprecated Use openChatFolder directly
	 */
	async shareTask(
		taskId: string,
		// visibility: ShareVisibility = "organization",
		workspacePath?: string,
	): Promise<{ success: boolean; error?: string; shareUrl?: string }> {
		if (workspacePath) {
			// Use the new folder opening approach
			const result = await this.openChatFolder(taskId, workspacePath)
			return result
		}

		// Return error if no workspace path is provided
		return { success: false, error: "No active task" }
	}

	/**
	 * Check if sharing is available
	 */
	async canShareTask(): Promise<boolean> {
		try {
			if (!this.authService.isAuthenticated()) {
				return false
			}

			return !!this.settingsService.getSettings()?.cloudSettings?.enableTaskSharing
		} catch (error) {
			this.log("[share] Error checking if task can be shared:", error)
			return false
		}
	}
}
