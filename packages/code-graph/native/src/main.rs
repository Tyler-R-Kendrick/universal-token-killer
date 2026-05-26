use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{self, BufRead, Write};

#[derive(Debug, Deserialize)]
struct EngineRequest {
    id: Option<String>,
    command: String,
    #[serde(default)]
    params: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct EngineResponse {
    id: Option<String>,
    ok: bool,
    result: serde_json::Value,
}

fn main() -> Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let request: EngineRequest = serde_json::from_str(&line?)?;
        let response = handle(request);
        writeln!(stdout, "{}", serde_json::to_string(&response)?)?;
        stdout.flush()?;
    }

    Ok(())
}

fn handle(request: EngineRequest) -> EngineResponse {
    let result = match request.command.as_str() {
        "status" => json!({
            "engine": "utk-code-graph-engine",
            "protocol": 1,
            "stackGraphs": true,
            "treeSitterGraph": true,
            "languages": ["typescript", "javascript"]
        }),
        "index" | "symbols" | "definition" | "references" | "implementations" | "context" | "clean" => json!({
            "accepted": true,
            "command": request.command,
            "params": request.params,
            "note": "Native stack-graph execution path is gated by the TypeScript wrapper until cargo/rustc are installed."
        }),
        _ => json!({
            "error": format!("unknown command: {}", request.command)
        }),
    };

    EngineResponse {
        id: request.id,
        ok: result.get("error").is_none(),
        result,
    }
}
