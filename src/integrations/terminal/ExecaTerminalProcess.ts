import { execa, ExecaError } from "execa"
import psTree from "ps-tree"
import process from "process"

import type { RooTerminal } from "./types"
import { BaseTerminalProcess } from "./BaseTerminalProcess"

/**
 * Recursively kills all processes in a process tree, starting from leaf nodes.
 * This ensures children are killed before parents for clean termination.
 *
 * @param pid - The root PID of the process tree to kill
 * @returns Promise that resolves when all processes have been killed
 */
async function killProcessTree(pid: number): Promise<void> {
	return new Promise((resolve) => {
		psTree(pid, (err, children) => {
			if (err) {
				// If we can't get the tree, just try to kill the root process
				console.warn(`[killProcessTree] Failed to get process tree for PID ${pid}: ${err.message}`)
				try {
					process.kill(pid, "SIGKILL")
					console.log(`[killProcessTree] SIGKILL -> ${pid}`)
				} catch (e) {
					// Process may already be dead
					console.warn(
						`[killProcessTree] Failed to kill PID ${pid}: ${e instanceof Error ? e.message : String(e)}`,
					)
				}
				resolve()
				return
			}

			// Get all descendant PIDs
			const descendantPids = children.map((p) => parseInt(p.PID)).filter((p) => !isNaN(p))

			// Kill in reverse order (children first, then parents)
			// This ensures leaf processes are terminated before their parents
			const pidsToKill = [...descendantPids].reverse()

			for (const childPid of pidsToKill) {
				try {
					process.kill(childPid, "SIGKILL")
					console.log(`[killProcessTree] SIGKILL child -> ${childPid}`)
				} catch (e) {
					// Process may already be dead, which is fine
					console.warn(
						`[killProcessTree] Failed to kill child PID ${childPid}: ${e instanceof Error ? e.message : String(e)}`,
					)
				}
			}

			// Finally kill the root process
			try {
				process.kill(pid, "SIGKILL")
				console.log(`[killProcessTree] SIGKILL root -> ${pid}`)
			} catch (e) {
				// Process may already be dead
				console.warn(
					`[killProcessTree] Failed to kill root PID ${pid}: ${e instanceof Error ? e.message : String(e)}`,
				)
			}

			resolve()
		})
	})
}

export class ExecaTerminalProcess extends BaseTerminalProcess {
	private terminalRef: WeakRef<RooTerminal>
	private aborted = false
	private pid?: number
	private shellPid?: number // Store original shell PID for process group killing
	private subprocess?: ReturnType<typeof execa>
	private pidUpdatePromise?: Promise<void>

	constructor(terminal: RooTerminal) {
		super()

		this.terminalRef = new WeakRef(terminal)

		this.once("completed", () => {
			this.terminal.busy = false
		})
	}

	public get terminal(): RooTerminal {
		const terminal = this.terminalRef.deref()

		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}

