# Adding a New Provider with a Fixed Model List

This guide explains how to add a new provider to the ModelHarbor VS Code extension, where the provider uses a fixed (predefined) list of models.

---

## 1. Define Provider and Model List

- **Types and Constants**:  
  In `packages/types/src/providers/yourprovider.ts`, define your provider’s model list as a constant object.  
  Example:

    ```ts
    export const yourProviderModels = {
    	"yourprovider/model-1": {
    		/* ModelInfo */
    	},
    	"yourprovider/model-2": {
    		/* ModelInfo */
    	},
    } as const
    export type YourProviderModelId = keyof typeof yourProviderModels
    export const yourProviderDefaultModelId: YourProviderModelId = "yourprovider/model-1"
    ```

- **Export Model List**:  
  Export the model list and default model ID so they can be imported elsewhere.

---

## 2. Add Provider to UI Constants

- **Provider List**:  
  In `webview-ui/src/components/settings/constants.ts`, add your provider to the `PROVIDERS` array:

    ```ts
    { value: "yourprovider", label: "YourProvider" }
    ```

- **Model Mapping**:  
  Add your model list to `MODELS_BY_PROVIDER`:
    ```ts
    yourprovider: yourProviderModels,
    ```

---

## 3. Add Provider-Specific UI (Optional)

- If your provider needs custom configuration UI, create a React component in `webview-ui/src/components/settings/providers/YourProvider.tsx`.
- Otherwise, the generic model selection UI will be used.

---

## 4. Wire Up Provider Logic

- **API Handler**:  
  Implement a handler for your provider in `src/api/providers/yourprovider.ts`.  
  Use the fixed model list and default model ID:

    ```ts
    import { yourProviderModels, yourProviderDefaultModelId } from "@roo-code/types"
    // ... use these in your handler logic
    ```

- **Provider Registration**:  
  Ensure your provider is recognized in the provider settings manager and configuration logic (see `src/core/config/ProviderSettingsManager.ts`).

---

## 5. Update Provider Selection Logic

- In `webview-ui/src/components/settings/ApiOptions.tsx`, ensure your provider is handled in the provider/model selection logic.
- If your provider uses a custom model ID field, add it to the `PROVIDER_MODEL_CONFIG` mapping.

---

## 6. Test Your Provider

- Add tests for your provider’s configuration and model selection in the appropriate test files (e.g., `webview-ui/src/components/settings/__tests__/ApiOptions.spec.tsx`).

---

## 7. Example: Adding "YourProvider"

Suppose you want to add a provider called "YourProvider" with two fixed models:

1. Define models in `packages/types/src/providers/yourprovider.ts`.
2. Add to `PROVIDERS` and `MODELS_BY_PROVIDER` in `webview-ui/src/components/settings/constants.ts`.
3. Implement handler in `src/api/providers/yourprovider.ts`.
4. Update UI logic in `webview-ui/src/components/settings/ApiOptions.tsx`.
5. Add tests.

---

## Notes

- **Fixed Model List**:  
  The model list is hardcoded and does not change at runtime.
- **No API Fetch Needed**:  
  Since the list is fixed, you do not need to fetch models from an external API.
- **Integration**:  
  The provider will appear in the settings UI and allow users to select from the fixed list of models.
