import React from "react"
import { render, screen, fireEvent, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import FileChangesPanel from "../FileChangesPanel"
import { vscode } from "@src/utils/vscode"

// Mock vscode module
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: any) => {
			if (key === "chat:fileChangesInConversation.header") {
				return `${params?.count ?? 0} file changes`
			}
			return key
		},
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	initReactI18next: { type: "3rdParty", init: () => {} },
}))

// Mock diff module
vi.mock("diff", () => ({
	createTwoFilesPatch: (path1: string, path2: string, content1: string, content2: string) => {
		return `--- ${path1}\n+++ ${path2}\n@@ -1 +1 @@\n-${content1}\n+${content2}\n`
	},
}))

// Track expanded state for CodeAccordian mock
const mockCodeAccordianProps = new Map<string, any>()

// Mock CodeAccordian to simplify testing
vi.mock("@src/components/common/CodeAccordian", () => ({
	default: ({
		path,
		code,
		language,
		isExpanded,
		onToggleExpand,
		diffStats,
		onJumpToFile,
	}: {
		path?: string
		code?: string
		language: string
		isExpanded: boolean
		onToggleExpand: () => void
		diffStats?: { added: number; removed: number }
		onJumpToFile?: () => void
	}) => {
		// Store props for test inspection
		if (path) {
			mockCodeAccordianProps.set(path, { isExpanded, diffStats, onJumpToFile })
		}
		return (
			<div data-testid="code-accordian" data-path={path} data-expanded={isExpanded}>
				<div data-testid="file-path">{path}</div>
				<div data-testid="diff-content">{code}</div>
				<div data-testid="language">{language}</div>
				{diffStats && (
					<div data-testid="diff-stats">
						<span data-testid="added">+{diffStats.added}</span>
						<span data-testid="removed">-{diffStats.removed}</span>
					</div>
				)}
				{onJumpToFile && (
					<button data-testid="jump-to-file" onClick={onJumpToFile}>
						Jump to file
					</button>
				)}
				<button data-testid="toggle-expand" onClick={onToggleExpand}>
					{isExpanded ? "Collapse" : "Expand"}
				</button>
			</div>
		)
	},
}))

const queryClient = new QueryClient()

