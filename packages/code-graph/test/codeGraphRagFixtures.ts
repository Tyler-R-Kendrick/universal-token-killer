export type CodeGraphRagFixture = {
  name: string;
  category: string;
  query: string;
  useCase: string;
  files: Record<string, string>;
  expectedSymbol: {
    name: string;
    filePath: string;
    kind?: string;
  };
  serenaBaselineTokens: number;
  forbiddenSnippets: string[];
};

type GeneratedScenario = {
  category: string;
  suffix: string;
  make: (domain: DomainCase) => CodeGraphRagFixture;
};

type DomainCase = {
  index: number;
  slug: string;
  title: string;
  noun: string;
  fileStem: string;
};

const widgetService = [
  'export interface WidgetConfig {',
  '  id: string;',
  '  label?: string;',
  '}',
  '',
  'export function makeWidget(config: WidgetConfig) {',
  '  return { id: config.id, label: config.label ?? config.id };',
  '}',
  '',
  'export class WidgetStore {',
  '  save(config: WidgetConfig) {',
  '    return makeWidget(config);',
  '  }',
  '}',
].join('\n');

const BASE_CODE_GRAPH_RAG_FIXTURES: CodeGraphRagFixture[] = [
  {
    name: 'barrel-export-definition',
    category: 'barrel exports',
    query: 'makeWidget',
    useCase: 'Resolve a symbol through a public barrel export without returning raw source bodies.',
    files: {
      'src/widgetService.ts': widgetService,
      'src/index.ts': "export { makeWidget, WidgetStore } from './widgetService.js';\n",
      'src/app.ts': "import { makeWidget } from './index.js';\nexport const widget = makeWidget({ id: 'a' });\n",
    },
    expectedSymbol: { name: 'makeWidget', filePath: 'src/widgetService.ts', kind: 'function' },
    serenaBaselineTokens: 160,
    forbiddenSnippets: ['return { id: config.id'],
  },
  {
    name: 'aliased-import-definition',
    category: 'aliased imports',
    query: 'createWidget',
    useCase: 'Recover original definition when an import alias is used at call site.',
    files: {
      'src/widgetService.ts': widgetService,
      'src/consumer.ts': "import { makeWidget as createWidget } from './widgetService.js';\nexport const widget = createWidget({ id: 'b' });\n",
    },
    expectedSymbol: { name: 'makeWidget', filePath: 'src/widgetService.ts', kind: 'function' },
    serenaBaselineTokens: 155,
    forbiddenSnippets: ['return { id: config.id'],
  },
  {
    name: 'default-export-definition',
    category: 'default exports',
    query: 'buildDefaultWidget',
    useCase: 'Find a named default-exported function and keep response compact.',
    files: {
      'src/defaultWidget.ts': "export default function buildDefaultWidget(id: string) {\n  return { id, defaulted: true };\n}\n",
      'src/useDefault.ts': "import buildDefaultWidget from './defaultWidget.js';\nexport const widget = buildDefaultWidget('c');\n",
    },
    expectedSymbol: { name: 'buildDefaultWidget', filePath: 'src/defaultWidget.ts', kind: 'function' },
    serenaBaselineTokens: 140,
    forbiddenSnippets: ['defaulted: true'],
  },
  {
    name: 'type-only-import-reference',
    category: 'type-only imports',
    query: 'WidgetConfig',
    useCase: 'Preserve type-only import edges so context includes source type and consumer.',
    files: {
      'src/widgetService.ts': widgetService,
      'src/typesConsumer.ts': "import type { WidgetConfig } from './widgetService.js';\nexport function readId(config: WidgetConfig) {\n  return config.id;\n}\n",
    },
    expectedSymbol: { name: 'WidgetConfig', filePath: 'src/widgetService.ts', kind: 'interface' },
    serenaBaselineTokens: 130,
    forbiddenSnippets: ['return config.id'],
  },
  {
    name: 'class-method-reference',
    category: 'class methods',
    query: 'save',
    useCase: 'Find class method entry points and references without dumping class body.',
    files: {
      'src/widgetService.ts': widgetService,
      'src/storeConsumer.ts': "import { WidgetStore } from './widgetService.js';\nconst store = new WidgetStore();\nexport const saved = store.save({ id: 'd' });\n",
    },
    expectedSymbol: { name: 'save', filePath: 'src/widgetService.ts', kind: 'method' },
    serenaBaselineTokens: 145,
    forbiddenSnippets: ['return makeWidget(config)'],
  },
  {
    name: 'test-source-hop',
    category: 'test/source hops',
    query: 'makeWidget',
    useCase: 'Rank implementation above test references while retaining test adjacency.',
    files: {
      'src/widgetService.ts': widgetService,
      'test/widgetService.test.ts': "import { makeWidget } from '../src/widgetService.js';\nexport const observed = makeWidget({ id: 'test' });\n",
    },
    expectedSymbol: { name: 'makeWidget', filePath: 'src/widgetService.ts', kind: 'function' },
    serenaBaselineTokens: 165,
    forbiddenSnippets: ['id: config.id'],
  },
];

