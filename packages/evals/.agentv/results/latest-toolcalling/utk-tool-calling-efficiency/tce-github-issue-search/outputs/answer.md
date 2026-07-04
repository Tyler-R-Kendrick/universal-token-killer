{
  "benchmark": "tool-calling-efficiency",
  "arm": "utk",
  "case": "tce-github-issue-search",
  "runs": [
    {
      "run": 1,
      "selection_tokens": 275,
      "invocation_tokens": 30,
      "schema_generation_tokens": 164,
      "output_tokens": 97,
      "recovery_tokens": 48,
      "total_tokens": 614,
      "cache_hit": false
    },
    {
      "run": 2,
      "selection_tokens": 275,
      "invocation_tokens": 30,
      "schema_generation_tokens": 0,
      "output_tokens": 97,
      "recovery_tokens": 48,
      "total_tokens": 450,
      "cache_hit": true
    },
    {
      "run": 3,
      "selection_tokens": 275,
      "invocation_tokens": 30,
      "schema_generation_tokens": 0,
      "output_tokens": 97,
      "recovery_tokens": 48,
      "total_tokens": 450,
      "cache_hit": true
    },
    {
      "run": 4,
      "selection_tokens": 275,
      "invocation_tokens": 30,
      "schema_generation_tokens": 0,
      "output_tokens": 97,
      "recovery_tokens": 48,
      "total_tokens": 450,
      "cache_hit": true
    },
    {
      "run": 5,
      "selection_tokens": 275,
      "invocation_tokens": 30,
      "schema_generation_tokens": 0,
      "output_tokens": 97,
      "recovery_tokens": 48,
      "total_tokens": 450,
      "cache_hit": true
    }
  ],
  "run1_total": 614,
  "steady_state_avg_total": 450,
  "avg_total": 482.8,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
