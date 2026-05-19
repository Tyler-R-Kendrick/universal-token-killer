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
```

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
