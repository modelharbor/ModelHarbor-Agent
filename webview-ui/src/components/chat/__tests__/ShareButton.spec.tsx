import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { ShareButton } from "../ShareButton"
import { useTranslation } from "react-i18next"
import { vscode } from "@/utils/vscode"

// Mock the vscode utility
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock react-i18next
vi.mock("react-i18next")

// Mock telemetry client
vi.mock("@/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: vi.fn(),
	},
}))

const mockUseTranslation = vi.mocked(useTranslation)
const mockVscode = vi.mocked(vscode)

describe("ShareButton", () => {
	const mockT = vi.fn((key: string) => key)
	const mockItem = {
		id: "test-task-id",
		number: 1,
		ts: Date.now(),
		task: "Test Task",
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.01,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		mockUseTranslation.mockReturnValue({
			t: mockT,
			i18n: {} as any,
			ready: true,
		} as any)
	})

	test("renders open chat folder button", () => {
		render(<ShareButton item={mockItem} />)

		const button = screen.getByRole("button")
		expect(button).toBeInTheDocument()
		expect(button.querySelector(".codicon-folder-opened")).toBeInTheDocument()
	})

	test("sends openChatFolder message when clicked", () => {
		render(<ShareButton item={mockItem} />)

		const button = screen.getByRole("button")
		fireEvent.click(button)

		expect(mockVscode.postMessage).toHaveBeenCalledWith({
			type: "openChatFolder",
		})
	})

	test("does not render when item has no id", () => {
		render(<ShareButton item={undefined} />)

		const button = screen.queryByRole("button")
		expect(button).not.toBeInTheDocument()
	})

	test("respects disabled prop", () => {
		render(<ShareButton item={mockItem} disabled={true} />)

		const button = screen.getByRole("button")
		expect(button).toBeDisabled()
	})

	test("is enabled by default", () => {
		render(<ShareButton item={mockItem} disabled={false} />)

		const button = screen.getByRole("button")
		expect(button).not.toBeDisabled()
	})
})
