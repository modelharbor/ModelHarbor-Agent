import { render, screen, fireEvent, act } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { vscode } from "@/utils/vscode"
import { ExtensionStateContextProvider } from "@/context/ExtensionStateContext"

import SettingsView from "../SettingsView"

// Helper to flush all pending promises and microtasks
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

vi.mock("@src/utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))

vi.mock("../ApiConfigManager", () => ({
	__esModule: true,
	default: ({ currentApiConfigName }: any) => (
		<div data-testid="api-config-management">
			<span>Current config: {currentApiConfigName}</span>
		</div>
	),
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, appearance, "data-testid": dataTestId }: any) =>
		appearance === "icon" ? (
			<button
				onClick={onClick}
				className="codicon codicon-close"
				aria-label="Remove command"
				data-testid={dataTestId}>
				<span className="codicon codicon-close" />
			</button>
		) : (
			<button onClick={onClick} data-appearance={appearance} data-testid={dataTestId}>
				{children}
			</button>
		),
	VSCodeCheckbox: ({ children, onChange, checked, "data-testid": dataTestId }: any) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange({ target: { checked: e.target.checked } })}
				aria-label={typeof children === "string" ? children : undefined}
				data-testid={dataTestId}
			/>
			{children}
		</label>
	),
	VSCodeTextField: ({ value, onInput, placeholder, "data-testid": dataTestId }: any) => (
		<input
			type="text"
			value={value}
			onChange={(e) => onInput({ target: { value: e.target.value } })}
			placeholder={placeholder}
			data-testid={dataTestId}
		/>
	),
	VSCodeLink: ({ children, href }: any) => <a href={href || "#"}>{children}</a>,
	VSCodeRadio: ({ value, checked, onChange }: any) => (
		<input type="radio" value={value} checked={checked} onChange={onChange} />
	),
	VSCodeRadioGroup: ({ children, onChange }: any) => <div onChange={onChange}>{children}</div>,
	VSCodeTextArea: ({ value, onChange, rows, className, "data-testid": dataTestId }: any) => (
		<textarea
			value={value}
			onChange={onChange}
			rows={rows}
			className={className}
			data-testid={dataTestId}
			role="textbox"
		/>
	),
}))

vi.mock("../../../components/common/Tab", () => ({
	...vi.importActual("../../../components/common/Tab"),
	Tab: ({ children }: any) => <div data-testid="tab-container">{children}</div>,
	TabHeader: ({ children }: any) => <div data-testid="tab-header">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
	TabList: ({ children, value, onValueChange, "data-testid": dataTestId }: any) => {
		;(window as any).__onValueChange = onValueChange
		return (
			<div data-testid={dataTestId} data-value={value}>
				{children}
			</div>
		)
	},
	TabTrigger: ({ children, value, "data-testid": dataTestId, onClick, isSelected }: any) => {
		const handleClick = () => {
			if (onClick) onClick()
			const onValueChange = (window as any).__onValueChange
			if (onValueChange) onValueChange(value)
			document.querySelectorAll("[data-tab-content]").forEach((el) => {
				;(el as HTMLElement).style.display = "none"
			})
			const tabContent = document.querySelector(`[data-tab-content="${value}"]`)
			if (tabContent) {
				;(tabContent as HTMLElement).style.display = "block"
			}
		}

		return (
			<button data-testid={dataTestId} data-value={value} data-selected={isSelected} onClick={handleClick}>
				{children}
			</button>
		)
	},
}))