function renderFileChangesPanel(clineMessages?: any[]) {
	mockCodeAccordianProps.clear()
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<TranslationProvider>
					<FileChangesPanel clineMessages={clineMessages} />
				</TranslationProvider>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("FileChangesPanel", () => {
	const mockVscodePostMessage = vscode.postMessage as jest.MockedFunction<typeof vscode.postMessage>

	beforeEach(() => {
		vi.clearAllMocks()
		mockCodeAccordianProps.clear()
	})

	describe("empty state", () => {
		it("renders nothing when messages are undefined", () => {
			const { container } = renderFileChangesPanel(undefined)
			expect(container.firstChild).toBeNull()
		})

		it("renders nothing when messages array is empty", () => {
			const { container } = renderFileChangesPanel([])
			expect(container.firstChild).toBeNull()
		})

		it("renders nothing when there are no file changes in messages", () => {
			const messages = [
				{ type: "text" as const, ts: Date.now(), text: "Hello" },
				{ type: "say" as const, say: "text", ts: Date.now(), text: "World" },
			]
			const { container } = renderFileChangesPanel(messages)
			expect(container.firstChild).toBeNull()
		})
	})

	describe("rendering with file changes", () => {
		const createToolMessage = (toolData: any) => ({
			type: "ask" as const,
			ask: "tool" as const,
			ts: Date.now(),
			partial: false,
			isAnswered: true,
			text: JSON.stringify(toolData),
		})

		it("renders file changes panel with file count", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file.ts",
					diff: "+new line",
					diffStats: { added: 1, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			expect(screen.getByText("1 file changes")).toBeInTheDocument()
		})

		it("renders multiple file changes with correct count", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file1.ts",
					diff: "diff1",
					diffStats: { added: 1, removed: 0 },
				}),
				createToolMessage({
					tool: "newFileCreated",
					path: "src/file2.ts",
					content: "content2",
					diffStats: { added: 2, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			expect(screen.getByText("2 file changes")).toBeInTheDocument()
		})

		it("shows total diff stats in header", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file1.ts",
					diff: "diff1",
					diffStats: { added: 3, removed: 1 },
				}),
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file2.ts",
					diff: "diff2",
					diffStats: { added: 2, removed: 2 },
				}),
			]

			renderFileChangesPanel(messages)

			expect(screen.getByTestId("total-added")).toHaveTextContent("+5")
			expect(screen.getByTestId("total-removed")).toHaveTextContent("-3")
		})

		it("hides diff stats when there are no additions or removals", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file.ts",
					diff: "diff",
					diffStats: { added: 0, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			expect(screen.queryByTestId("total-added")).not.toBeInTheDocument()
			expect(screen.queryByTestId("total-removed")).not.toBeInTheDocument()
		})
	})

	describe("expand/collapse functionality", () => {
		const createToolMessage = (toolData: any) => ({
			type: "ask" as const,
			ask: "tool" as const,
			ts: Date.now(),
			partial: false,
			isAnswered: true,
			text: JSON.stringify(toolData),
		})

		it("toggles panel expansion when clicking header", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file.ts",
					diff: "diff",
					diffStats: { added: 1, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			// Panel should be collapsed initially (data-state="closed")
			const panel = screen.getByRole("button")
			expect(panel).toHaveAttribute("aria-expanded", "false")

			// Click to expand
			fireEvent.click(panel)

			// Panel should now be expanded
			expect(panel).toHaveAttribute("aria-expanded", "true")
		})

		it("toggles individual file expansion after panel is expanded", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file.ts",
					diff: "diff",
					diffStats: { added: 1, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			// First expand the panel
			const panelButton = screen.getByRole("button")
			fireEvent.click(panelButton)

			// Now the CodeAccordian should be rendered
			// Click expand on the file
			const expandButton = screen.getByTestId("toggle-expand")
			fireEvent.click(expandButton)

			// File should now be expanded
			const codeAccordian = screen.getByTestId("code-accordian")
			expect(codeAccordian).toHaveAttribute("data-expanded", "true")
		})
	})

	describe("file click navigation", () => {
		const createToolMessage = (toolData: any) => ({
			type: "ask" as const,
			ask: "tool" as const,
			ts: Date.now(),
			partial: false,
			isAnswered: true,
			text: JSON.stringify(toolData),
		})

		it("sends openFile message when clicking jump to file", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/components/Button.tsx",
					diff: "diff",
					diffStats: { added: 1, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			// First expand the panel
			const panelButton = screen.getByRole("button")
			fireEvent.click(panelButton)

			const jumpButton = screen.getByTestId("jump-to-file")
			fireEvent.click(jumpButton)

			expect(mockVscodePostMessage).toHaveBeenCalledWith({
				type: "openFile",
				text: "./src/components/Button.tsx",
			})
		})

		it("handles paths starting with dot correctly", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "./src/file.ts",
					diff: "diff",
					diffStats: { added: 1, removed: 0 },
				}),
			]

			renderFileChangesPanel(messages)

			// First expand the panel
			const panelButton = screen.getByRole("button")
			fireEvent.click(panelButton)

			const jumpButton = screen.getByTestId("jump-to-file")
			fireEvent.click(jumpButton)

			expect(mockVscodePostMessage).toHaveBeenCalledWith({
				type: "openFile",
				text: "./src/file.ts",
			})
		})
	})

	describe("message handling", () => {
		it("listens for fileContent messages", async () => {
			const messages = [
				{
					type: "ask" as const,
					ask: "tool" as const,
					ts: Date.now(),
					partial: false,
					isAnswered: true,
					text: JSON.stringify({
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "diff",
						diffStats: { added: 1, removed: 0 },
						originalContent: "original",
					}),
				},
			]

			renderFileChangesPanel(messages)

			// First expand the panel
			const panelButton = screen.getByRole("button")
			fireEvent.click(panelButton)

			// Expand the file to trigger file content request
			const expandButton = screen.getByTestId("toggle-expand")
			fireEvent.click(expandButton)

			// Wait for vscode.postMessage to be called for readFileContent
			await waitFor(() => {
				expect(mockVscodePostMessage).toHaveBeenCalledWith(
					expect.objectContaining({
						type: "readFileContent",
					}),
				)
			})

			// Simulate fileContent response
			window.postMessage(
				{
					type: "fileContent",
					fileContent: {
						path: "src/file.ts",
						content: "final content",
					},
				},
				"*",
			)

			// Wait for the content to be processed
			await waitFor(() => {
				// The component should have received the file content
				expect(mockVscodePostMessage).toHaveBeenCalled()
			})
		})
	})

	describe("deduplication display", () => {
		const createToolMessage = (toolData: any) => ({
			type: "ask" as const,
			ask: "tool" as const,
			ts: Date.now(),
			partial: false,
			isAnswered: true,
			text: JSON.stringify(toolData),
		})

		it("shows only one entry for files with multiple edits", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file.ts",
					diff: "first diff",
					diffStats: { added: 1, removed: 0 },
				}),
				createToolMessage({
					tool: "editedExistingFile",
					path: "src/file.ts",
					diff: "second diff",
					diffStats: { added: 2, removed: 1 },
				}),
			]

			renderFileChangesPanel(messages)

			// Should only show 1 file change (deduplicated)
			expect(screen.getByText("1 file changes")).toBeInTheDocument()

			// Expand panel to check the displayed stats
			const panelButton = screen.getByRole("button")
			fireEvent.click(panelButton)

			// Should show the latest diff stats in the CodeAccordian
			const codeAccordian = screen.getByTestId("code-accordian")
			expect(codeAccordian).toBeInTheDocument()
		})
	})

	describe("batch diffs", () => {
		const createToolMessage = (toolData: any) => ({
			type: "ask" as const,
			ask: "tool" as const,
			ts: Date.now(),
			partial: false,
			isAnswered: true,
			text: JSON.stringify(toolData),
		})

		it("renders multiple files from batchDiffs", () => {
			const messages = [
				createToolMessage({
					tool: "editedExistingFile",
					batchDiffs: [
						{
							path: "src/file1.ts",
							content: "content1",
							diffStats: { added: 2, removed: 1 },
						},
						{
							path: "src/file2.ts",
							content: "content2",
							diffStats: { added: 1, removed: 2 },
						},
					],
				}),
			]

			renderFileChangesPanel(messages)

			expect(screen.getByText("2 file changes")).toBeInTheDocument()
		})
	})
})
