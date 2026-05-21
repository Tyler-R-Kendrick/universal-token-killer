# UTK Configuration

UTK reads project-local configuration from `.utk/config.toml`. Missing config is initialized with TOON as the default serializer.

```toml
[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.json-compact]
enabled = true

[serialization.providers.tron]
enabled = true

[plugins]
serialization_paths = [".utk/plugins/serialization"]

[[serialization.overrides]]
tool = "shell.git.diff"
provider = "json-compact"

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"
```

Built-in serializer providers are `toon`, `json-compact`, and `tron`. Workspace serializers load from `.utk/plugins/serialization/<plugin-name>` or installed `.utk/packs/<pack-name>` with `utk.pack.toml`, `grammar/<id>.lark`, and `registerUtkSerializerPlugin(registry, context)`. Exact tool ids and trailing `*` prefixes are valid override patterns. An unsupported or disabled provider is a configuration error.
