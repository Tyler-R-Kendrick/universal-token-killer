{
  "benchmark": "tool-calling-efficiency",
  "arm": "utk",
  "case": "tce-stripe-refund-lookup",
  "runs": [
    {
      "run": 1,
      "selection_tokens": 408,
      "invocation_tokens": 20,
      "schema_generation_tokens": 134,
      "output_tokens": 96,
      "recovery_tokens": 61,
      "total_tokens": 719,
      "cache_hit": false
    },
    {
      "run": 2,
      "selection_tokens": 408,
      "invocation_tokens": 20,
      "schema_generation_tokens": 0,
      "output_tokens": 96,
      "recovery_tokens": 61,
      "total_tokens": 585,
      "cache_hit": true
    },
    {
      "run": 3,
      "selection_tokens": 408,
      "invocation_tokens": 20,
      "schema_generation_tokens": 0,
      "output_tokens": 96,
      "recovery_tokens": 61,
      "total_tokens": 585,
      "cache_hit": true
    },
    {
      "run": 4,
      "selection_tokens": 408,
      "invocation_tokens": 20,
      "schema_generation_tokens": 0,
      "output_tokens": 96,
      "recovery_tokens": 61,
      "total_tokens": 585,
      "cache_hit": true
    },
    {
      "run": 5,
      "selection_tokens": 408,
      "invocation_tokens": 20,
      "schema_generation_tokens": 0,
      "output_tokens": 96,
      "recovery_tokens": 61,
      "total_tokens": 585,
      "cache_hit": true
    }
  ],
  "run1_total": 719,
  "steady_state_avg_total": 585,
  "avg_total": 611.8,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
