// npx vitest run integrations/terminal/__tests__/ExecaTerminalProcess.spec.ts

const mockPid = 12345
const mockChildPid = 54321
const mockGrandchildPid = 99999

vitest.mock("execa", () => {
	const mockKill = vitest.fn()
	const execa = vitest.fn((options: any) => {
		return (_template: TemplateStringsArray, ...args: any[]) => ({
			pid: mockPid,
			iterable: (_opts: any) =>
				(async function* () {
					yield "test output\n"
				})(),
			kill: mockKill,
		})
	})
	return { execa, ExecaError: class extends Error {} }
})

// Track psTree calls to simulate different tree structures
let psTreeBehavior: "default" | "deep-tree" | "error" = "default"
let psTreeCallback: (err: Error | null, children: Array<{ PID: string }>) => void = () => {}
vitest.mock("ps-tree", () => ({
	default: vitest.fn((pid: number, cb: any) => {
		psTreeCallback = cb
		// Different behaviors based on test scenario
		if (psTreeBehavior === "error") {
			setTimeout(() => cb(new Error("Process not found"), []), 0)
		} else if (psTreeBehavior === "deep-tree") {
			// Simulate a deep process tree: shell -> child -> grandchild
			setTimeout(() => cb(null, [{ PID: String(mockChildPid) }, { PID: String(mockGrandchildPid) }]), 0)
		} else {
			// Default behavior: return child pid after a tick
			setTimeout(() => cb(null, [{ PID: String(mockChildPid) }]), 0)
		}
	}),
}))

import { execa } from "execa"
import psTree from "ps-tree"
import { ExecaTerminalProcess } from "../ExecaTerminalProcess"
import type { RooTerminal } from "../types"

