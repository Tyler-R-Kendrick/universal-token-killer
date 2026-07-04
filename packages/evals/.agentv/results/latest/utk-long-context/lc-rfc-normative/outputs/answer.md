{
  "arm": "utk",
  "visible": "utk://doc.rfc.spec · schema doc-rfc-spec.v1 · 206→206 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "RFC 0042 — Session Token Refresh\nStatus: Draft\nAuthors: platform-team\n1. Introduction\nThis document describes how clients refresh session tokens. Background context\nabout why sessions exist is provided for readers new to the system.\n2. Terminology\nThe words used here follow common industry meaning. Nothing surprising.\n3. Motivation\nHistorically clients re-authenticated from scratch, which was wasteful.\n4. Requirements\nClients MUST refresh the token before it expires using the /refresh endpoint.\nThe default refresh timeout is 900 seconds unless overridden by the server.\n5. Non-goals\nThis RFC does not cover token revocation, which is handled elsewhere.\n6. Security considerations\nStandard transport security applies; use TLS 1.2 or newer.\n7. Acknowledgements\nThanks to everyone who reviewed early drafts over lunch.",
  "visible_tokens": 26,
  "recovery_tokens": 39,
  "raw_tokens": 206,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
