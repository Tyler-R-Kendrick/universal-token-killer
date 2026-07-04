{
  "arm": "utk",
  "visible": "utk://doc.chat.thread · schema doc-chat-thread.v1 · 153→153 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "#support thread (28 messages)\nuser-a: is anyone else seeing 500s on the export button?\nuser-b: works for me, maybe a cache thing\nuser-c: same here, only on the CSV export though\nuser-a: refreshed, still broken\nuser-d: nice weather today btw\nuser-b: lol yes going for a run later\nuser-c: it started around 10am I think\nuser-e: I can repro, looking now\nuser-e: found it, the export worker ran out of disk\nuser-e: RESOLUTION: cleared the temp files and the export worker is healthy again\nuser-e: I will add a disk alert so it does not recur, tracking in TICKET-771\nuser-a: thank you!\nuser-d: great, back to the run",
  "visible_tokens": 27,
  "recovery_tokens": 40,
  "raw_tokens": 153,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
