import type { HistoryItem } from "@roo-code/types"

import { render, screen, fireEvent } from "@/utils/test-utils"
import { vscode } from "@/utils/vscode"

import { TaskActions } from "../TaskActions"

// Mock scrollIntoView for JSDOM
Object.defineProperty(Element.prototype, "scrollIntoView", {
	value: vi.fn(),
	writable: true,
})

// Mock the vscode utility
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

const mockPostMessage = vi.mocked(vscode.postMessage)

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:task.export": "Export task history",
				"chat:task.delete": "Delete Task (Shift + Click to skip confirmation)",
				"history:copyPrompt": "Copy prompt",
			}
			return translations[key] || key
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

// Mock pretty-bytes
vi.mock("pretty-bytes", () => ({
	default: (bytes: number) => `${bytes} B`,
}))

describe("TaskActions", () => {
	const mockItem: HistoryItem = {
		id: "test-task-id",
		number: 1,
		ts: Date.now(),
		task: "Test task",
		tokensIn: 100,
		tokensOut: 200,
		totalCost: 0.01,
		size: 1024,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Actions", () => {
		it("renders export button", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			const exportButton = screen.getByLabelText("Export task history")
			expect(exportButton).toBeInTheDocument()
		})

		it("sends exportCurrentTask message when export button is clicked", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			const exportButton = screen.getByLabelText("Export task history")
			fireEvent.click(exportButton)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "exportCurrentTask",
			})
		})

		it("renders copy button when item has task", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			const copyButton = screen.getByLabelText("Copy prompt")
			expect(copyButton).toBeInTheDocument()
		})

		it("renders delete button when item has size", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			const deleteButton = screen.getByLabelText("Delete Task (Shift + Click to skip confirmation)")
			expect(deleteButton).toBeInTheDocument()
		})

		it("does not render delete button when item has no size", () => {
			const itemWithoutSize = { ...mockItem, size: 0 }
			render(<TaskActions item={itemWithoutSize} buttonsDisabled={false} />)

			const deleteButton = screen.queryByLabelText("Delete Task (Shift + Click to skip confirmation)")
			expect(deleteButton).not.toBeInTheDocument()
		})
	})

	describe("Button States", () => {
		it("keeps export and copy buttons enabled but disables delete button when buttonsDisabled is true", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={true} />)

			// Find buttons by their labels
			const exportButton = screen.getByLabelText("Export task history")
			const copyButton = screen.getByLabelText("Copy prompt")
			const deleteButton = screen.getByLabelText("Delete Task (Shift + Click to skip confirmation)")

			// Export and copy buttons should be enabled regardless of buttonsDisabled
			expect(exportButton).not.toBeDisabled()
			expect(copyButton).not.toBeDisabled()
			// Delete button should respect buttonsDisabled
			expect(deleteButton).toBeDisabled()
		})

		it("export and copy buttons are always enabled while delete button respects buttonsDisabled state", () => {
			// Test with buttonsDisabled = false
			const { rerender } = render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			let exportButton = screen.getByLabelText("Export task history")
			let copyButton = screen.getByLabelText("Copy prompt")
			let deleteButton = screen.getByLabelText("Delete Task (Shift + Click to skip confirmation)")

			expect(exportButton).not.toBeDisabled()
			expect(copyButton).not.toBeDisabled()
			expect(deleteButton).not.toBeDisabled()

			// Test with buttonsDisabled = true
			rerender(<TaskActions item={mockItem} buttonsDisabled={true} />)

			exportButton = screen.getByLabelText("Export task history")
			copyButton = screen.getByLabelText("Copy prompt")
			deleteButton = screen.getByLabelText("Delete Task (Shift + Click to skip confirmation)")

			// Export and copy remain enabled
			expect(exportButton).not.toBeDisabled()
			expect(copyButton).not.toBeDisabled()
			// Delete button is disabled
			expect(deleteButton).toBeDisabled()
		})
	})
})
