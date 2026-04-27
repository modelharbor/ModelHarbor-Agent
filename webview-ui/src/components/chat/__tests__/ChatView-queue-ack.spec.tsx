// npx vitest run src/components/chat/__tests__/ChatView-queue-ack.spec.tsx

import React from "react"
import { render, waitFor, act, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { vscode } from "@src/utils/vscode"

import ChatView, { ChatViewProps } from "../ChatView"

// Define minimal types needed for testing
interface ClineMessage {
	type: "say" | "ask"
	say?: string
	ask?: string
	ts: number
	text?: string
	partial?: boolean
}

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock use-sound hook
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => [vi.fn()]),
}))

// Mock components that use ESM dependencies
vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow() {
		return <div data-testid="browser-session" />
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: ClineMessage }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

vi.mock("react-virtuoso", () => ({
	Virtuoso: function MockVirtuoso({
		data,
		itemContent,
	}: {
		data: ClineMessage[]
		itemContent: (index: number, item: ClineMessage) => React.ReactNode
	}) {
		return (
			<div data-testid="virtuoso-item-list">
				{data.map((item, index) => (
					<div key={item.ts} data-testid={`virtuoso-item-${index}`}>
						{itemContent(index, item)}
					</div>
				))}
			</div>
		)
	},
}))

vi.mock("../../common/VersionIndicator", () => ({
	default: () => null,
}))

vi.mock("../Announcement", () => ({
	default: function MockAnnouncement({ hideAnnouncement }: { hideAnnouncement: () => void }) {
		return (
			<div data-testid="announcement-modal">
				<button onClick={hideAnnouncement}>Close</button>
			</div>
		)
	},
}))

vi.mock("../QueuedMessages", () => ({
	QueuedMessages: () => null,
}))

vi.mock("@src/components/welcome/RooTips", () => ({
	default: () => <div data-testid="roo-tips">Tips</div>,
}))

vi.mock("@src/components/welcome/RooHero", () => ({
	default: () => <div data-testid="roo-hero">Hero</div>,
}))

vi.mock("../FileChangesPanel", () => ({
	default: () => null,
}))

vi.mock("../WorktreeSelector", () => ({
	WorktreeSelector: ({ disabled }: { disabled?: boolean }) => (
		<div data-testid="worktree-selector" data-disabled={disabled} />
	),
}))

vi.mock("../TaskHeader", () => ({
	default: () => <div data-testid="task-header" />,
}))

vi.mock("../SystemPromptWarning", () => ({
	default: () => null,
}))

vi.mock("../CheckpointWarning", () => ({
	CheckpointWarning: () => null,
}))

vi.mock("../../history/HistoryPreview", () => ({
	default: () => <div data-testid="history-preview" />,
}))

vi.mock("../BrowserActionRow", () => ({
	default: () => <div data-testid="browser-action-row" />,
}))

vi.mock("../BrowserSessionStatusRow", () => ({
	default: () => <div data-testid="browser-session-status-row" />,
}))

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
	Trans: ({ i18nKey, children }: { i18nKey: string; children?: React.ReactNode }) => <>{children || i18nKey}</>,
}))

// Mock useExtensionState to avoid the React null dispatcher issue with ExtensionStateContextProvider
const mockSetMode = vi.fn()
let mockExtensionState: Record<string, any> = {
	clineMessages: [],
	currentTaskItem: undefined,
	currentTaskTodos: undefined,
	taskHistory: [],
	apiConfiguration: {},
	mode: "code",
	setMode: mockSetMode,
	alwaysAllowModeSwitch: false,
	customModes: [],
	hasSystemPromptOverride: false,
	soundEnabled: false,
	soundVolume: 0.5,
	messageQueue: [],
	isBrowserSessionActive: false,
}

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockExtensionState,
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock useSelectedModel
vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({ info: { supportsImages: true } }),
}))

// Mock useAppTranslation
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock useDebounceEffect
vi.mock("@src/utils/useDebounceEffect", () => ({
	useDebounceEffect: vi.fn(),
}))

// Mock imageUtils
vi.mock("@src/utils/imageUtils", () => ({
	appendImages: (prev: string[], newImages: string[], max: number) => [...prev, ...newImages].slice(0, max),
}))

// Mock costFormatting
vi.mock("@src/utils/costFormatting", () => ({
	getCostBreakdownIfNeeded: () => undefined,
}))

// Mock crypto.randomUUID for deterministic testing
const MOCK_REQUEST_ID = "mock-uuid-1234-5678"
const originalRandomUUID = crypto.randomUUID
beforeAll(() => {
	Object.defineProperty(globalThis.crypto, "randomUUID", {
		value: () => MOCK_REQUEST_ID,
		writable: true,
		configurable: true,
	})
})
afterAll(() => {
	Object.defineProperty(globalThis.crypto, "randomUUID", {
		value: originalRandomUUID,
		writable: true,
		configurable: true,
	})
})

// Mock ChatTextArea
const mockFocus = vi.fn()

