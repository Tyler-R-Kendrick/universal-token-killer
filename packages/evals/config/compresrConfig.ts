export const COMPRESR_INSTALL_CONFIG = {
  pythonPackage: 'compresr',
  installedVersion: '2.5.1',
  installCommand: 'python -m pip install --user compresr==2.5.1',
  apiKeyEnvVar: 'COMPRESR_API_KEY',
  liveApiMode: 'disabled-without-api-key',
  baselineMode: 'deterministic-installed-sdk-model-baselines',
  models: [
    'espresso_v1',
    'latte_v1',
    'agentic_history_lingua',
    'agentic_tool_output_gemfilter',
    'agentic_tool_output_lingua',
    'agentic_tool_discovery_sat'
  ],
  endpoints: [
    '/api/compress/question-agnostic/',
    '/api/compress/question-specific/',
    '/api/compress/question-agnostic/batch',
    '/api/compress/question-specific/batch'
  ]
} as const;
