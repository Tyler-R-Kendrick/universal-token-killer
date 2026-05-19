# Copilot Hook Behavior

UTK handles Copilot tool-hook JSON from stdin-style payloads. When a payload exposes a tool id, input, and output, UTK mediates the result by executing the core pipeline against the observed output.

Observable outputs include `tool_output`, `toolOutput`, and `result`. Shell tools and non-shell tools use the same mediation path once their output is visible. Malformed payloads, missing tool ids, and events with no observable output pass through by returning no update.

The hook returns compact mediated output in `hookSpecificOutput.updatedOutput` when the event shape supports output replacement. The compact response references recovery artifacts and omits the raw payload from chat context.
