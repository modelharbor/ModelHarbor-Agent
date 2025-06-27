import { render, screen, fireEvent } from "@/utils/test-utils"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { TaskActions } from "../TaskActions"
import type { HistoryItem } from "@roo-code/types"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"

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

// Mock the useExtensionState hook
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

const mockPostMessage = vi.mocked(vscode.postMessage)
const mockUseExtensionState = vi.mocked(useExtensionState)

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:task.share": "Share task",
				"chat:task.export": "Export task history",
				"chat:task.delete": "Delete Task (Shift + Click to skip confirmation)",
				"chat:task.shareWithOrganization": "Share with Organization",
				"chat:task.shareWithOrganizationDescription": "Only members of your organization can access",
				"chat:task.sharePublicly": "Share Publicly",
				"chat:task.sharePubliclyDescription": "Anyone with the link can access",
				"chat:task.connectToCloud": "Connect to Cloud",
				"chat:task.connectToCloudDescription": "Sign in to Roo Code Cloud to share tasks",
				"chat:task.sharingDisabledByOrganization": "Sharing disabled by organization",
				"account:cloudBenefitsTitle": "Connect to Roo Code Cloud",
				"account:cloudBenefitsSubtitle": "Sign in to Roo Code Cloud to share tasks",
				"account:cloudBenefitHistory": "Access your task history from anywhere",
				"account:cloudBenefitSharing": "Share tasks with your team",
				"account:cloudBenefitMetrics": "Track usage and costs",
				"account:connect": "Connect",
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
		mockUseExtensionState.mockReturnValue({
			sharingEnabled: true,
			cloudIsAuthenticated: true,
			cloudUserInfo: {
				organizationName: "Test Organization",
			},
		} as any)
	})

	describe("Open Chat Folder Button Visibility", () => {
		it("renders open chat folder button when item has id", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			// Find button by its icon class (changed from codicon-link to codicon-folder-opened)
			const buttons = screen.getAllByRole("button")
			const openFolderButton = buttons.find((btn) => btn.querySelector(".codicon-folder-opened"))
			expect(openFolderButton).toBeInTheDocument()
		})

		it("does not render open chat folder button when item has no id", () => {
			render(<TaskActions item={undefined} buttonsDisabled={false} />)

			// Find button by its icon class
			const buttons = screen.queryAllByRole("button")
			const openFolderButton = buttons.find((btn) => btn.querySelector(".codicon-folder-opened"))
			expect(openFolderButton).not.toBeDefined()
		})

		it("renders open chat folder button regardless of authentication state", () => {
			mockUseExtensionState.mockReturnValue({
				sharingEnabled: false,
				cloudIsAuthenticated: false,
			} as any)

			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			// Find button by its icon class
			const buttons = screen.getAllByRole("button")
			const openFolderButton = buttons.find((btn) => btn.querySelector(".codicon-folder-opened"))
			expect(openFolderButton).toBeInTheDocument()
		})
	})

	describe("Open Chat Folder Flow", () => {
		it("sends openChatFolder message when open chat folder button is clicked", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			// Find button by its icon class
			const buttons = screen.getAllByRole("button")
			const openFolderButton = buttons.find((btn) => btn.querySelector(".codicon-folder-opened"))
			expect(openFolderButton).toBeDefined()
			fireEvent.click(openFolderButton!)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "openChatFolder",
			})
		})
	})

	describe("Other Actions", () => {
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

		it("renders delete button and file size when item has size", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={false} />)

			const deleteButton = screen.getByLabelText("Delete Task (Shift + Click to skip confirmation)")
			expect(deleteButton).toBeInTheDocument()
			expect(screen.getByText("1024 B")).toBeInTheDocument()
		})

		it("does not render delete button when item has no size", () => {
			const itemWithoutSize = { ...mockItem, size: 0 }
			render(<TaskActions item={itemWithoutSize} buttonsDisabled={false} />)

			const deleteButton = screen.queryByLabelText("Delete Task (Shift + Click to skip confirmation)")
			expect(deleteButton).not.toBeInTheDocument()
		})
	})

	describe("Button States", () => {
		it("disables buttons when buttonsDisabled is true", () => {
			render(<TaskActions item={mockItem} buttonsDisabled={true} />)

			// Find button by its icon class
			const buttons = screen.getAllByRole("button")
			const openFolderButton = buttons.find((btn) => btn.querySelector(".codicon-folder-opened"))
			const exportButton = screen.getByLabelText("Export task history")

			expect(openFolderButton).toBeDisabled()
			expect(exportButton).toBeDisabled()
		})
	})
})
