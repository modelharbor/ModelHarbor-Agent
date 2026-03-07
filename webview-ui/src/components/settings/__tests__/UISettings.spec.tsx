import { render, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { UISettings } from "../UISettings"

describe("UISettings", () => {
	const defaultProps = {
		reasoningBlockCollapsed: false,
		enterBehavior: "send" as const,
		webviewFontSize: 13,
		setCachedStateField: vi.fn(),
	}

	it("renders the collapse thinking checkbox", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} />)
		const checkbox = getByTestId("collapse-thinking-checkbox")
		expect(checkbox).toBeTruthy()
	})

	it("displays the correct initial state", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} reasoningBlockCollapsed={true} />)
		const checkbox = getByTestId("collapse-thinking-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(true)
	})

	it("calls setCachedStateField when checkbox is toggled", async () => {
		const setCachedStateField = vi.fn()
		const { getByTestId } = render(<UISettings {...defaultProps} setCachedStateField={setCachedStateField} />)

		const checkbox = getByTestId("collapse-thinking-checkbox")
		fireEvent.click(checkbox)

		await waitFor(() => {
			expect(setCachedStateField).toHaveBeenCalledWith("reasoningBlockCollapsed", true)
		})
	})

	it("updates checkbox state when prop changes", () => {
		const { getByTestId, rerender } = render(<UISettings {...defaultProps} reasoningBlockCollapsed={false} />)
		const checkbox = getByTestId("collapse-thinking-checkbox") as HTMLInputElement
		expect(checkbox.checked).toBe(false)

		rerender(<UISettings {...defaultProps} reasoningBlockCollapsed={true} />)
		expect(checkbox.checked).toBe(true)
	})

	it("shows current font size value", () => {
		const { getByTestId } = render(<UISettings {...defaultProps} webviewFontSize={18} />)
		expect(getByTestId("font-size-value").textContent).toBe("18px")
	})

	it("increases and decreases font size by 1", () => {
		const setCachedStateField = vi.fn()
		const { getByTestId } = render(
			<UISettings {...defaultProps} webviewFontSize={13} setCachedStateField={setCachedStateField} />,
		)

		fireEvent.click(getByTestId("font-size-decrease-button"))
		expect(setCachedStateField).toHaveBeenCalledWith("webviewFontSize", 12)

		fireEvent.click(getByTestId("font-size-increase-button"))
		expect(setCachedStateField).toHaveBeenCalledWith("webviewFontSize", 14)
	})

	it("enforces minimum boundary", () => {
		const setCachedStateField = vi.fn()
		const { getByTestId } = render(
			<UISettings {...defaultProps} webviewFontSize={8} setCachedStateField={setCachedStateField} />,
		)

		const decreaseButton = getByTestId("font-size-decrease-button") as HTMLButtonElement
		expect(decreaseButton.disabled).toBe(true)

		fireEvent.click(decreaseButton)
		expect(setCachedStateField).not.toHaveBeenCalled()
	})

	it("enforces maximum boundary", () => {
		const setCachedStateField = vi.fn()
		const { getByTestId } = render(
			<UISettings {...defaultProps} webviewFontSize={28} setCachedStateField={setCachedStateField} />,
		)

		const increaseButton = getByTestId("font-size-increase-button") as HTMLButtonElement
		expect(increaseButton.disabled).toBe(true)

		fireEvent.click(increaseButton)
		expect(setCachedStateField).not.toHaveBeenCalled()
	})

	it("resets to default font size", () => {
		const setCachedStateField = vi.fn()
		const { getByTestId } = render(
			<UISettings {...defaultProps} webviewFontSize={20} setCachedStateField={setCachedStateField} />,
		)

		fireEvent.click(getByTestId("font-size-reset-button"))
		expect(setCachedStateField).toHaveBeenCalledWith("webviewFontSize", 13)
	})
})
