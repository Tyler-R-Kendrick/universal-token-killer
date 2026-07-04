{
  "arm": "utk",
  "visible": "utk://workflow.swe.types · schema workflow-swe-types.v1 · 121→121 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "$ mypy src\nsrc/api/handlers.py:120: error: Argument 1 to \"save_order\" has incompatible type \"str\"; expected \"Order\"\nsrc/api/handlers.py:120: note: the id string is being passed where an Order object is required\nsrc/util/format.py:12: note: unrelated style hint about line length\nFound 1 error in 1 file (checked 87 source files)\nFix: construct an Order from the id before calling save_order at src/api/handlers.py:120\nNote: mypy cache stored in .mypy_cache\nNote: run took 4.1 seconds",
  "visible_tokens": 29,
  "recovery_tokens": 49,
  "raw_tokens": 121,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
