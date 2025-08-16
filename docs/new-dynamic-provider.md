# Adding a New Provider with Dynamic Model Fetching via REST API

This guide explains how to add a new provider to the ModelHarbor VS Code extension that fetches its model list and model settings dynamically from a REST API.

---

## 1. Define Provider Type and API Endpoints

- **Type Definition**:  
  In `packages/types/src/providers/yourprovider.ts`, define the provider type and expected model info structure.

- **API Endpoints**:  
  Determine the REST API endpoints for:
    - Fetching available models (e.g., `GET /v1/models`)
    - Fetching model settings/details (e.g., `GET /v1/models/:modelId`)

---

## 2. Implement Model Fetch Logic

- **Model Fetch Function**:  
  Create an async function to fetch models from the REST API.  
  Example:

    ```ts
    export async function fetchYourProviderModels(
    	apiBaseUrl: string,
    	apiKey?: string,
    ): Promise<Record<string, ModelInfo>> {
    	const response = await fetch(`${apiBaseUrl}/v1/models`, {
    		headers: { Authorization: `Bearer ${apiKey}` },
    	})
    	const data = await response.json()
    	// Transform data to Record<string, ModelInfo>
    	return transformModels(data)
    }
    ```

- **Model Settings Fetch**:  
  For each model, fetch detailed settings if needed:
    ```ts
    export async function fetchModelSettings(apiBaseUrl: string, modelId: string, apiKey?: string): Promise<ModelInfo> {
    	const response = await fetch(`${apiBaseUrl}/v1/models/${modelId}`, {
    		headers: { Authorization: `Bearer ${apiKey}` },
    	})
    	return await response.json()
    }
    ```

---

## 3. Integrate with Provider Handler

- **API Handler**:  
  In `src/api/providers/yourprovider.ts`, implement a handler that uses the fetch functions above.

    - On initialization, fetch the model list and cache it.
    - Provide a method to refresh models.
    - When creating a message/task, use the latest model info.

    Example:

    ```ts
    import { fetchYourProviderModels } from "@roo-code/types"
    export class YourProviderHandler {
    	private modelsCache: Record<string, ModelInfo> = {}
    	async initializeModels(apiBaseUrl: string, apiKey?: string) {
    		this.modelsCache = await fetchYourProviderModels(apiBaseUrl, apiKey)
    	}
    	getModel(modelId: string) {
    		return this.modelsCache[modelId]
    	}
    	// ...other handler logic
    }
    ```

---

## 4. UI Integration

- **Provider List**:  
  Add your provider to the `PROVIDERS` array in `webview-ui/src/components/settings/constants.ts`.

- **Dynamic Model Selection**:  
  In `webview-ui/src/components/settings/ApiOptions.tsx`, update logic to:

    - Fetch and display models dynamically when the provider is selected.
    - Show loading states and handle errors.
    - Allow refreshing the model list.

    Example:

    ```tsx
    useEffect(() => {
    	if (selectedProvider === "yourprovider") {
    		fetchYourProviderModels(apiBaseUrl, apiKey).then(setModels).catch(setError)
    	}
    }, [selectedProvider, apiBaseUrl, apiKey])
    ```

---

## 5. Persist Model Settings

- **ProviderSettingsManager**:  
  When a user selects a model, save the model ID and its settings in the provider configuration (see `src/core/config/ProviderSettingsManager.ts`).

---

## 6. Testing

- Add tests for:
    - Model fetching logic (mock API responses).
    - UI model selection and error handling.
    - Provider configuration persistence.

---

## 7. Example Workflow

Suppose you want to add a provider called "YourProvider" that fetches models from `https://api.yourprovider.com/v1/models`:

1. Implement fetch logic in `packages/types/src/providers/yourprovider.ts`.
2. Add provider to UI constants.
3. Update UI logic to fetch and display models.
4. Implement handler in `src/api/providers/yourprovider.ts`.
5. Ensure settings are persisted.
6. Add tests.

---

## Notes

- **Dynamic Model List**:  
  The model list is fetched from the API and may change at runtime.
- **Error Handling**:  
  Handle network errors, invalid responses, and empty model lists gracefully.
- **Caching**:  
  Cache models for performance, but allow manual refresh.
- **Security**:  
  Securely handle API keys and sensitive data.
