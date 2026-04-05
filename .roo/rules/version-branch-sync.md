# Version-Branch Sync Check

## When to Check

- Every time you start working on a new branch
- Every time you switch branches

## How to Check

1. Get the current branch name:

    ```
    git branch --show-current
    ```

2. If the branch matches the pattern `version{X.Y.Z}` (e.g., `version{3.45.0}`), extract `X.Y.Z` and verify it matches the `version` field in:

    - `package.json` (root)
    - `src/package.json`

3. `webview-ui/package.json` does **not** have a `version` field — skip it.

## Action on Mismatch

If any `version` field does not match the branch version:

1. Warn the user with the exact mismatch (file, expected version, actual version).
2. Offer to update the mismatched `package.json` files to `X.Y.Z`.
