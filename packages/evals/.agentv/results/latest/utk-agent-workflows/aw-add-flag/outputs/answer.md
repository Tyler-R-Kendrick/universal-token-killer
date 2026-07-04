{
  "arm": "utk",
  "visible": "utk://workflow.swe.feature · schema workflow-swe-feature.v1 · 159→159 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "Task: add a --json output flag to the export command.\nRepo map (relevant excerpt):\nsrc/cli/parser.py    — defines the argument parser (add new flags here)\nsrc/cli/commands/export.py — the export command implementation\nsrc/cli/commands/import.py — unrelated import command\ndocs/cli.md          — user-facing CLI docs\nRelevant code in src/cli/parser.py:\n    parser.add_argument(\"--verbose\", action=\"store_true\")\n    parser.add_argument(\"--output\", default=\"text\")   # add --json alongside this\ntests/test_parser.py covers flag parsing\nUnrelated: the CI config lives in .github/workflows/ci.yml\nUnrelated: the changelog is in CHANGELOG.md",
  "visible_tokens": 30,
  "recovery_tokens": 39,
  "raw_tokens": 159,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