vi.mock("../ChatTextArea", () => {
	const mockReact = require("react")

	const ChatTextAreaComponent = mockReact.forwardRef(function MockChatTextArea(
		props: any,
		ref: React.ForwardedRef<{ focus: () => void }>,
	) {
		mockReact.useImperativeHandle(ref, () => ({
			focus: mockFocus,
		}))

		return (
			<div data-testid="chat-textarea">
				<input
					type="text"
					value={props.inputValue || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
						if (props.setInputValue) {
							props.setInputValue(e.target.value)
						}
					}}
					onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault()
							props.onSend()
						}
					}}
					data-sending-disabled={String(props.sendingDisabled)}
				/>
			</div>
		)
	})

	return {
		default: ChatTextAreaComponent,
		ChatTextArea: ChatTextAreaComponent,
	}
})

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
		<button onClick={onClick}>{children}</button>
	),
	VSCodeTextField: () => <input type="text" />,
	VSCodeLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const queryClient = new QueryClient()

const renderChatView = (props: Partial<ChatViewProps> = {}) => {
	return render(
		<QueryClientProvider client={queryClient}>
			<ChatView {...defaultProps} {...props} />
		</QueryClientProvider>,
	)
}

/**
 * Helper: Set up an active task with API in progress (sendingDisabled=true),
 * type text into the input, and press Enter to queue the message.
 */
const setupQueuedMessage = async () => {
	// Set up extension state with an active task + api_req_started (no cost = still streaming)
	mockExtensionState = {
		...mockExtensionState,
		clineMessages: [
			{
				type: "say",
				say: "task",
				ts: Date.now() - 2000,
				text: "Initial task",
			},
			{
				type: "say",
				say: "api_req_started",
				ts: Date.now(),
				text: JSON.stringify({ apiProtocol: "anthropic" }), // No cost = still in progress
			},
		],
	}

	const result = renderChatView()

	// Wait for component to render
	await waitFor(() => {
		expect(result.getByTestId("chat-textarea")).toBeInTheDocument()
	})

	// Wait for state to settle
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 100))
	})

	// Clear any initial postMessage calls
	vi.mocked(vscode.postMessage).mockClear()

	// Get the input element
	const chatTextArea = result.getByTestId("chat-textarea")
	const input = chatTextArea.querySelector("input")! as HTMLInputElement

	// Verify sending is disabled
	await waitFor(() => {
		expect(input.getAttribute("data-sending-disabled")).toBe("true")
	})

	// Type text into the input
	await act(async () => {
		fireEvent.change(input, { target: { value: "my queued message" } })
	})

	// Wait for React to flush the state update
	await waitFor(() => {
		expect(input.value).toBe("my queued message")
	})

	// Press Enter to send
	await act(async () => {
		fireEvent.keyDown(input, { key: "Enter", code: "Enter" })
	})

	return { ...result, input }
}

describe("ChatView - Queue Message Acknowledgment", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset mock state to defaults
		mockExtensionState = {
			clineMessages: [],
			currentTaskItem: undefined,
			currentTaskTodos: undefined,
			taskHistory: [],
			apiConfiguration: {},
			mode: "code",
			setMode: mockSetMode,
			alwaysAllowModeSwitch: false,
			customModes: [],
			hasSystemPromptOverride: false,
			soundEnabled: false,
			soundVolume: 0.5,
			messageQueue: [],
			isBrowserSessionActive: false,
		}
	})

	it("sends queueMessage with requestId but does NOT clear input when sendingDisabled=true", async () => {
		const { input } = await setupQueuedMessage()

		// Should have sent queueMessage with requestId
		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "queueMessage",
					text: "my queued message",
					images: [],
					requestId: MOCK_REQUEST_ID,
				}),
			)
		})

		// Input should NOT be cleared (waiting for ack)
		expect(input.value).toBe("my queued message")
	})

	it("clears input after receiving queueMessageAck", async () => {
		const { input, getByTestId } = await setupQueuedMessage()

		// Verify input still has text before ack
		await waitFor(() => {
			expect(input.value).toBe("my queued message")
		})

		// Allow time for useEvent hook to register message listener
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})

		// Simulate backend sending queueMessageAck
		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "queueMessageAck",
						requestId: MOCK_REQUEST_ID,
					},
				}),
			)
			await new Promise((resolve) => setTimeout(resolve, 0))
		})

		// Input should now be cleared after receiving ack
		await waitFor(() => {
			const chatTextArea = getByTestId("chat-textarea")
			const inputAfterAck = chatTextArea.querySelector("input")! as HTMLInputElement
			expect(inputAfterAck.value).toBe("")
		})
	})

	it("does NOT clear input after receiving queueMessageError", async () => {
		const { input, getByTestId } = await setupQueuedMessage()

		// Verify input still has text before error
		await waitFor(() => {
			expect(input.value).toBe("my queued message")
		})

		// Allow time for useEvent hook to register message listener
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})

		// Simulate backend sending queueMessageError
		await act(async () => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "queueMessageError",
						requestId: MOCK_REQUEST_ID,
						error: "No active task",
					},
				}),
			)
			await new Promise((resolve) => setTimeout(resolve, 0))
		})

		// Input should still have the text (preserved for retry)
		await waitFor(() => {
			const chatTextArea = getByTestId("chat-textarea")
			const inputAfterError = chatTextArea.querySelector("input")! as HTMLInputElement
			expect(inputAfterError.value).toBe("my queued message")
		})
	})
})
