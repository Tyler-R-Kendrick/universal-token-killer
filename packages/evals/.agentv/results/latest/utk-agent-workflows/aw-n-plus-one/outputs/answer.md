{
  "arm": "utk",
  "visible": "utk://workflow.swe.perf · schema workflow-swe-perf.v1 · 120→120 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "Profiler summary for GET /dashboard (2.9s)\nSlowest span: database (2.6s across 412 queries)\nQuery pattern: SELECT * FROM comments WHERE post_id = ? repeated 400 times\nRoot cause: N+1 query in src/views/dashboard.py in build_feed(), which loops posts and loads comments per post\nFix hint: prefetch comments with a single IN query before the loop\nOther spans: template render 0.2s, serialization 0.1s\nNote: the profiler adds ~5% overhead\nNote: run captured on the staging dataset",
  "visible_tokens": 28,
  "recovery_tokens": 45,
  "raw_tokens": 120,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
