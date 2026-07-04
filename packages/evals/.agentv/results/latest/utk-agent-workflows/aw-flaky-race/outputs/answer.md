{
  "arm": "utk",
  "visible": "utk://workflow.swe.flaky · schema workflow-swe-flaky.v1 · 145→145 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "Flaky test report (last 50 CI runs)\ntest_upload_then_list ....... failed 7/50 (flaky)\ntest_login .................. passed 50/50\ntest_logout ................. passed 50/50\nAnalysis: test_upload_then_list asserts the file appears immediately, but the\nuploader writes asynchronously — a race between the write and the list call.\nRepro: the failure only happens when the CI worker is under load.\nFix hint: await the upload completion callback before listing in tests/test_files.py\nNote: retrying masks the bug and is discouraged\nNote: full logs archived in the CI artifacts bucket",
  "visible_tokens": 29,
  "recovery_tokens": 34,
  "raw_tokens": 145,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
