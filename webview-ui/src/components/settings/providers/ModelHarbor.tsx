import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeTextField, VSCodeLink, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"
import { modelHarborDefaultModelId } from "@roo-code/types"

import { ExtensionMessage } from "@roo/ExtensionMessage"
import { RouterName } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

export interface ModelHarborProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
}

export const ModelHarbor = ({ apiConfiguration, setApiConfigurationField }: ModelHarborProps) => {
	const { t } = useAppTranslation()
	const { routerModels } = useExtensionState()
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const [refreshError, setRefreshError] = useState<string | undefined>()
	const modelharborErrorJustReceived = useRef(false)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "singleRouterModelFetchResponse" && !message.success) {
				const providerName = message.values?.provider as RouterName
				if (providerName === "modelharbor") {
					modelharborErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			} else if (message.type === "routerModels") {
				// If we were loading and no specific error for modelharbor was just received, mark as success.
				// The ModelPicker will show available models or "no models found".
				if (refreshStatus === "loading") {
					if (!modelharborErrorJustReceived.current) {
						setRefreshStatus("success")
					}
					// If modelharborErrorJustReceived.current is true, status is already (or will be) "error".
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [refreshStatus, refreshError, setRefreshStatus, setRefreshError])

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const handleRefreshModels = useCallback(() => {
		modelharborErrorJustReceived.current = false // Reset flag on new refresh action
		setRefreshStatus("loading")
		setRefreshError(undefined)

		const key = apiConfiguration.modelharborApiKey

		if (!key) {
			setRefreshStatus("error")
			setRefreshError(t("settings:providers.refreshModels.missingConfig"))
			return
		}

		vscode.postMessage({ type: "requestRouterModels", values: { modelharborApiKey: key } })
	}, [apiConfiguration, setRefreshStatus, setRefreshError, t])

	return (
		<>
			<VSCodeTextField
				type="password"
				value={apiConfiguration?.modelharborApiKey || ""}
				onInput={handleInputChange("modelharborApiKey")}
				placeholder={t("settings:providers.modelharborApiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.modelharborApiKey")}</label>
			</VSCodeTextField>

			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<VSCodeLink href="https://www.modelharbor.com">{t("settings:providers.getModelHarborApiKey")}</VSCodeLink>

			<VSCodeLink href="https://www.facebook.com/modelharbor/">
				{t("settings:providers.modelHarborFacebook")}
			</VSCodeLink>

			<Button
				variant="outline"
				onClick={handleRefreshModels}
				disabled={refreshStatus === "loading" || !apiConfiguration.modelharborApiKey}
				className="w-full">
				<div className="flex items-center gap-2">
					{refreshStatus === "loading" ? (
						<span className="codicon codicon-loading codicon-modifier-spin" />
					) : (
						<span className="codicon codicon-refresh" />
					)}
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			{refreshStatus === "loading" && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.refreshModels.loading")}
				</div>
			)}
			{refreshStatus === "success" && (
				<div className="text-sm text-vscode-foreground">{t("settings:providers.refreshModels.success")}</div>
			)}
			{refreshStatus === "error" && (
				<div className="text-sm text-vscode-errorForeground">
					{refreshError || t("settings:providers.refreshModels.error")}
				</div>
			)}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={modelHarborDefaultModelId}
				models={routerModels?.modelharbor ?? {}}
				modelIdKey="modelharborModelId"
				serviceName="ModelHarbor"
				serviceUrl="https://www.modelharbor.com"
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={{ allowAll: true, providers: {} }}
			/>

			{/* Show prompt caching option if the selected model supports it */}
			{(() => {
				const selectedModelId = apiConfiguration.modelharborModelId || modelHarborDefaultModelId
				const selectedModel = routerModels?.modelharbor?.[selectedModelId]
				if (selectedModel?.supportsPromptCache) {
					return (
						<div className="mt-4">
							<VSCodeCheckbox
								checked={apiConfiguration.modelharborUsePromptCache || false}
								onChange={(e: any) => {
									setApiConfigurationField("modelharborUsePromptCache", e.target.checked)
								}}>
								<span className="font-medium">{t("settings:providers.enablePromptCaching")}</span>
							</VSCodeCheckbox>
							<div className="text-sm text-vscode-descriptionForeground ml-6 mt-1">
								{t("settings:providers.enablePromptCachingTitle")}
							</div>
						</div>
					)
				}
				return null
			})()}
		</>
	)
}

ModelHarbor.displayName = "ModelHarbor"
