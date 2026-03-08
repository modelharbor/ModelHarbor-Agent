import { Box, Text } from "ink"

import * as theme from "../../theme.js"
import { Icon } from "../Icon.js"

import type { ToolRendererProps } from "./types.js"
import { truncateText, sanitizeContent, getToolDisplayName, getToolIconName } from "./utils.js"

const MAX_OUTPUT_LINES = 12

export function BrowserTool({ toolData }: ToolRendererProps) {
	const iconName = getToolIconName(toolData.tool)
	const displayName = getToolDisplayName(toolData.tool)

	const action = toolData.action || ""
	const url = toolData.url || ""
	const coordinate = toolData.coordinate || ""
	const path = toolData.path || ""
	const text = toolData.text ? sanitizeContent(toolData.text) : ""
	const content = toolData.content ? sanitizeContent(toolData.content) : ""

	const { text: previewContent, truncated, hiddenLines } = truncateText(content, MAX_OUTPUT_LINES)

	return (
		<Box flexDirection="column" paddingX={1} marginBottom={1}>
			<Box>
				<Icon name={iconName} color={theme.toolHeader} />
				<Text bold color={theme.toolHeader}>
					{" "}
					{displayName}
				</Text>
				{action && (
					<Text color={theme.userHeader} bold>
						{" "}
						{action}
					</Text>
				)}
			</Box>

			<Box flexDirection="column" marginLeft={2}>
				{url && (
					<Box>
						<Text color={theme.dimText}>url: </Text>
						<Text color={theme.text}>{url}</Text>
					</Box>
				)}
				{coordinate && (
					<Box>
						<Text color={theme.dimText}>coordinate: </Text>
						<Text color={theme.text}>{coordinate}</Text>
					</Box>
				)}
				{text && (
					<Box>
						<Text color={theme.dimText}>text: </Text>
						<Text color={theme.text}>{text}</Text>
					</Box>
				)}
				{path && (
					<Box>
						<Text color={theme.dimText}>path: </Text>
						<Text color={theme.text}>{path}</Text>
					</Box>
				)}
			</Box>

			{previewContent && (
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					<Box borderStyle="single" borderColor={theme.borderColor} paddingX={1}>
						<Text color={theme.toolText}>{previewContent}</Text>
					</Box>
					{truncated && (
						<Text color={theme.dimText} dimColor>
							... ({hiddenLines} more lines)
						</Text>
					)}
				</Box>
			)}
		</Box>
	)
}
