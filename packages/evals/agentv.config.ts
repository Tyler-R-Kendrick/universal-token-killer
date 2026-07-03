export default {
  suite: 'utk-evals',
  /** Formalized eval suites generated from `data/*.jsonl`. */
  suitesDir: './suites',
  /** Benchmark data (one case per line). */
  dataDir: './data',
  /** Compiled AgentV script graders spawned by the suites. */
  gradersDir: './dist/graders'
};
