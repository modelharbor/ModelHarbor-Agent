// npx vitest run src/integrations/terminal/__tests__/TerminalRegistry.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

const PAGER = process.platform === "win32" ? "" : "cat"

// Mock the vscode module with shell execution events
vi.mock("vscode", () => {
	// Store event handlers so we can trigger them in tests
	const eventHandlers = {
		startTerminalShellExecution: null,
		endTerminalShellExecution: null,
		closeTerminal: null,
	}

	return {
		workspace: {
			getConfiguration: vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue(null),
			}),
		},
		window: {
			createTerminal: vi.fn(),
			onDidStartTerminalShellExecution: vi.fn().mockImplementation((handler) => {
				eventHandlers.startTerminalShellExecution = handler
				return { dispose: vi.fn() }
			}),
			onDidEndTerminalShellExecution: vi.fn().mockImplementation((handler) => {
				eventHandlers.endTerminalShellExecution = handler
				return { dispose: vi.fn() }
			}),
			onDidCloseTerminal: vi.fn().mockImplementation((handler) => {
				eventHandlers.closeTerminal = handler
				return { dispose: vi.fn() }
			}),
		},
		ThemeIcon: class ThemeIcon {
			constructor(id: string) {
				this.id = id
			}
			id: string
		},
		Uri: {
			file: (path: string) => ({ fsPath: path }),
		},
		// Expose event handlers for testing
		__eventHandlers: eventHandlers,
	}
})

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
					name: "Roo Code",
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

	describe("createTerminal", () => {
		it("creates terminal with PAGER set appropriately for platform", () => {
			TerminalRegistry.createTerminal("/test/path", "vscode")

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "ModelHarbor Agent",
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
					name: "ModelHarbor Agent",
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
					name: "ModelHarbor Agent",
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
					name: "ModelHarbor Agent",
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

	describe("shell execution event handlers", () => {
		let consoleSpy: any

		beforeAll(() => {
			// Initialize the registry once for all tests in this describe block
			TerminalRegistry.initialize()
		})

		beforeEach(() => {
			consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
		})

		afterEach(() => {
			consoleSpy.mockRestore()
		})

		it("handles shell execution from non-ModelHarbor terminals gracefully", () => {
			// Create a mock terminal that's NOT in the ModelHarbor registry
			const mockNonModelHarborTerminal = {
				name: "User Terminal",
				exitStatus: undefined,
			}

			// Create a mock shell execution start event
			const mockStartEvent = {
				terminal: mockNonModelHarborTerminal,
				execution: {
					commandLine: { value: "ls -la" },
					read: () =>
						(async function* () {
							yield "test output"
						})(),
				},
			}

			// Get the event handlers from the mock
			const eventHandlers = (vscode as any).__eventHandlers

			// Simulate shell execution start from non-ModelHarbor terminal
			if (eventHandlers.startTerminalShellExecution) {
				eventHandlers.startTerminalShellExecution(mockStartEvent)
			}

			// Should log debug message instead of error
			expect(consoleSpy).toHaveBeenCalledWith(
				"[onDidStartTerminalShellExecution] Shell execution started from non-ModelHarbor terminal (this is normal):",
				{
					terminalName: "User Terminal",
					command: "ls -la",
				},
			)
		})

		it("handles shell execution end from non-ModelHarbor terminals gracefully", () => {
			// Create a mock terminal that's NOT in the ModelHarbor registry
			const mockNonModelHarborTerminal = {
				name: "User Terminal",
				exitStatus: undefined,
			}

			// Create a mock shell execution end event
			const mockEndEvent = {
				terminal: mockNonModelHarborTerminal,
				execution: {
					commandLine: { value: "ls -la" },
				},
				exitCode: 0,
			}

			// Get the event handlers from the mock
			const eventHandlers = (vscode as any).__eventHandlers

			// Simulate shell execution end from non-ModelHarbor terminal
			if (eventHandlers.endTerminalShellExecution) {
				eventHandlers.endTerminalShellExecution(mockEndEvent)
			}

			// Should log debug message instead of error
			expect(consoleSpy).toHaveBeenCalledWith(
				"[onDidEndTerminalShellExecution] Shell execution ended from non-ModelHarbor terminal (this is normal):",
				{
					terminalName: "User Terminal",
					command: "ls -la",
					exitCode: 0,
				},
			)
		})
	})
})
