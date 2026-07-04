{
  "arm": "utk",
  "visible": "utk://workflow.swe.bisect · schema workflow-swe-bisect.v1 · 115→115 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "git bisect log (abbreviated)\ngit bisect start\ngit bisect good v1.8.0\ngit bisect bad v1.9.0\nBisecting: 6 revisions left to test\n...\na3f9c21 is the first bad commit\nAuthor: someone\nTitle: refactor: simplify the rounding helper\nOffending change: src/money/round.py switched from round-half-up to banker's rounding\nEffect: totals now differ by a cent on some carts\nNote: the commit message did not mention the behavior change\nNote: 42 commits were scanned in total",
  "visible_tokens": 29,
  "recovery_tokens": 30,
  "raw_tokens": 115,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
