{
  "benchmark": "tool-calling-efficiency",
  "arm": "utk",
  "case": "tce-terraform-plan",
  "runs": [
    {
      "run": 1,
      "selection_tokens": 227,
      "invocation_tokens": 24,
      "schema_generation_tokens": 134,
      "output_tokens": 92,
      "recovery_tokens": 23,
      "total_tokens": 500,
      "cache_hit": false
    },
    {
      "run": 2,
      "selection_tokens": 227,
      "invocation_tokens": 24,
      "schema_generation_tokens": 0,
      "output_tokens": 92,
      "recovery_tokens": 23,
      "total_tokens": 366,
      "cache_hit": true
    },
    {
      "run": 3,
      "selection_tokens": 227,
      "invocation_tokens": 24,
      "schema_generation_tokens": 0,
      "output_tokens": 92,
      "recovery_tokens": 23,
      "total_tokens": 366,
      "cache_hit": true
    },
    {
      "run": 4,
      "selection_tokens": 227,
      "invocation_tokens": 24,
      "schema_generation_tokens": 0,
      "output_tokens": 92,
      "recovery_tokens": 23,
      "total_tokens": 366,
      "cache_hit": true
    },
    {
      "run": 5,
      "selection_tokens": 227,
      "invocation_tokens": 24,
      "schema_generation_tokens": 0,
      "output_tokens": 92,
      "recovery_tokens": 23,
      "total_tokens": 366,
      "cache_hit": true
    }
  ],
  "run1_total": 500,
  "steady_state_avg_total": 366,
  "avg_total": 392.8,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
