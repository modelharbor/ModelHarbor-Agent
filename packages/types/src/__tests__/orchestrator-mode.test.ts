import { DEFAULT_MODES } from "../mode.js"

describe("orchestrator mode customInstructions", () => {
	const orchestratorMode = DEFAULT_MODES.find((m) => m.slug === "orchestrator")

	test("orchestrator mode exists", () => {
		expect(orchestratorMode).toBeDefined()
	})

	test("customInstructions contains run tests instruction after testing script", () => {
		expect(orchestratorMode!.customInstructions).toContain(
			"testing script.Then, run both unit tests and integration tests, fix the failing tests.",
		)
	})

	test("customInstructions ends with verify edit instruction", () => {
		expect(orchestratorMode!.customInstructions).toContain(
			"- Verify your edit by  performing linting, type checking, compilation.",
		)
		// It should be the last meaningful line
		const lines = orchestratorMode!.customInstructions!.trimEnd().split("\n")
		const lastNonEmptyLine = lines.reverse().find((line) => line.trim().length > 0)
		expect(lastNonEmptyLine?.trim()).toBe("- Verify your edit by  performing linting, type checking, compilation.")
	})

	test("customInstructions matches exact expected content for the when-making-changes section", () => {
		const expectedSection = `When making changes, you should: 
-update UI, database, backend service, testing script.Then, run both unit tests and integration tests, fix the failing tests.
- When you want to test and run the command to test the functionalities, you prefer write creating a file that contains complex commands rather than writing commands directly.

- Update document .md file and write them as journal group by date and also update test scripts for all changes.

 - Do apply database migrations if needed. 

 - Do not run the command that will get stuck and wait for the user's input like starting web server, you need to make it through by running it background and read the output from file afterwards. Then, if you want to restart just kill the process and start a new process again.

- Verify your edit by  performing linting, type checking, compilation.`

		expect(orchestratorMode!.customInstructions).toContain(expectedSection)
	})
})
