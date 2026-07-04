{
  "benchmark": "tool-calling-efficiency",
  "arm": "utk",
  "case": "tce-vitest-run",
  "runs": [
    {
      "run": 1,
      "selection_tokens": 323,
      "invocation_tokens": 23,
      "schema_generation_tokens": 132,
      "output_tokens": 89,
      "recovery_tokens": 45,
      "total_tokens": 612,
      "cache_hit": false
    },
    {
      "run": 2,
      "selection_tokens": 323,
      "invocation_tokens": 23,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 45,
      "total_tokens": 480,
      "cache_hit": true
    },
    {
      "run": 3,
      "selection_tokens": 323,
      "invocation_tokens": 23,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 45,
      "total_tokens": 480,
      "cache_hit": true
    },
    {
      "run": 4,
      "selection_tokens": 323,
      "invocation_tokens": 23,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 45,
      "total_tokens": 480,
      "cache_hit": true
    },
    {
      "run": 5,
      "selection_tokens": 323,
      "invocation_tokens": 23,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 45,
      "total_tokens": 480,
      "cache_hit": true
    }
  ],
  "run1_total": 612,
  "steady_state_avg_total": 480,
  "avg_total": 506.4,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
