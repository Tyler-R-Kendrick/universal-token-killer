// AgentV SDK suite — thin wrapper over the shared builder (compiled to dist/
// so the AgentV .eval.ts loader can resolve it). Run `npm run build` first.
import { buildArmSuite } from '../dist/agentv/suiteBuilder.js';

export default buildArmSuite({ benchmark: 'long-context', evalFileUrl: import.meta.url });
