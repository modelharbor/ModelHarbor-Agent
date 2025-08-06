import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { ExtensionMessage } from "@roo/ExtensionMessage"
import type { RouterModels } from "@roo/api"

/**
 * Listens for all "routerModels" messages from the extension host and updates the React Query cache.
 * Ensures that UI components using useRouterModels() always get the latest models.
 */
export function useRouterModelsListener() {
	const queryClient = useQueryClient()

	useEffect(() => {
		function handler(event: MessageEvent) {
			const message = event.data as ExtensionMessage
			if (message.type === "routerModels" && message.routerModels) {
				queryClient.setQueryData(["routerModels"], message.routerModels as RouterModels)
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [queryClient])
}
