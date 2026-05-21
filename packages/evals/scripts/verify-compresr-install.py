import json
import os
import sys

try:
    import compresr
    from compresr import MODELS, CompressionClient
    from importlib.metadata import version
except Exception as exc:
    print(json.dumps({"installed": False, "error": str(exc)}))
    sys.exit(1)

installed_version = version("compresr")
model_values = [value for name, value in MODELS.__dict__.items() if name.isupper() and isinstance(value, str)]
api_key_present = bool(os.environ.get("COMPRESR_API_KEY"))

print(json.dumps({
    "installed": True,
    "package": "compresr",
    "version": installed_version,
    "module": getattr(compresr, "__file__", None),
    "client": CompressionClient.__name__,
    "apiKeyEnvVar": "COMPRESR_API_KEY",
    "apiKeyPresent": api_key_present,
    "liveApiConfigured": api_key_present,
    "models": sorted(set(model_values)),
}, indent=2))
