const fs = require("node:fs")

const source = fs.readFileSync("packages/types/src/mode.ts", "utf8")
const match = source.match(/slug: "orchestrator"[\s\S]*?customInstructions:\s*\n\s*"((?:\\.|[^"\\])*)"/)

if (!match) {
	throw new Error("orchestrator customInstructions not found")
}

const current = JSON.parse(`"${match[1]}"`)
const marker = "When making changes, you should: "
const markerIndex = current.indexOf(marker)

if (markerIndex === -1) {
	throw new Error("append marker not found")
}

const currentAppend = current.slice(markerIndex)
const targetAppend = [
	"When making changes, you should: ",
	"-update UI, database, backend service, testing script.Then, run both unit tests and integration tests, fix the failing tests.",
	"- When you want to test and run the command to test the functionalities, you prefer write creating a file that contains complex commands rather than writing commands directly.",
	"",
	"- Update document .md file and write them as journal group by date and also update test scripts for all changes.",
	"",
	" - Do apply database migrations if needed. ",
	"",
	" - Do not run the command that will get stuck and wait for the user's input like starting web server, you need to make it through by running it background and read the output from file afterwards. Then, if you want to restart just kill the process and start a new process again.",
	"",
	"- Verify your edit by  performing linting, type checking, compilation.",
].join("\n")

const currentLines = currentAppend.split("\n")
const targetLines = targetAppend.split("\n")

let firstDiffIndex = -1
for (let i = 0; i < Math.max(currentAppend.length, targetAppend.length); i++) {
	if (currentAppend[i] !== targetAppend[i]) {
		firstDiffIndex = i
		break
	}
}

const lineDiffs = []
for (let i = 0; i < Math.max(currentLines.length, targetLines.length); i++) {
	const currentLine = currentLines[i] ?? ""
	const targetLine = targetLines[i] ?? ""

	if (currentLine !== targetLine) {
		let column = -1
		for (let j = 0; j < Math.max(currentLine.length, targetLine.length); j++) {
			if (currentLine[j] !== targetLine[j]) {
				column = j + 1
				break
			}
		}

		lineDiffs.push({
			line: i + 1,
			column,
			current: currentLine,
			target: targetLine,
			currentLength: currentLine.length,
			targetLength: targetLine.length,
		})
	}
}

const result = {
	currentFullLength: current.length,
	upstreamLength: markerIndex,
	currentAppendLength: currentAppend.length,
	targetAppendLength: targetAppend.length,
	matchesTargetAppend: currentAppend === targetAppend,
	firstDiffIndex,
	firstDiffCurrentChar: firstDiffIndex === -1 ? null : currentAppend[firstDiffIndex],
	firstDiffTargetChar: firstDiffIndex === -1 ? null : targetAppend[firstDiffIndex],
	firstDiffCurrentContext:
		firstDiffIndex === -1
			? null
			: currentAppend.slice(Math.max(0, firstDiffIndex - 20), Math.min(currentAppend.length, firstDiffIndex + 20)),
	firstDiffTargetContext:
		firstDiffIndex === -1
			? null
			: targetAppend.slice(Math.max(0, firstDiffIndex - 20), Math.min(targetAppend.length, firstDiffIndex + 20)),
	lineDiffs,
}

console.log(JSON.stringify(result, null, 2))