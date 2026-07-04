{
  "benchmark": "tool-calling-efficiency",
  "arm": "utk",
  "case": "tce-npm-audit",
  "runs": [
    {
      "run": 1,
      "selection_tokens": 290,
      "invocation_tokens": 21,
      "schema_generation_tokens": 124,
      "output_tokens": 89,
      "recovery_tokens": 38,
      "total_tokens": 562,
      "cache_hit": false
    },
    {
      "run": 2,
      "selection_tokens": 290,
      "invocation_tokens": 21,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 38,
      "total_tokens": 438,
      "cache_hit": true
    },
    {
      "run": 3,
      "selection_tokens": 290,
      "invocation_tokens": 21,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 38,
      "total_tokens": 438,
      "cache_hit": true
    },
    {
      "run": 4,
      "selection_tokens": 290,
      "invocation_tokens": 21,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 38,
      "total_tokens": 438,
      "cache_hit": true
    },
    {
      "run": 5,
      "selection_tokens": 290,
      "invocation_tokens": 21,
      "schema_generation_tokens": 0,
      "output_tokens": 89,
      "recovery_tokens": 38,
      "total_tokens": 438,
      "cache_hit": true
    }
  ],
  "run1_total": 562,
  "steady_state_avg_total": 438,
  "avg_total": 462.8,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
