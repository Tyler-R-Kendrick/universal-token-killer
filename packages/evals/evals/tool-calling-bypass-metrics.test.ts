import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  TOOL_CALLING_BYPASS_CATEGORIES,
  TOOL_CALLING_BYPASS_EVALS,
  TOOL_CALLING_BYPASS_BASE_SCENARIO_COUNT,
  TOOL_CALLING_BYPASS_FIXTURES,
  TOOL_CALLING_BYPASS_LEVELS,
  TOOL_CALLING_BYPASS_SCENARIO_MULTIPLIER,
  TOOL_CALLING_BYPASS_TARGET_SCENARIO_COUNT,
  toolCallingBypassExpectedPayload,
  type ToolCallingBypassFixture
} from '../fixtures/toolCallingBypassFixtures.js';
import { gradeToolCallingBypassCodeGraderInput } from '../graders/toolCallingBypassCodeGrader.js';
import {
  assertToolCallingBypass,
  argumentScore,
  parseToolCallingBypassActualPayload,
  parseToolCallingBypassExpectedPayload
} from '../metrics/toolCallingBypassMetrics.js';
import { buildToolCallingBypassReport, renderToolCallingBypassEvalYaml } from '../reports/toolCallingBypassReport.js';

describe('tool-calling bypass AgentV scenarios', () => {
  it('covers broad matching, execution, and safety scenario space', () => {
    expect(TOOL_CALLING_BYPASS_FIXTURES.length).toBe(TOOL_CALLING_BYPASS_TARGET_SCENARIO_COUNT);
    expect(TOOL_CALLING_BYPASS_FIXTURES.length).toBe(TOOL_CALLING_BYPASS_BASE_SCENARIO_COUNT * TOOL_CALLING_BYPASS_SCENARIO_MULTIPLIER);
    expect(new Set(TOOL_CALLING_BYPASS_FIXTURES.map((fixture) => fixture.name)).size).toBe(TOOL_CALLING_BYPASS_FIXTURES.length);
    expect(new Set(TOOL_CALLING_BYPASS_FIXTURES.map((fixture) => fixture.level))).toEqual(new Set(TOOL_CALLING_BYPASS_LEVELS));
    expect(new Set(TOOL_CALLING_BYPASS_FIXTURES.map((fixture) => fixture.category))).toEqual(new Set(TOOL_CALLING_BYPASS_CATEGORIES));
    expect(TOOL_CALLING_BYPASS_FIXTURES.filter((fixture) => fixture.expected.shouldBypass)).toHaveLength(
      TOOL_CALLING_BYPASS_FIXTURES.filter((fixture) => fixture.expected.expectedTool).length
    );
    expect(TOOL_CALLING_BYPASS_FIXTURES.filter((fixture) => fixture.expected.shouldExecute)).toHaveLength(24);
    expect(TOOL_CALLING_BYPASS_FIXTURES.filter((fixture) => fixture.category === 'embedding').length).toBeGreaterThanOrEqual(20);
    expect(TOOL_CALLING_BYPASS_FIXTURES.filter((fixture) => fixture.category === 'safety-negative').length).toBeGreaterThanOrEqual(11);
    expect(TOOL_CALLING_BYPASS_FIXTURES).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'slash-run-tests-flags', input: '/run_tests --pattern unit' }),
      expect.objectContaining({ name: 'regex-find-todo-in-src', input: 'find TODO in src' }),
      expect.objectContaining({ name: 'regex-read-package-json', input: 'read package json' }),
      expect.objectContaining({ name: 'regex-open-url-fetch', input: 'open https://example.com' }),
      expect.objectContaining({ name: 'negative-do-not-run-tests', input: 'do not run tests' }),
      expect.objectContaining({ name: 'ambiguous-search-project', input: 'search project' })
    ]));
  });

  it('keeps eval names synchronized with fixture scenarios', () => {
    expect(TOOL_CALLING_BYPASS_EVALS).toEqual(TOOL_CALLING_BYPASS_FIXTURES.map((fixture) => fixture.name));
  });

  it.each(TOOL_CALLING_BYPASS_FIXTURES)('$name accepts the golden expected AgentV actual payload', (fixture) => {
    const expected = parseToolCallingBypassExpectedPayload(toolCallingBypassExpectedPayload(fixture));
    const assertion = assertToolCallingBypass({ expected, actual: goodActualForFixture(fixture) });

    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.passed).toBe(true);
    expect(assertion.metrics.overallScore).toBe(1);
  });

  it('fails wrong tool selection, missing args, and skipped local execution', () => {
    const toolFixture = TOOL_CALLING_BYPASS_FIXTURES.find((fixture) => fixture.name === 'regex-find-todo-in-src')!;
    const toolExpected = parseToolCallingBypassExpectedPayload(toolCallingBypassExpectedPayload(toolFixture));
    expect(assertToolCallingBypass({
      expected: toolExpected,
      actual: { ...goodActualForFixture(toolFixture), tool_name: 'web_search' }
    }).failures.join('\n')).toContain('tool_name=web_search expected=grep');

    expect(argumentScore({ pattern: 'TODO', path: 'src' }, { pattern: 'TODO' })).toBe(0.5);

    const execFixture = TOOL_CALLING_BYPASS_FIXTURES.find((fixture) => fixture.name === 'local-exec-chat-slash')!;
    const execExpected = parseToolCallingBypassExpectedPayload(toolCallingBypassExpectedPayload(execFixture));
    const missingExec = assertToolCallingBypass({
      expected: execExpected,
      actual: {
        bypassed: true,
        tool_name: 'run_tests',
        reason: 'slash-command',
        args: { pattern: 'slash' },
        executed: false,
        forwarded_upstream: false
      }
    });

    expect(missingExec.passed).toBe(false);
    expect(missingExec.failures.join('\n')).toContain('executed=false expected=true');
    expect(missingExec.failures.join('\n')).toContain('forwarded_upstream=false expected=true');
  });

  it('exposes AgentV code-grader output for tool bypass contracts', async () => {
    const fixture = TOOL_CALLING_BYPASS_FIXTURES.find((item) => item.name === 'local-exec-chat-regex')!;
    const result = await gradeToolCallingBypassCodeGraderInput({
      input_text: fixture.input,
      output_text: JSON.stringify(goodActualForFixture(fixture)),
      expected_output_text: toolCallingBypassExpectedPayload(fixture)
    });

    expect(result.score).toBe(1);
    expect(result.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(result.reasoning).toContain(fixture.name);
  });

  it('parses OpenAI chat, Responses, and locally executed forwarding shapes', () => {
    expect(parseToolCallingBypassActualPayload(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'fetch', arguments: JSON.stringify({ url: 'https://example.com' }) } }]
        }
      }]
    }))).toMatchObject({ bypassed: true, tool_name: 'fetch', args: { url: 'https://example.com' }, executed: false, forwarded_upstream: false });

    expect(parseToolCallingBypassActualPayload(JSON.stringify({
      output: [{ type: 'function_call', name: 'run_tests', arguments: JSON.stringify({ pattern: 'unit' }) }]
    }))).toMatchObject({ bypassed: true, tool_name: 'run_tests', args: { pattern: 'unit' }, executed: false });

    expect(parseToolCallingBypassActualPayload(JSON.stringify({
      messages: [
        { role: 'user', content: '/run_tests --pattern smoke' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'run_tests', arguments: JSON.stringify({ pattern: 'smoke' }) } }] },
        { role: 'tool', tool_call_id: 'call_1', name: 'run_tests', content: 'passed smoke' }
      ]
    }))).toMatchObject({ bypassed: true, tool_name: 'run_tests', args: { pattern: 'smoke' }, executed: true, forwarded_upstream: true, output_text: 'passed smoke' });

    expect(parseToolCallingBypassActualPayload(JSON.stringify({
      input: [
        { role: 'user', content: [{ type: 'input_text', text: '/run_tests --pattern smoke' }] },
        { type: 'function_call', call_id: 'call_1', name: 'run_tests', arguments: JSON.stringify({ pattern: 'smoke' }) },
        { type: 'function_call_output', call_id: 'call_1', output: 'executed run_tests smoke' }
      ]
    }))).toMatchObject({ bypassed: true, tool_name: 'run_tests', args: { pattern: 'smoke' }, executed: true, forwarded_upstream: true, output_text: 'executed run_tests smoke' });
  });

  it('declares AgentV YAML code-grader scenarios for every tool bypass fixture', async () => {
    const yaml = normalizeLineEndings(await readFile(new URL('./tool-calling-bypass.EVAL.yaml', import.meta.url), 'utf8'));

    for (const name of TOOL_CALLING_BYPASS_EVALS) {
      expect(yaml).toContain(`id: ${name}`);
    }
    expect(yaml).toContain('type: code-grader');
    expect(yaml).toContain('toolCallingBypassCodeGrader.js');
    expect(yaml).toContain('\\"tool_matching_level\\": \\"slash-commands\\"');
    expect(yaml).toContain('"should_execute": true');
    expect(yaml).toBe(renderToolCallingBypassEvalYaml());
  });

  it('documents matching-level and category coverage', async () => {
    const report = await buildToolCallingBypassReport();

    expect(report.rows).toHaveLength(TOOL_CALLING_BYPASS_FIXTURES.length);
    expect(report.markdown).toContain('## Level Coverage');
    expect(report.markdown).toContain('## Category Coverage');
    for (const level of TOOL_CALLING_BYPASS_LEVELS) {
      expect(report.markdown).toContain(`| ${level} |`);
    }
    for (const category of TOOL_CALLING_BYPASS_CATEGORIES) {
      expect(report.markdown).toContain(`| ${category} |`);
    }
  });
});

function goodActualForFixture(fixture: ToolCallingBypassFixture) {
  if (!fixture.expected.shouldBypass) {
    const clarification = fixture.expected.expectedMissReason === 'missing-required-args'
      ? 'Missing required arguments for send_email: to'
      : undefined;
    return {
      bypassed: false,
      miss_reason: fixture.expected.expectedMissReason,
      ambiguous: fixture.expected.expectedMissReason === 'ambiguous',
      denied: fixture.expected.expectedMissReason === 'denied-tool',
      protected: fixture.expected.expectedMissReason === 'protected-tool',
      clarification,
      output_text: clarification,
      forwarded_upstream: fixture.expected.shouldForwardUpstream
    };
  }

  return {
    bypassed: true,
    tool_name: fixture.expected.expectedTool,
    reason: fixture.expected.expectedReason,
    args: fixture.expected.expectedArgs ?? {},
    executed: fixture.expected.shouldExecute === true,
    forwarded_upstream: fixture.expected.shouldForwardUpstream === true,
    output_text: fixture.expected.expectedOutputContains?.join('\n') ?? ''
  };
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}
