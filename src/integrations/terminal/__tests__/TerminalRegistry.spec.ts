// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

const PAGER = process.platform === "win32" ? "" : "cat"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

describe("TerminalRegistry", () => {
	let mockCreateTerminal: any

	beforeEach(() => {
		mockCreateTerminal = vi.spyOn(vscode.window, "createTerminal").mockImplementation(
			(...args: any[]) =>
				({
					exitStatus: undefined,
					name: "ModelHarbor",
					processId: Promise.resolve(123),
					creationOptions: {},
					state: {
						isInteractedWith: true,
						shell: { id: "test-shell", executable: "/bin/bash", args: [] },
					},
					dispose: vi.fn(),
					hide: vi.fn(),
					show: vi.fn(),
					sendText: vi.fn(),
					shellIntegration: {
						executeCommand: vi.fn(),
					},
				}) as any,
		)
	})

	describe("onDidEndTerminalShellExecution - completion detection fix", () => {
		let endHandler: (e: any) => Promise<void>

		beforeEach(() => {
			// Reset TerminalRegistry singleton state
			TerminalRegistry["isInitialized"] = false
			TerminalRegistry["terminals"] = []
			TerminalRegistry["disposables"] = []

			// Mock the shell execution event handlers to capture the end handler
			;(vscode.window as any).onDidEndTerminalShellExecution = vi.fn((handler: any) => {
				endHandler = handler
				return { dispose: vi.fn() }
			})
			;(vscode.window as any).onDidStartTerminalShellExecution = vi.fn(() => {
				return { dispose: vi.fn() }
			})
			// Mock onDidCloseTerminal (used in initialize)
			vi.spyOn(vscode.window, "onDidCloseTerminal").mockReturnValue({ dispose: vi.fn() } as any)

			TerminalRegistry.initialize()
		})

		afterEach(() => {
			TerminalRegistry.cleanup()
			TerminalRegistry["isInitialized"] = false
		})

		it("calls shellExecutionComplete even when terminal.running is false", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})

			const mockVsceTerminal = {
				exitStatus: undefined,
				name: "ModelHarbor",
				processId: Promise.resolve(123),
				creationOptions: {},
				state: { isInteractedWith: true },
				dispose: vi.fn(),
				hide: vi.fn(),
				show: vi.fn(),
				sendText: vi.fn(),
				shellIntegration: { executeCommand: vi.fn() },
			} as any

			const terminal = new Terminal(99, mockVsceTerminal, "/test/path")
			TerminalRegistry["terminals"].push(terminal)

			// Ensure terminal is NOT running
			terminal.running = false

			const completeSpy = vi.spyOn(terminal, "shellExecutionComplete")

			// Fire the onDidEndTerminalShellExecution event
			await endHandler({
				terminal: mockVsceTerminal,
				execution: { commandLine: { value: "test command" } },
				exitCode: 0,
			})

			// Verify shellExecutionComplete was called despite running=false
			expect(completeSpy).toHaveBeenCalledWith(expect.objectContaining({ exitCode: 0 }))

			warnSpy.mockRestore()
			infoSpy.mockRestore()
		})

		it("does not call shellExecutionComplete for unregistered terminals", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})

			const unregisteredVsceTerminal = {
				exitStatus: undefined,
				name: "Unknown",
				processId: Promise.resolve(999),
			} as any

			await endHandler({
				terminal: unregisteredVsceTerminal,
				execution: { commandLine: { value: "unknown" } },
				exitCode: 1,
			})

			// Should have logged an error about unregistered terminal
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[onDidEndTerminalShellExecution]"),
				expect.anything(),
			)

			errorSpy.mockRestore()
			infoSpy.mockRestore()
		})
	})

	describe("createTerminal", () => {
		it("creates terminal with PAGER set appropriately for platform", () => {
			TerminalRegistry.createTerminal("/test/path", "vscode")

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "ModelHarbor",
				iconPath: expect.any(Object),
				env: {
					PAGER,
					VTE_VERSION: "0",
					PROMPT_EOL_MARK: "",
				},
			})
		})

		it("adds PROMPT_COMMAND when Terminal.getCommandDelay() > 0", () => {
			// Set command delay to 50ms for this test
			const originalDelay = Terminal.getCommandDelay()
			Terminal.setCommandDelay(50)

			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "ModelHarbor",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						PROMPT_COMMAND: "sleep 0.05",
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
					},
				})
			} finally {
				// Restore original delay
				Terminal.setCommandDelay(originalDelay)
			}
		})

		it("adds Oh My Zsh integration env var when enabled", () => {
			Terminal.setTerminalZshOhMy(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "ModelHarbor",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
						ITERM_SHELL_INTEGRATION_INSTALLED: "Yes",
					},
				})
			} finally {
				Terminal.setTerminalZshOhMy(false)
			}
		})

		it("adds Powerlevel10k integration env var when enabled", () => {
			Terminal.setTerminalZshP10k(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "ModelHarbor",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
						POWERLEVEL9K_TERM_SHELL_INTEGRATION: "true",
					},
				})
			} finally {
				Terminal.setTerminalZshP10k(false)
			}
		})
	})
})