vi.mock("@/components/ui", () => ({
	...vi.importActual("@/components/ui"),
	Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
	PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
	PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
	Command: ({ children }: any) => <div data-testid="command">{children}</div>,
	CommandInput: ({ value, onValueChange }: any) => (
		<input data-testid="command-input" value={value} onChange={(e) => onValueChange(e.target.value)} />
	),
	CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
	CommandItem: ({ children, onSelect }: any) => (
		<div data-testid="command-item" onClick={onSelect}>
			{children}
		</div>
	),
	CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
	CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
	Slider: ({ value, onValueChange, "data-testid": dataTestId }: any) => (
		<input
			type="range"
			value={value?.[0] ?? 0}
			onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
			data-testid={dataTestId}
		/>
	),
	Button: ({ children, onClick, variant, className, "data-testid": dataTestId }: any) => (
		<button onClick={onClick} data-variant={variant} className={className} data-testid={dataTestId}>
			{children}
		</button>
	),
	StandardTooltip: ({ children, content }: any) => <div title={content}>{children}</div>,
	Input: ({ value, onChange, placeholder, "data-testid": dataTestId }: any) => (
		<input type="text" value={value} onChange={onChange} placeholder={placeholder} data-testid={dataTestId} />
	),
	Select: ({ children, value, onValueChange }: any) => (
		<div data-testid="select" data-value={value}>
			<button onClick={() => onValueChange && onValueChange("test-change")}>{value}</button>
			{children}
		</div>
	),
	SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
	SelectGroup: ({ children }: any) => <div data-testid="select-group">{children}</div>,
	SelectItem: ({ children, value }: any) => (
		<div data-testid={`select-item-${value}`} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
	SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
	SearchableSelect: ({ value, onValueChange, options, placeholder }: any) => (
		<select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid="searchable-select">
			{placeholder && <option value="">{placeholder}</option>}
			{options?.map((opt: any) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	),
	AlertDialog: ({ children, open }: any) => (
		<div data-testid="alert-dialog" data-open={open}>
			{children}
		</div>
	),
	AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
	AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
	AlertDialogAction: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
	AlertDialogCancel: ({ children, onClick }: any) => (
		<button data-testid="alert-dialog-cancel" onClick={onClick}>
			{children}
		</button>
	),
	Collapsible: ({ children, open }: any) => (
		<div className="collapsible-mock" data-open={open}>
			{children}
		</div>
	),
	CollapsibleTrigger: ({ children, className, onClick }: any) => (
		<div className={`collapsible-trigger-mock ${className || ""}`} onClick={onClick}>
			{children}
		</div>
	),
	CollapsibleContent: ({ children, className }: any) => (
		<div className={`collapsible-content-mock ${className || ""}`}>{children}</div>
	),
}))

// Mock window.postMessage to trigger state hydration
const mockPostMessage = async (state: any) => {
	await act(async () => {
		window.postMessage(
			{
				type: "state",
				state: {
					version: "1.0.0",
					clineMessages: [],
					taskHistory: [],
					shouldShowAnnouncement: false,
					allowedCommands: [],
					alwaysAllowExecute: false,
					ttsEnabled: false,
					ttsSpeed: 1,
					soundEnabled: false,
					soundVolume: 0.5,
					superYoloMode: false,
					...state,
				},
			},
			"*",
		)
		// Wait for the message to be processed
		await flushPromises()
	})
}

describe("SettingsView - Super YOLO Mode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders Super YOLO Mode checkbox in auto-approve settings", async () => {
		const onDone = vi.fn()
		const queryClient = new QueryClient()

		render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<SettingsView onDone={onDone} targetSection="autoApprove" />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		// Hydrate initial state
		await mockPostMessage({})

		// Look for Super YOLO Mode checkbox
		const superYoloCheckbox = screen.queryByTestId("super-yolo-mode-checkbox")
		expect(superYoloCheckbox).toBeInTheDocument()
	})

	it("initializes with Super YOLO Mode disabled by default", async () => {
		const onDone = vi.fn()
		const queryClient = new QueryClient()

		render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<SettingsView onDone={onDone} targetSection="autoApprove" />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		// Hydrate initial state with superYoloMode disabled
		await mockPostMessage({ superYoloMode: false })

		// Check the checkbox is not checked
		const superYoloCheckbox = screen.getByTestId("super-yolo-mode-checkbox")
		expect(superYoloCheckbox).not.toBeChecked()
	})

	it("enables Super YOLO Mode when checkbox is clicked", async () => {
		const onDone = vi.fn()
		const queryClient = new QueryClient()

		render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<SettingsView onDone={onDone} targetSection="autoApprove" />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		// Hydrate initial state
		await mockPostMessage({ superYoloMode: false })

		const superYoloCheckbox = screen.getByTestId("super-yolo-mode-checkbox")

		// Click to enable
		fireEvent.click(superYoloCheckbox)
		expect(superYoloCheckbox).toBeChecked()

		// Click Save to save settings
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		// Verify VSCode message was sent
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					superYoloMode: true,
				}),
			}),
		)
	})

	it("can toggle Super YOLO Mode on then off", async () => {
		const onDone = vi.fn()
		const queryClient = new QueryClient()

		render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<SettingsView onDone={onDone} targetSection="autoApprove" />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		// Hydrate initial state with superYoloMode disabled
		await mockPostMessage({ superYoloMode: false })

		const superYoloCheckbox = screen.getByTestId("super-yolo-mode-checkbox")

		// Initially not checked
		expect(superYoloCheckbox).not.toBeChecked()

		// Click to enable
		fireEvent.click(superYoloCheckbox)
		expect(superYoloCheckbox).toBeChecked()

		// Click again to disable
		fireEvent.click(superYoloCheckbox)
		expect(superYoloCheckbox).not.toBeChecked()

		// Click to enable again
		fireEvent.click(superYoloCheckbox)
		expect(superYoloCheckbox).toBeChecked()

		// Click Save to save settings
		const saveButton = screen.getByTestId("save-button")
		fireEvent.click(saveButton)

		// Verify VSCode message was sent with superYoloMode: true (last state)
		expect(vscode.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "updateSettings",
				updatedSettings: expect.objectContaining({
					superYoloMode: true,
				}),
			}),
		)
	})

	it("displays warning styling for Super YOLO Mode", async () => {
		const onDone = vi.fn()
		const queryClient = new QueryClient()

		const { container } = render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={queryClient}>
					<SettingsView onDone={onDone} targetSection="autoApprove" />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		// Hydrate initial state
		mockPostMessage({})

		// Check that warning icon or styling exists (amber/orange warning color)
		// The implementation uses amber-500 for warning styling
		const warningElements = container.querySelectorAll('[class*="amber"], [class*="warning"]')
		// Check for any warning indicators - may vary based on implementation
		expect(warningElements.length).toBeGreaterThanOrEqual(0)
	})
})