const DOMAIN_SEEDS = [
  ['alpha', 'Widget'],
  ['bravo', 'Invoice'],
  ['charlie', 'Session'],
  ['delta', 'Router'],
  ['echo', 'Policy'],
  ['foxtrot', 'Ledger'],
  ['golf', 'Event'],
  ['hotel', 'Report'],
  ['india', 'Catalog'],
  ['juliet', 'Workflow'],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const DOMAINS: DomainCase[] = DOMAIN_SEEDS.map(([slug, noun], index) => ({
  index,
  slug,
  title: `${slug[0]!.toUpperCase()}${slug.slice(1)}`,
  noun,
  fileStem: `${slug}${noun}`,
}));

const GENERATED_SCENARIOS: GeneratedScenario[] = [
  {
    category: 'direct exported functions',
    suffix: 'direct-function',
    make: (domain) => {
      const functionName = `make${domain.title}${domain.noun}`;
      const configName = `${domain.title}${domain.noun}Config`;
      return {
        name: `${domain.slug}-direct-function`,
        category: 'direct exported functions',
        query: functionName,
        useCase: `Resolve direct exported function for ${domain.slug} module.`,
        files: {
          [`src/${domain.fileStem}/service.ts`]: [
            `export interface ${configName} {`,
            '  id: string;',
            '}',
            '',
            `export function ${functionName}(config: ${configName}) {`,
            `  return { id: config.id, marker: '${domain.slug}-direct-secret' };`,
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/consumer.ts`]: `import { ${functionName} } from './service.js';\nexport const value = ${functionName}({ id: '${domain.slug}' });\n`,
        },
        expectedSymbol: { name: functionName, filePath: `src/${domain.fileStem}/service.ts`, kind: 'function' },
        serenaBaselineTokens: 190,
        forbiddenSnippets: [`${domain.slug}-direct-secret`],
      };
    },
  },
  {
    category: 'barrel exports',
    suffix: 'barrel-function',
    make: (domain) => {
      const functionName = `load${domain.title}${domain.noun}`;
      return {
        name: `${domain.slug}-barrel-function`,
        category: 'barrel exports',
        query: functionName,
        useCase: `Resolve ${domain.slug} symbol through nested barrel export.`,
        files: {
          [`src/${domain.fileStem}/internal/service.ts`]: [
            `export function ${functionName}(id: string) {`,
            `  return { id, marker: '${domain.slug}-barrel-secret' };`,
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/index.ts`]: `export { ${functionName} } from './internal/service.js';\n`,
          [`test/${domain.fileStem}.test.ts`]: `import { ${functionName} } from '../src/${domain.fileStem}/index.js';\nexport const value = ${functionName}('${domain.slug}');\n`,
        },
        expectedSymbol: { name: functionName, filePath: `src/${domain.fileStem}/internal/service.ts`, kind: 'function' },
        serenaBaselineTokens: 210,
        forbiddenSnippets: [`${domain.slug}-barrel-secret`],
      };
    },
  },
  {
    category: 'aliased imports',
    suffix: 'aliased-import',
    make: (domain) => {
      const functionName = `create${domain.title}${domain.noun}`;
      const aliasName = `build${domain.title}${domain.noun}`;
      return {
        name: `${domain.slug}-aliased-import`,
        category: 'aliased imports',
        query: aliasName,
        useCase: `Recover original ${domain.slug} definition through import alias.`,
        files: {
          [`src/${domain.fileStem}/factory.ts`]: [
            `export function ${functionName}(id: string) {`,
            `  return { id, marker: '${domain.slug}-alias-secret' };`,
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/useFactory.ts`]: `import { ${functionName} as ${aliasName} } from './factory.js';\nexport const value = ${aliasName}('${domain.slug}');\n`,
        },
        expectedSymbol: { name: functionName, filePath: `src/${domain.fileStem}/factory.ts`, kind: 'function' },
        serenaBaselineTokens: 205,
        forbiddenSnippets: [`${domain.slug}-alias-secret`],
      };
    },
  },
  {
    category: 'default exports',
    suffix: 'default-export',
    make: (domain) => {
      const functionName = `default${domain.title}${domain.noun}`;
      return {
        name: `${domain.slug}-default-export`,
        category: 'default exports',
        query: functionName,
        useCase: `Find named default export for ${domain.slug}.`,
        files: {
          [`src/${domain.fileStem}/default.ts`]: [
            `export default function ${functionName}(id: string) {`,
            `  return { id, marker: '${domain.slug}-default-secret' };`,
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/defaultConsumer.ts`]: `import ${functionName} from './default.js';\nexport const value = ${functionName}('${domain.slug}');\n`,
        },
        expectedSymbol: { name: functionName, filePath: `src/${domain.fileStem}/default.ts`, kind: 'function' },
        serenaBaselineTokens: 180,
        forbiddenSnippets: [`${domain.slug}-default-secret`],
      };
    },
  },
  {
    category: 'default import aliases',
    suffix: 'default-import-alias',
    make: (domain) => {
      const functionName = `render${domain.title}${domain.noun}`;
      const aliasName = `${domain.slug}${domain.noun}Renderer`;
      return {
        name: `${domain.slug}-default-import-alias`,
        category: 'default import aliases',
        query: aliasName,
        useCase: `Resolve ${domain.slug} default import alias back to named default function.`,
        files: {
          [`src/${domain.fileStem}/renderer.ts`]: [
            `export default function ${functionName}(id: string) {`,
            `  return { id, marker: '${domain.slug}-default-alias-secret' };`,
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/rendererConsumer.ts`]: `import ${aliasName} from './renderer.js';\nexport const value = ${aliasName}('${domain.slug}');\n`,
        },
        expectedSymbol: { name: functionName, filePath: `src/${domain.fileStem}/renderer.ts`, kind: 'function' },
        serenaBaselineTokens: 205,
        forbiddenSnippets: [`${domain.slug}-default-alias-secret`],
      };
    },
  },
  {
    category: 'type-only imports',
    suffix: 'type-only-interface',
    make: (domain) => {
      const interfaceName = `${domain.title}${domain.noun}Shape`;
      return {
        name: `${domain.slug}-type-only-interface`,
        category: 'type-only imports',
        query: interfaceName,
        useCase: `Resolve type-only interface import for ${domain.slug}.`,
        files: {
          [`src/${domain.fileStem}/types.ts`]: [`export interface ${interfaceName} {`, '  id: string;', '  version: number;', '}'].join('\n'),
          [`src/${domain.fileStem}/reader.ts`]: `import type { ${interfaceName} } from './types.js';\nexport function read${domain.title}(value: ${interfaceName}) {\n  return value.id;\n}\n`,
        },
        expectedSymbol: { name: interfaceName, filePath: `src/${domain.fileStem}/types.ts`, kind: 'interface' },
        serenaBaselineTokens: 175,
        forbiddenSnippets: ['return value.id'],
      };
    },
  },
  {
    category: 'class methods',
    suffix: 'class-method',
    make: (domain) => {
      const className = `${domain.title}${domain.noun}Store`;
      const methodName = `save${domain.title}${domain.noun}`;
      return {
        name: `${domain.slug}-class-method`,
        category: 'class methods',
        query: methodName,
        useCase: `Find ${domain.slug} class method without dumping class body.`,
        files: {
          [`src/${domain.fileStem}/store.ts`]: [
            `export class ${className} {`,
            `  ${methodName}(id: string) {`,
            `    return { id, marker: '${domain.slug}-method-secret' };`,
            '  }',
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/storeConsumer.ts`]: `import { ${className} } from './store.js';\nconst store = new ${className}();\nexport const value = store.${methodName}('${domain.slug}');\n`,
        },
        expectedSymbol: { name: methodName, filePath: `src/${domain.fileStem}/store.ts`, kind: 'method' },
        serenaBaselineTokens: 195,
        forbiddenSnippets: [`${domain.slug}-method-secret`],
      };
    },
  },
  {
    category: 'interface implementations',
    suffix: 'interface-implementation',
    make: (domain) => {
      const interfaceName = `${domain.title}${domain.noun}Port`;
      const className = `${domain.title}${domain.noun}Adapter`;
      return {
        name: `${domain.slug}-interface-implementation`,
        category: 'interface implementations',
        query: interfaceName,
        useCase: `Retain ${domain.slug} interface and implementation adjacency.`,
        files: {
          [`src/${domain.fileStem}/ports.ts`]: [`export interface ${interfaceName} {`, '  run(id: string): string;', '}'].join('\n'),
          [`src/${domain.fileStem}/adapter.ts`]: `import type { ${interfaceName} } from './ports.js';\nexport class ${className} implements ${interfaceName} {\n  run(id: string) {\n    return id.toUpperCase();\n  }\n}\n`,
        },
        expectedSymbol: { name: interfaceName, filePath: `src/${domain.fileStem}/ports.ts`, kind: 'interface' },
        serenaBaselineTokens: 200,
        forbiddenSnippets: ['return id.toUpperCase()'],
      };
    },
  },
  {
    category: 'const exports',
    suffix: 'const-export',
    make: (domain) => {
      const constName = `${domain.slug}${domain.noun}Defaults`;
      return {
        name: `${domain.slug}-const-export`,
        category: 'const exports',
        query: constName,
        useCase: `Find exported constant config for ${domain.slug}.`,
        files: {
          [`src/${domain.fileStem}/constants.ts`]: [`export const ${constName} = {`, `  marker: '${domain.slug}-const-secret',`, '  retries: 3,', '};'].join('\n'),
          [`src/${domain.fileStem}/constantsConsumer.ts`]: `import { ${constName} } from './constants.js';\nexport const retries = ${constName}.retries;\n`,
        },
        expectedSymbol: { name: constName, filePath: `src/${domain.fileStem}/constants.ts`, kind: 'const' },
        serenaBaselineTokens: 170,
        forbiddenSnippets: [`${domain.slug}-const-secret`],
      };
    },
  },
  {
    category: 'type aliases',
    suffix: 'type-alias',
    make: (domain) => {
      const typeName = `${domain.title}${domain.noun}Payload`;
      return {
        name: `${domain.slug}-type-alias`,
        category: 'type aliases',
        query: typeName,
        useCase: `Resolve exported type alias for ${domain.slug}.`,
        files: {
          [`src/${domain.fileStem}/payload.ts`]: `export type ${typeName} = {\n  id: string;\n  marker: '${domain.slug}-type-secret';\n};\n`,
          [`src/${domain.fileStem}/payloadConsumer.ts`]: `import type { ${typeName} } from './payload.js';\nexport const idOf = (payload: ${typeName}) => payload.id;\n`,
        },
        expectedSymbol: { name: typeName, filePath: `src/${domain.fileStem}/payload.ts`, kind: 'type' },
        serenaBaselineTokens: 175,
        forbiddenSnippets: [`${domain.slug}-type-secret`],
      };
    },
  },
  {
    category: 'javascript esm',
    suffix: 'javascript-esm',
    make: (domain) => {
      const functionName = `parse${domain.title}${domain.noun}`;
      return {
        name: `${domain.slug}-javascript-esm`,
        category: 'javascript esm',
        query: functionName,
        useCase: `Resolve JavaScript ESM export for ${domain.slug}.`,
        files: {
          [`src/${domain.fileStem}/parser.js`]: [
            `export function ${functionName}(input) {`,
            `  return { input, marker: '${domain.slug}-js-secret' };`,
            '}',
          ].join('\n'),
          [`src/${domain.fileStem}/parserConsumer.js`]: `import { ${functionName} } from './parser.js';\nexport const value = ${functionName}('${domain.slug}');\n`,
        },
        expectedSymbol: { name: functionName, filePath: `src/${domain.fileStem}/parser.js`, kind: 'function' },
        serenaBaselineTokens: 180,
        forbiddenSnippets: [`${domain.slug}-js-secret`],
      };
    },
  },
];

export const GENERATED_CODE_GRAPH_RAG_FIXTURES: CodeGraphRagFixture[] = DOMAINS.flatMap((domain) =>
  GENERATED_SCENARIOS.map((scenario) => scenario.make(domain)),
);

export const CODE_GRAPH_RAG_FIXTURES: CodeGraphRagFixture[] = [
  ...BASE_CODE_GRAPH_RAG_FIXTURES,
  ...GENERATED_CODE_GRAPH_RAG_FIXTURES,
];

export const CODE_GRAPH_RAG_EVALS = CODE_GRAPH_RAG_FIXTURES.map((fixture) => fixture.name);

export function codeGraphRagExpectedPayload(fixture: CodeGraphRagFixture): string {
  return JSON.stringify(
    {
      scenario: fixture.name,
      query: fixture.query,
      expected_symbol: fixture.expectedSymbol,
      serena_baseline_tokens: fixture.serenaBaselineTokens,
      forbidden_snippets: fixture.forbiddenSnippets,
    },
    null,
    2,
  );
}
