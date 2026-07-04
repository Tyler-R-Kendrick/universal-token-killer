{
  "arm": "utk",
  "visible": "utk://workflow.swe.test-fail · schema workflow-swe-test-fail.v1 · 226→226 tok · 2 facts recoverable via utk_expand_context",
  "recoverable": "$ pytest -q\n............F..........\n=================================== FAILURES ===================================\n____________________ test_apply_discount_handles_missing ______________________\n    def test_apply_discount_handles_missing():\n        cart = Cart(items=[])\n>       assert apply_discount(cart, None) == 0\nE       AttributeError: 'NoneType' object has no attribute 'rate'\nsrc/pricing/discount.py:47: AttributeError\n--------------------------------------------------------------------------------\nRoot cause: apply_discount dereferences coupon.rate without a None guard at src/pricing/discount.py:47\nSuggested fix: return 0 early when coupon is None before reading coupon.rate\n--------------------------------------------------------------------------------\n1 failed, 21 passed in 3.14s\nCoverage report written to htmlcov/index.html\nNote: 3 warnings about deprecated fixtures were emitted",
  "visible_tokens": 31,
  "recovery_tokens": 30,
  "raw_tokens": 226,
  "model": "none (offline deterministic surfaces; ceil(len/4) token estimate)"
}
