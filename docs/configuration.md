# Configuration

UTK uses project-local TOML configuration at `.utk/config.toml`. Missing config is created automatically on first mediation.

## Default Config

```toml
[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.compressed-json]
enabled = true

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"

[detok]
enabled = true

[detok.copilot_pre_tool_use]
enabled = true
rate = 0.33
min_chars = 8000
deny_tools = ["bash", "powershell", "create", "edit", "view", "grep", "glob"]
rewrite_fields = ["prompt", "instructions", "description", "question", "message", "summary", "notes", "body"]
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]
```

Current note: `.utk/config.toml` itself and core mediation artifacts are project-local under `.utk/`. `persistence.storage_root` is also used by auxiliary template helpers; keep it at `.utk` unless you are deliberately testing alternate storage behavior.

## Serializer Overrides

Set a global provider:

```toml
[serialization]
default = "compressed-json"
```

Override individual tools by exact id or trailing wildcard:

```toml
[[serialization.overrides]]
tool = "shell.git.diff"
provider = "compressed-json"

[[serialization.overrides]]
tool = "shell.gh.*"
provider = "toon"
```

Supported providers are `toon` and `compressed-json`. Unsupported or disabled providers fail with explicit configuration errors.

## Detok Hook Policy

Disable all LLMLingua-2 rewriting:

```toml
[detok]
enabled = false
```

Disable only the automatic Copilot `preToolUse` hook path:

```toml
[detok]
enabled = true

[detok.copilot_pre_tool_use]
enabled = false
```

Allow one normally denied tool when a specific prose field is safe to rewrite:

```toml
[[detok.copilot_pre_tool_use.overrides]]
tool = "workspace.ask"
enabled = true
rewrite_fields = ["prompt", "instructions"]
protected_fields = ["path", "file", "content", "patch", "diff", "id"]
```

The hook only returns `modifiedArgs` when compression actually changes an allowlisted field. Errors, unavailable LLMLingua, short text, denied tools, and protected fields fail open.

## Defaults And Precedence

Configuration is resolved in this order:

1. exact tool override;
2. trailing wildcard override;
3. global `serialization.default`;
4. built-in default `toon`.

An override only applies if the selected provider is enabled.

## Common Profiles

Prefer TOON globally, but use JSON for diffs:

```toml
[serialization]
default = "toon"

[[serialization.overrides]]
tool = "shell.git.diff"
provider = "compressed-json"
```

Prefer JSON for all GitHub CLI output:

```toml
[serialization]
default = "toon"

[[serialization.overrides]]
tool = "shell.gh.*"
provider = "compressed-json"
```