describe("ExecaTerminalProcess", () => {
	let mockTerminal: RooTerminal
	let terminalProcess: ExecaTerminalProcess
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		originalEnv = { ...process.env }
		mockTerminal = {
			provider: "execa",
			id: 1,
			busy: false,
			running: false,
			getCurrentWorkingDirectory: vitest.fn().mockReturnValue("/test/cwd"),
			isClosed: vitest.fn().mockReturnValue(false),
			runCommand: vitest.fn(),
			setActiveStream: vitest.fn(),
			shellExecutionComplete: vitest.fn(),
			getProcessesWithOutput: vitest.fn().mockReturnValue([]),
			getUnretrievedOutput: vitest.fn().mockReturnValue(""),
			getLastCommand: vitest.fn().mockReturnValue(""),
			cleanCompletedProcessQueue: vitest.fn(),
		} as unknown as RooTerminal
		terminalProcess = new ExecaTerminalProcess(mockTerminal)
	})

	afterEach(() => {
		process.env = originalEnv
		psTreeBehavior = "default"
		vitest.clearAllMocks()
	})

	describe("UTF-8 encoding fix", () => {
		it("should set LANG and LC_ALL to en_US.UTF-8", async () => {
			await terminalProcess.run("echo test")
			const execaMock = vitest.mocked(execa)
			expect(execaMock).toHaveBeenCalledWith(
				expect.objectContaining({
					shell: true,
					cwd: "/test/cwd",
					all: true,
					env: expect.objectContaining({
						LANG: "en_US.UTF-8",
						LC_ALL: "en_US.UTF-8",
					}),
				}),
			)
		})

		it("should preserve existing environment variables", async () => {
			process.env.EXISTING_VAR = "existing"
			terminalProcess = new ExecaTerminalProcess(mockTerminal)
			await terminalProcess.run("echo test")
			const execaMock = vitest.mocked(execa)
			const calledOptions = execaMock.mock.calls[0][0] as any
			expect(calledOptions.env.EXISTING_VAR).toBe("existing")
		})

		it("should override existing LANG and LC_ALL values", async () => {
			process.env.LANG = "C"
			process.env.LC_ALL = "POSIX"
			terminalProcess = new ExecaTerminalProcess(mockTerminal)
			await terminalProcess.run("echo test")
			const execaMock = vitest.mocked(execa)
			const calledOptions = execaMock.mock.calls[0][0] as any
			expect(calledOptions.env.LANG).toBe("en_US.UTF-8")
			expect(calledOptions.env.LC_ALL).toBe("en_US.UTF-8")
		})
	})

	describe("basic functionality", () => {
		it("should create instance with terminal reference", () => {
			expect(terminalProcess).toBeInstanceOf(ExecaTerminalProcess)
			expect(terminalProcess.terminal).toBe(mockTerminal)
		})

		it("should emit shell_execution_complete with exitCode 0", async () => {
			const spy = vitest.fn()
			terminalProcess.on("shell_execution_complete", spy)
			await terminalProcess.run("echo test")
			expect(spy).toHaveBeenCalledWith({ exitCode: 0 })
		})

		it("should emit completed event with full output", async () => {
			const spy = vitest.fn()
			terminalProcess.on("completed", spy)
			await terminalProcess.run("echo test")
			expect(spy).toHaveBeenCalledWith("test output\n")
		})

		it("should set and clear active stream", async () => {
			await terminalProcess.run("echo test")
			// After PID update, should use the child PID (54321), not shell PID (12345)
			expect(mockTerminal.setActiveStream).toHaveBeenCalledWith(expect.any(Object), mockChildPid)
			expect(mockTerminal.setActiveStream).toHaveBeenLastCalledWith(undefined)
		})
	})

	describe("PID race condition fix", () => {
		it("should wait for PID update before calling setActiveStream", async () => {
			const setActiveStreamCalls: Array<{ pid: number | undefined }> = []
			mockTerminal.setActiveStream = vitest.fn((stream, pid) => {
				setActiveStreamCalls.push({ pid })
			})

			await terminalProcess.run("echo test")

			// First call should have the updated child PID, not the shell PID
			expect(setActiveStreamCalls[0].pid).toBe(mockChildPid)
		})

		it("should store shell PID separately from command PID", async () => {
			await terminalProcess.run("echo test")

			// Access private properties via any cast for testing
			const process = terminalProcess as any
			expect(process.shellPid).toBe(mockPid)
			expect(process.pid).toBe(mockChildPid)
		})
	})

	describe("abort functionality", () => {
		it("should be an async function", () => {
			const abortResult = terminalProcess.abort()
			expect(abortResult).toBeInstanceOf(Promise)
		})

		it("should wait for PID update before killing", async () => {
			// Start running
			const runPromise = terminalProcess.run("echo test")

			// Mock process.kill
			const originalKill = process.kill
			const killSpy = vitest.fn()
			process.kill = killSpy as any

			try {
				// Abort should wait for PID update
				await terminalProcess.abort()

				// Verify kill was called (process group or individual)
				expect(killSpy).toHaveBeenCalled()
			} finally {
				process.kill = originalKill
				await runPromise.catch(() => {})
			}
		})

		it("should kill processes on Unix using killProcessTree", async () => {
			const originalPlatform = process.platform
			const originalKill = process.kill
			const killSpy = vitest.fn()

			// Mock platform as darwin (macOS)
			Object.defineProperty(process, "platform", { value: "darwin", configurable: true })
			process.kill = killSpy as any

			try {
				await terminalProcess.run("echo test")
				await terminalProcess.abort()

				// Should have killed the shell PID and its children
				expect(killSpy).toHaveBeenCalledWith(mockPid, "SIGKILL")
				expect(killSpy).toHaveBeenCalledWith(mockChildPid, "SIGKILL")
			} finally {
				Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true })
				process.kill = originalKill
			}
		})

		it("should kill entire process tree recursively", async () => {
			psTreeBehavior = "deep-tree"
			const originalKill = process.kill
			const killCalls: Array<{ pid: number; signal: string }> = []
			const killSpy = vitest.fn((pid: number, signal: string) => {
				killCalls.push({ pid, signal })
			})
			process.kill = killSpy as any

			try {
				await terminalProcess.run("echo test")
				await terminalProcess.abort()

				// Should have killed all processes in the tree
				const killedPids = killCalls.map((c) => c.pid)
				expect(killedPids).toContain(mockPid) // shell
				expect(killedPids).toContain(mockChildPid) // child
				expect(killedPids).toContain(mockGrandchildPid) // grandchild
			} finally {
				process.kill = originalKill
			}
		})

		it("should kill children before parents (bottom-up)", async () => {
			psTreeBehavior = "deep-tree"
			const originalKill = process.kill
			const killOrder: number[] = []
			const killSpy = vitest.fn((pid: number, signal: string) => {
				killOrder.push(pid)
			})
			process.kill = killSpy as any

			try {
				await terminalProcess.run("echo test")
				await terminalProcess.abort()

				// Grandchild should be killed before child, which should be killed before shell
				const grandchildIndex = killOrder.indexOf(mockGrandchildPid)
				const childIndex = killOrder.indexOf(mockChildPid)
				const shellIndex = killOrder.indexOf(mockPid)

				// Grandchild should come before child (due to reverse order)
				expect(grandchildIndex).toBeLessThan(childIndex)
				// Child should come before shell (root)
				expect(childIndex).toBeLessThan(shellIndex)
			} finally {
				process.kill = originalKill
			}
		})

		it("should handle psTree errors gracefully", async () => {
			psTreeBehavior = "error"
			const originalKill = process.kill
			const killSpy = vitest.fn()
			process.kill = killSpy as any

			try {
				await terminalProcess.run("echo test")
				// Should not throw
				await terminalProcess.abort()

				// Should still try to kill the root process
				expect(killSpy).toHaveBeenCalledWith(mockPid, "SIGKILL")
			} finally {
				process.kill = originalKill
			}
		})

		it("should handle already-dead processes gracefully", async () => {
			const originalKill = process.kill
			const killSpy = vitest.fn((pid: number, signal: string) => {
				// Simulate process already being dead
				const error = new Error("ESRCH: No such process")
				;(error as any).code = "ESRCH"
				throw error
			})
			process.kill = killSpy as any

			try {
				await terminalProcess.run("echo test")
				// Should not throw even when processes are already dead
				await expect(terminalProcess.abort()).resolves.toBeUndefined()
			} finally {
				process.kill = originalKill
			}
		})

		it("should use killProcessTree for entire tree termination", async () => {
			const originalKill = process.kill
			const killSpy = vitest.fn()
			process.kill = killSpy as any

			try {
				await terminalProcess.run("echo test")
				await terminalProcess.abort()

				// Verify psTree was called with shell PID
				expect(psTree).toHaveBeenCalledWith(mockPid, expect.any(Function))

				// Verify kills were issued
				expect(killSpy).toHaveBeenCalled()
			} finally {
				process.kill = originalKill
			}
		})
	})
})
