{
  "arm": "utk",
  "visible": "utk://doc.incident.postmortem · schema doc-incident-postmortem.v1 · 154→154 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "Incident 2026-05-30 — checkout latency\nSummary: checkout p99 latency spiked for 38 minutes.\nTimeline:\n09:02 alert fires for checkout latency\n09:05 on-call acknowledges, starts a call\n09:11 dashboards look normal for CPU and memory\n09:19 someone brings coffee to the war room\n09:24 traffic to the payments service looks elevated\n09:31 root cause: a missing index on the orders.customer_id column\n09:40 mitigation: added the index concurrently and latency recovered\n09:44 the call winds down, thanks everyone\nFollow-ups: add a linter to catch unindexed foreign keys.\nNote: the war room whiteboard needs new markers.",
  "visible_tokens": 31,
  "recovery_tokens": 34,
  "raw_tokens": 154,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
