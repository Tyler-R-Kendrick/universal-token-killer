// AgentV SDK suite — N-run tool-calling token-efficiency through REAL UTK code
// paths (tool discovery, guidance-ts grammar planning + .utk cache, output
// mediation). Select the arm with --target (toolcalling-baseline /
// toolcalling-utk) and compare arms with `agentv compare`. Configure N via
// UTK_EVAL_RUNS (default 5). Run `npm run build` first.
import { buildToolCallingSuite } from '../dist/agentv/suiteBuilder.js';

export default buildToolCallingSuite({ evalFileUrl: import.meta.url });
