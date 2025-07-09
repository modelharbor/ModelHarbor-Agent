import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@roo-code/types"
import { TelemetryEventName } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { telemetryClient } from "@/utils/TelemetryClient"
import { Button, StandardTooltip } from "@/components/ui"

interface ShareButtonProps {
	item?: HistoryItem
	disabled?: boolean
}

export const ShareButton = ({ item, disabled = false }: ShareButtonProps) => {
	const { t } = useTranslation()

	const handleOpenChatFolder = () => {
		// Send telemetry for open chat folder action
		telemetryClient.capture(TelemetryEventName.SHARE_BUTTON_CLICKED)

		vscode.postMessage({
			type: "openChatFolder",
		})
	}

	// Don't render if no item ID
	if (!item?.id) {
		return null
	}

	return (
		<StandardTooltip content={t("common:open_chat_folder")}>
			<Button
				variant="ghost"
				size="icon"
				disabled={disabled}
				className="h-7 w-7 p-1.5 hover:bg-vscode-toolbar-hoverBackground"
				onClick={handleOpenChatFolder}>
				<span className="codicon codicon-folder-opened"></span>
			</Button>
		</StandardTooltip>
	)
}
