#!/usr/bin/env python3
import json
import os
import sys


def fake_compress(text, rate):
    words = text.split()
    keep = max(1, int(len(words) * rate))
    return " ".join(words[:keep])


def main():
    request = json.load(sys.stdin)
    text = request.get("text", "")
    rate = float(request.get("rate", 0.33))
    target_token = int(request.get("targetToken", -1))
    force_tokens = request.get("forceTokens", ["\n", "?", ":", ".", "/", "\\"])
    model_name = request.get("modelName") or os.environ.get(
        "UTK_LLMLINGUA_MODEL",
        "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
    )

    if os.environ.get("UTK_DETOK_FAKE") == "1":
        compressed = fake_compress(text, rate)
        if os.environ.get("UTK_DETOK_FAKE_MINIMAL") == "1":
            json.dump({}, sys.stdout)
            return
        json.dump(
            {
                "compressedText": compressed,
                "originTokens": len(text.split()),
                "compressedTokens": len(compressed.split()),
                "rate": rate,
                "model": "fake-llmlingua2",
                "usedLlmlingua2": True,
            },
            sys.stdout,
        )
        return

    from llmlingua import PromptCompressor

    compressor = PromptCompressor(model_name=model_name, use_llmlingua2=True)
    result = compressor.compress_prompt(
        text,
        rate=rate,
        target_token=target_token,
        force_tokens=force_tokens,
    )
    compressed = result.get("compressed_prompt", text)
    json.dump(
        {
            "compressedText": compressed,
            "originTokens": result.get("origin_tokens", len(text.split())),
            "compressedTokens": result.get("compressed_tokens", len(compressed.split())),
            "rate": rate,
            "model": model_name,
            "usedLlmlingua2": True,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        json.dump({"error": str(exc), "usedLlmlingua2": False}, sys.stdout)
        sys.exit(1)
