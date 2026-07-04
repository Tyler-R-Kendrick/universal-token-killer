{
  "benchmark": "tool-calling-efficiency",
  "arm": "utk",
  "case": "tce-kubectl-get-pods",
  "runs": [
    {
      "run": 1,
      "selection_tokens": 242,
      "invocation_tokens": 25,
      "schema_generation_tokens": 134,
      "output_tokens": 94,
      "recovery_tokens": 37,
      "total_tokens": 532,
      "cache_hit": false
    },
    {
      "run": 2,
      "selection_tokens": 242,
      "invocation_tokens": 25,
      "schema_generation_tokens": 0,
      "output_tokens": 94,
      "recovery_tokens": 37,
      "total_tokens": 398,
      "cache_hit": true
    },
    {
      "run": 3,
      "selection_tokens": 242,
      "invocation_tokens": 25,
      "schema_generation_tokens": 0,
      "output_tokens": 94,
      "recovery_tokens": 37,
      "total_tokens": 398,
      "cache_hit": true
    },
    {
      "run": 4,
      "selection_tokens": 242,
      "invocation_tokens": 25,
      "schema_generation_tokens": 0,
      "output_tokens": 94,
      "recovery_tokens": 37,
      "total_tokens": 398,
      "cache_hit": true
    },
    {
      "run": 5,
      "selection_tokens": 242,
      "invocation_tokens": 25,
      "schema_generation_tokens": 0,
      "output_tokens": 94,
      "recovery_tokens": 37,
      "total_tokens": 398,
      "cache_hit": true
    }
  ],
  "run1_total": 532,
  "steady_state_avg_total": 398,
  "avg_total": 424.8,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
