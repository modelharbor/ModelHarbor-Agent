import { HTMLAttributes, useMemo } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 28
const FONT_SIZE_DEFAULT = 13
const FONT_SIZE_STEP = 1

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	enterBehavior: "send" | "newline"
	webviewFontSize: number
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({
	reasoningBlockCollapsed,
	enterBehavior,
	webviewFontSize,
	setCachedStateField,
	...props
}: UISettingsProps) => {
	const { t } = useAppTranslation()

	// Detect platform for dynamic modifier key display
	const primaryMod = useMemo(() => {
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
		return isMac ? "⌘" : "Ctrl"
	}, [])

	const clampedWebviewFontSize = Math.min(
		FONT_SIZE_MAX,
		Math.max(FONT_SIZE_MIN, webviewFontSize ?? FONT_SIZE_DEFAULT),
	)

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)
	}

	const handleEnterBehaviorChange = (requireCtrlEnter: boolean) => {
		const newBehavior = requireCtrlEnter ? "newline" : "send"
		setCachedStateField("enterBehavior", newBehavior)
	}

	const setWebviewFontSize = (value: number) => {
		setCachedStateField("webviewFontSize", Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, value)))
	}

	const decreaseFontSize = () => {
		setWebviewFontSize(clampedWebviewFontSize - FONT_SIZE_STEP)
	}

	const increaseFontSize = () => {
		setWebviewFontSize(clampedWebviewFontSize + FONT_SIZE_STEP)
	}

	const resetFontSize = () => {
		setCachedStateField("webviewFontSize", FONT_SIZE_DEFAULT)
	}

	const canDecrease = clampedWebviewFontSize > FONT_SIZE_MIN
	const canIncrease = clampedWebviewFontSize < FONT_SIZE_MAX
	const canReset = clampedWebviewFontSize !== FONT_SIZE_DEFAULT

	return (
		<div {...props}>
			<SectionHeader>{t("settings:sections.ui")}</SectionHeader>

			<Section>
				<div className="space-y-6">
					{/* Collapse Thinking Messages Setting */}
					<SearchableSetting
						settingId="ui-collapse-thinking"
						section="ui"
						label={t("settings:ui.collapseThinking.label")}>
						<div className="flex flex-col gap-1">
							<VSCodeCheckbox
								checked={reasoningBlockCollapsed}
								onChange={(e: any) => handleReasoningBlockCollapsedChange(e.target.checked)}
								data-testid="collapse-thinking-checkbox">
								<span className="font-medium">{t("settings:ui.collapseThinking.label")}</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
								{t("settings:ui.collapseThinking.description")}
							</div>
						</div>
					</SearchableSetting>

					{/* Enter Key Behavior Setting */}
					<SearchableSetting
						settingId="ui-enter-behavior"
						section="ui"
						label={t("settings:ui.requireCtrlEnterToSend.label", { primaryMod })}>
						<div className="flex flex-col gap-1">
							<VSCodeCheckbox
								checked={enterBehavior === "newline"}
								onChange={(e: any) => handleEnterBehaviorChange(e.target.checked)}
								data-testid="enter-behavior-checkbox">
								<span className="font-medium">
									{t("settings:ui.requireCtrlEnterToSend.label", { primaryMod })}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
								{t("settings:ui.requireCtrlEnterToSend.description", { primaryMod })}
							</div>
						</div>
					</SearchableSetting>

					{/* Font Size Setting */}
					<SearchableSetting settingId="ui-font-size" section="ui" label={t("settings:ui.fontSize.label")}>
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={decreaseFontSize}
									disabled={!canDecrease}
									data-testid="font-size-decrease-button"
									aria-label={t("settings:ui.fontSize.decrease")}
									className="h-8 min-w-10 rounded border border-vscode-input-border bg-vscode-button-secondaryBackground px-2 text-sm font-semibold text-vscode-button-secondaryForeground enabled:hover:bg-vscode-list-hoverBackground disabled:cursor-not-allowed disabled:opacity-50">
									A-
								</button>

								<div
									data-testid="font-size-value"
									className="min-w-[56px] text-center font-medium text-vscode-foreground">
									{clampedWebviewFontSize}px
								</div>

								<button
									type="button"
									onClick={increaseFontSize}
									disabled={!canIncrease}
									data-testid="font-size-increase-button"
									aria-label={t("settings:ui.fontSize.increase")}
									className="h-8 min-w-10 rounded border border-vscode-input-border bg-vscode-button-secondaryBackground px-2 text-sm font-semibold text-vscode-button-secondaryForeground enabled:hover:bg-vscode-list-hoverBackground disabled:cursor-not-allowed disabled:opacity-50">
									A+
								</button>

								<button
									type="button"
									onClick={resetFontSize}
									disabled={!canReset}
									data-testid="font-size-reset-button"
									className="h-8 rounded border border-vscode-input-border bg-vscode-editor-background px-3 text-sm text-vscode-foreground enabled:hover:bg-vscode-list-hoverBackground disabled:cursor-not-allowed disabled:opacity-50">
									{t("settings:ui.fontSize.reset")}
								</button>
							</div>

							<div className="text-vscode-descriptionForeground text-sm">
								{t("settings:ui.fontSize.description", { defaultSize: FONT_SIZE_DEFAULT })}
							</div>
						</div>
					</SearchableSetting>
				</div>
			</Section>
		</div>
	)
}
