#!/usr/bin/env python3
import json
import sys


def main():
    request = json.load(sys.stdin)
    text = request.get("text", "")

    try:
        from kompress.inference.pytorch_runner import KompressRunner
    except Exception as exc:
        json.dump(
            {
                "error": (
                    "Hugging-Face/Kompress-small requires the optional kompress "
                    f"inference package to be installed: {exc}"
                )
            },
            sys.stdout,
        )
        return

    runner = KompressRunner()
    result = runner.compress(text)
    compressed = getattr(result, "compressed", text)
    json.dump(
        {
            "compressedText": compressed,
            "originTokens": len(text.split()),
            "compressedTokens": len(compressed.split()),
            "rate": getattr(result, "compression_ratio", request.get("rate", 0.33)),
            "model": "Hugging-Face/Kompress-small",
            "usedLlmlingua2": False,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        json.dump({"error": str(exc), "usedLlmlingua2": False}, sys.stdout)
        sys.exit(1)
