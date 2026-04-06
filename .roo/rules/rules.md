# Code Quality Rules

1. Test Coverage:

    - Before attempting completion, always make sure that any code changes have test coverage
    - Ensure all tests pass before submitting changes
    - The vitest framework is used for testing; the `vi`, `describe`, `test`, `it`, etc functions are defined by default in `tsconfig.json` and therefore don't need to be imported from `vitest`
    - Tests must be run from the same directory as the `package.json` file that specifies `vitest` in `devDependencies`
    - Run tests with: `npx vitest run <relative-path-from-workspace-root>`
    - Do NOT run tests from project root - this causes "vitest: command not found" error
    - Tests must be run from inside the correct workspace:
        - Backend tests: `cd src && npx vitest run path/to/test-file` (don't include `src/` in path)
        - UI tests: `cd webview-ui && npx vitest run src/path/to/test-file`
    - Example: For `src/tests/user.test.ts`, run `cd src && npx vitest run tests/user.test.ts` NOT `npx vitest run src/tests/user.test.ts`

2. Lint Rules:

    - Never disable any lint rules without explicit user approval

3. Styling Guidelines:

    - Use Tailwind CSS classes instead of inline style objects for new markup
    - VSCode CSS variables must be added to webview-ui/src/index.css before using them in Tailwind classes
    - Example: `<div className="text-md text-vscode-descriptionForeground mb-2" />` instead of style objects

## Confidence-Based Human Interaction

### Confidence Assessment Guidelines

Calculate confidence using baseline + factors + modifiers:

**Baseline Confidence: 70%** (starting point for all assessments)

**Base Confidence Factors:**

- Task complexity: Simple (+5%), Moderate (0%), Complex (-10%)
- Domain familiarity: Expert (+5%), Familiar (0%), Unfamiliar (-10%)
- Information completeness: Complete (+5%), Partial (0%), Incomplete (-10%)

**Solution Optimization Factors:**

- Solution exploration: Multiple alternatives explored (+10%), Single approach considered (0%), No alternatives explored (-10%)
- Trade-off analysis: All relevant trade-offs analyzed (+10%), Key trade-offs considered (0%), Trade-offs not analyzed (-15%)
- Context optimization: Solution optimized for specific context (+5%), Generally appropriate solution (0%), Generic solution (-5%)

**Modifiers:**

- Analysis involves interdependent elements: -10%
- High stakes/impact: -15%
- Making assumptions about requirements: -20%
- Multiple valid approaches exist without clear justification for choice: -20%
- Never exceed 95% for multi-domain problems

### ≥95% Confidence: Proceed Independently

- Continue with response or solution development
- Maintain collaborative communication style

### 70-94% Confidence: Proactively Seek Clarity

- Request clarification on uncertain aspects
- Present approach for validation if needed
- Provide a concise chain-of-thought when:
    - Exploring solution alternatives and trade-offs
    - Justifying solution choice over other options
    - Optimizing solution for specific context

### <70% Confidence: Human Collaboration Required

- Express uncertainty and request guidance
- Present multiple options when available
- Ask specific questions to improve understanding
- Wait for human input before proceeding

### Special Triggers (Regardless of Confidence)

- **Significant Impact:** "⚠️ This affects [areas]. Confirm proceed?"
- **Ethical/Risk Concerns:** "🔒 Risk identified: [issue]. Suggested mitigation: [solution]. Proceed?"
- **Multiple Valid Approaches:** Present options with recommendation

### Confidence-Based Communication

- Start response with "**Confidence: X%**" for all responses
- Use natural language flow throughout
- Avoid rigid format requirements
