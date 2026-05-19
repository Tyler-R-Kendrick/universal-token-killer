# UTK Configuration

UTK reads project-local configuration from `.utk/config.toml`. Missing config is initialized with TOON as the default serializer.

```toml
[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.compressed-json]
enabled = true

[[serialization.overrides]]
tool = "shell.git.diff"
provider = "compressed-json"

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"
```

Supported serializer providers are `toon` and `compressed-json`. Exact tool ids and trailing `*` prefixes are valid override patterns. An unsupported or disabled provider is a configuration error.
