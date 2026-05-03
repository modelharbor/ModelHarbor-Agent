import { HTMLAttributes, useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Info, Download, Upload, TriangleAlert, Trash2, RefreshCw, HardDrive, PackageIcon } from "lucide-react"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { Package } from "@roo/package"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"
import { useExtensionState } from "@/context/ExtensionStateContext"

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	debug?: boolean
	setDebug?: (debug: boolean) => void
}

const formatBytes = (bytes: number): string => {
	if (bytes === 0) return "0 B"
	const k = 1024
	const sizes = ["B", "KB", "MB", "GB", "TB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const About = ({ debug, setDebug, className, ...props }: AboutProps) => {
	const { t } = useAppTranslation()
	const { cacheInfo, extensionMetaInfo } = useExtensionState()
	const [isClearing, setIsClearing] = useState(false)

	// Auto-load cache info when the component mounts
	useEffect(() => {
		vscode.postMessage({ type: "getCacheInfo" })
	}, [])

	const handleClearCache = () => {
		setIsClearing(true)
		vscode.postMessage({ type: "clearCache" })
		// The backend will auto-refresh cache info after clearing,
		// so we just need to reset the clearing state after a delay
		setTimeout(() => setIsClearing(false), 2000)
	}

	const handleRefresh = () => {
		vscode.postMessage({ type: "getCacheInfo" })
	}

	// Disk usage percentage and color
	const diskUsedPercentage = cacheInfo ? Math.round((cacheInfo.diskUsed / cacheInfo.diskTotal) * 100) : 0
	const diskBarColor =
		diskUsedPercentage > 90
			? "bg-vscode-charts-red"
			: diskUsedPercentage > 70
				? "bg-vscode-charts-yellow"
				: "bg-vscode-charts-green"

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>{t("settings:sections.about")}</SectionHeader>

			<Section>
				<p>
					{Package.sha
						? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
						: `Version: ${Package.version}`}
				</p>
			</Section>

			{/* Extension Information */}
			{extensionMetaInfo && (
				<Section className="space-y-0">
					<SearchableSetting
						settingId="about-extension-information"
						section="about"
						label="Extension Information">
						<h3 className="flex items-center gap-2">
							<PackageIcon className="size-4 text-vscode-descriptionForeground" />
							Extension Information
						</h3>
						<div className="flex flex-col gap-2 mt-2 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-vscode-descriptionForeground">Identifier</span>
								<span className="font-mono text-xs">{extensionMetaInfo.identifier}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-vscode-descriptionForeground">Version</span>
								<span>{extensionMetaInfo.version}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-vscode-descriptionForeground">Source</span>
								<span>{extensionMetaInfo.source}</span>
							</div>
							{extensionMetaInfo.lastUpdated !== "Unknown" && (
								<div className="flex items-center justify-between">
									<span className="text-vscode-descriptionForeground">Last Updated</span>
									<span>{extensionMetaInfo.lastUpdated}</span>
								</div>
							)}
							{extensionMetaInfo.extensionSize !== "Unknown" && (
								<div className="flex items-center justify-between">
									<span className="text-vscode-descriptionForeground">Extension Size</span>
									<span>{extensionMetaInfo.extensionSize}</span>
								</div>
							)}
						</div>
					</SearchableSetting>
				</Section>
			)}

			<Section className="space-y-0">
				<h3>{t("settings:about.contactAndCommunity")}</h3>
				<div className="flex flex-col gap-3">
					<div className="flex items-start gap-2">
						<Info className="size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							<VSCodeLink href="https://www.modelharbor.com">www.modelharbor.com</VSCodeLink>
						</span>
					</div>
					{setDebug && (
						<SearchableSetting
							settingId="about-debug-mode"
							section="about"
							label={t("settings:about.debugMode.label")}
							className="mt-4 pt-4 border-t border-vscode-settings-headerBorder">
							<VSCodeCheckbox
								checked={debug ?? false}
								onChange={(e: any) => {
									const checked = e.target.checked === true
									setDebug(checked)
								}}>
								{t("settings:about.debugMode.label")}
							</VSCodeCheckbox>
							<p className="text-vscode-descriptionForeground text-sm mt-0">
								{t("settings:about.debugMode.description")}
							</p>
						</SearchableSetting>
					)}
				</div>
			</Section>

			<Section className="space-y-0">
				<SearchableSetting
					settingId="about-cache-management"
					section="about"
					label={t("settings:about.cacheManagement.title")}>
					<h3 className="flex items-center gap-2">
						<HardDrive className="size-4 text-vscode-descriptionForeground" />
						{t("settings:about.cacheManagement.title")}
					</h3>

					{!cacheInfo ? (
						<p className="text-vscode-descriptionForeground text-sm">
							{t("settings:about.cacheManagement.loading")}
						</p>
					) : (
						<div className="flex flex-col gap-3 mt-2">
							{/* Total Cache Size */}
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">
									{t("settings:about.cacheManagement.totalCacheSize")}
								</span>
								<span className="text-sm text-vscode-descriptionForeground">
									{formatBytes(cacheInfo.totalSize)}
								</span>
							</div>

							{/* Cache Breakdown */}
							<div className="flex flex-col gap-1.5 text-sm pl-2 border-l-2 border-vscode-panel-border">
								<div className="flex items-center justify-between">
									<span className="text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.tasks")}
									</span>
									<span className="text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.taskCount", {
											count: cacheInfo.tasksCount,
										})}{" "}
										· {formatBytes(cacheInfo.tasksSize)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.checkpoints")}
									</span>
									<span className="text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.checkpointCount", {
											count: cacheInfo.checkpointsCount,
										})}{" "}
										· {formatBytes(cacheInfo.checkpointsSize)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.cache")}
									</span>
									<span className="text-vscode-descriptionForeground">
										{formatBytes(cacheInfo.cacheSize)}
									</span>
								</div>
							</div>

							{/* Disk Usage */}
							<div className="flex flex-col gap-1.5 mt-1">
								<div className="flex items-center justify-between">
									<span className="text-sm text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.diskUsage")}
									</span>
									<span className="text-sm text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.diskUsed", {
											percentage: diskUsedPercentage,
										})}
									</span>
								</div>
								<div className="w-full h-2 rounded-full bg-vscode-panel-border overflow-hidden">
									<div
										className={cn("h-full rounded-full transition-all duration-300", diskBarColor)}
										style={{ width: `${Math.min(diskUsedPercentage, 100)}%` }}
									/>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-xs text-vscode-descriptionForeground">
										{formatBytes(cacheInfo.diskUsed)} / {formatBytes(cacheInfo.diskTotal)}
									</span>
									<span className="text-xs text-vscode-descriptionForeground">
										{t("settings:about.cacheManagement.diskAvailable", {
											size: formatBytes(cacheInfo.diskAvailable),
										})}
									</span>
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex items-center gap-2 mt-2">
								<Button
									variant="destructive"
									onClick={handleClearCache}
									disabled={isClearing || cacheInfo.totalSize === 0}
									className="w-28">
									<Trash2 className="p-0.5" />
									{isClearing
										? t("settings:about.cacheManagement.clearingCache")
										: t("settings:about.cacheManagement.clearCache")}
								</Button>
								<Button onClick={handleRefresh} className="w-28">
									<RefreshCw className="p-0.5" />
									{t("settings:about.cacheManagement.refresh")}
								</Button>
							</div>
						</div>
					)}
				</SearchableSetting>
			</Section>

			<Section className="space-y-0">
				<SearchableSetting
					settingId="about-manage-settings"
					section="about"
					label={t("settings:about.manageSettings")}>
					<h3>{t("settings:about.manageSettings")}</h3>
					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={() => vscode.postMessage({ type: "exportSettings" })} className="w-28">
							<Upload className="p-0.5" />
							{t("settings:footer.settings.export")}
						</Button>
						<Button onClick={() => vscode.postMessage({ type: "importSettings" })} className="w-28">
							<Download className="p-0.5" />
							{t("settings:footer.settings.import")}
						</Button>
						<Button
							variant="destructive"
							onClick={() => vscode.postMessage({ type: "resetState" })}
							className="w-28">
							<TriangleAlert className="p-0.5" />
							{t("settings:footer.settings.reset")}
						</Button>
					</div>
				</SearchableSetting>
			</Section>
		</div>
	)
}