		return terminal
	}

	public override async run(command: string) {
		this.command = command

		try {
			this.isHot = true

			this.subprocess = execa({
				shell: true,
				cwd: this.terminal.getCurrentWorkingDirectory(),
				all: true,
				// Ignore stdin to ensure non-interactive mode and prevent hanging
				stdin: "ignore",
				env: {
					...process.env,
					// Ensure UTF-8 encoding for Ruby, CocoaPods, etc.
					LANG: "en_US.UTF-8",
					LC_ALL: "en_US.UTF-8",
				},
			})`${command}`

			this.pid = this.subprocess.pid
			this.shellPid = this.subprocess.pid // Store shell PID for process group killing

			// When using shell: true, the PID is for the shell, not the actual command
			// Find the actual command PID after a small delay
			if (this.pid) {
				this.pidUpdatePromise = new Promise<void>((resolve) => {
					setTimeout(() => {
						psTree(this.pid!, (err, children) => {
							if (!err && children.length > 0) {
								// Update PID to the first child (the actual command)
								const actualPid = parseInt(children[0].PID)
								if (!isNaN(actualPid)) {
									this.pid = actualPid
								}
							}
							resolve()
						})
					}, 100)
				})
			}

			// Wait for PID update to complete before notifying the UI
			// This ensures the UI receives the actual command PID, not the shell PID
			if (this.pidUpdatePromise) {
				await this.pidUpdatePromise
			}

			const rawStream = this.subprocess.iterable({ from: "all", preserveNewlines: true })

			// Wrap the stream to ensure all chunks are strings (execa can return Uint8Array)
			const stream = (async function* () {
				for await (const chunk of rawStream) {
					yield typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
				}
			})()

			this.terminal.setActiveStream(stream, this.pid)

			for await (const line of stream) {
				if (this.aborted) {
					break
				}

				this.fullOutput += line

				const now = Date.now()

				if (this.isListening && (now - this.lastEmitTime_ms > 500 || this.lastEmitTime_ms === 0)) {
					this.emitRemainingBufferIfListening()
					this.lastEmitTime_ms = now
				}

				this.startHotTimer(line)
			}

			if (this.aborted) {
				let timeoutId: NodeJS.Timeout | undefined

				const kill = new Promise<void>((resolve) => {
					console.log(`[ExecaTerminalProcess#run] SIGKILL -> ${this.pid}`)

					timeoutId = setTimeout(() => {
						try {
							this.subprocess?.kill("SIGKILL")
						} catch (e) {}

						resolve()
					}, 5_000)
				})

				try {
					await Promise.race([this.subprocess, kill])
				} catch (error) {
					console.log(
						`[ExecaTerminalProcess#run] subprocess termination error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}

				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}

			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			if (error instanceof ExecaError) {
				console.error(`[ExecaTerminalProcess#run] shell execution error: ${error.message}`)
				this.emit("shell_execution_complete", { exitCode: error.exitCode ?? 0, signalName: error.signal })
			} else {
				console.error(
					`[ExecaTerminalProcess#run] shell execution error: ${error instanceof Error ? error.message : String(error)}`,
				)

				this.emit("shell_execution_complete", { exitCode: 1 })
			}
			this.subprocess = undefined
		}

		this.terminal.setActiveStream(undefined)
		this.emitRemainingBufferIfListening()
		this.stopHotTimer()
		this.emit("completed", this.fullOutput)
		this.emit("continue")
		this.subprocess = undefined
	}

	public override continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public override async abort(): Promise<void> {
		this.aborted = true

		// Wait for PID update to complete before performing any kill operations
		// This ensures we have the correct PID to kill
		if (this.pidUpdatePromise) {
			try {
				await this.pidUpdatePromise
			} catch {
				// Ignore errors, proceed with kill using whatever PID we have
			}
		}

		// Kill the entire process tree starting from the shell
		// This recursively kills all descendants (grandchildren, etc.) from leaf nodes up
		if (this.shellPid) {
			console.log(`[ExecaTerminalProcess#abort] Killing process tree starting from shell PID ${this.shellPid}`)
			await killProcessTree(this.shellPid)
		}

		// Also kill using subprocess.kill as a fallback
		if (this.subprocess) {
			try {
				this.subprocess.kill("SIGKILL")
				console.log(`[ExecaTerminalProcess#abort] SIGKILL subprocess`)
			} catch (e) {
				// Process may already be dead
				console.warn(
					`[ExecaTerminalProcess#abort] Failed to kill subprocess: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
		}
	}

	public override hasUnretrievedOutput() {
		return this.lastRetrievedIndex < this.fullOutput.length
	}

	public override getUnretrievedOutput() {
		let output = this.fullOutput.slice(this.lastRetrievedIndex)
		let index = output.lastIndexOf("\n")

		if (index === -1) {
			return ""
		}

		index++
		this.lastRetrievedIndex += index

		// console.log(
		// 	`[ExecaTerminalProcess#getUnretrievedOutput] fullOutput.length=${this.fullOutput.length} lastRetrievedIndex=${this.lastRetrievedIndex}`,
		// 	output.slice(0, index),
		// )

		return output.slice(0, index)
	}

	private emitRemainingBufferIfListening() {
		if (!this.isListening) {
			return
		}

		const output = this.getUnretrievedOutput()

		if (output !== "") {
			this.emit("line", output)
		}
	}
}
