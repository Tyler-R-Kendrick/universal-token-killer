{
  "arm": "utk",
  "visible": "utk://workflow.swe.deps · schema workflow-swe-deps.v1 · 128→128 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "Upgrade report: httpclient 2.x -> 3.x\nChanged APIs:\n- httpclient.get(url, timeout=) removed; use httpclient.get(url, options={\"timeout\":})\n- httpclient.Session renamed to httpclient.Client\nBreak located: src/net/fetcher.py:63 calls httpclient.get(url, timeout=5)\nFix: httpclient.get(url, options={\"timeout\": 5}) at src/net/fetcher.py:63\nUnaffected: the retry helper in src/net/retry.py uses the new API already\nNote: the upgrade also improves TLS defaults\nNote: see the vendor migration guide for the full list",
  "visible_tokens": 28,
  "recovery_tokens": 37,
  "raw_tokens": 128,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
