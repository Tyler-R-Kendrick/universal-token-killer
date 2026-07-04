{
  "arm": "utk",
  "visible": "utk://doc.api.reference · schema doc-api-reference.v1 · 157→157 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "Search API Reference\nOverview\nThe Search API lets you query the catalog. It is REST over HTTPS and returns JSON.\nEndpoints\nGET /v1/search — full text search across products\nGET /v1/categories — list the category tree\nGET /v1/suggest — typeahead suggestions\nAuthentication\nAll requests require the header Authorization: Bearer <token>.\nRate limits\nThe /v1/search endpoint is limited to 60 requests per minute per key.\nPagination\nUse the \"cursor\" query parameter to page through results.\nErrors\nThe API returns standard HTTP status codes and a JSON error body.\nSupport\nReach the team on the community forum for general questions.",
  "visible_tokens": 28,
  "recovery_tokens": 33,
  "raw_tokens": 157,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
