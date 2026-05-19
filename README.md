# universal-token-killer

UTK (Universal Token Killer) is a GitHub Copilot-focused mediation system that stores raw tool outputs in `.utk/`, infers reusable schemas, emits TOON artifacts, and returns compact references to chat.

## Packages

- `@utk/core`: store initialization, mediation pipeline, schema/rule/router artifacts.
- `@utk/constrained-decoder`: `llguidance.ts` validation and validate-retry fallback.
- `utk-vscode`: VS Code extension registration for `utk.*` commands.
- `@utk/evals`: AgentV eval definitions and assertions.

## Development

```bash
npm install
npm run lint
npm run test
npm run build
```
