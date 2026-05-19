"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWorkspaceStore = initializeWorkspaceStore;
exports.cleanupObservations = cleanupObservations;
exports.validateArtifacts = validateArtifacts;
exports.quarantineInvalidArtifacts = quarantineInvalidArtifacts;
exports.rebuildRoutes = rebuildRoutes;
exports.compactSchemaHistory = compactSchemaHistory;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const STORE_GITIGNORE = `/tools/*/observations/\n/routing-telemetry/\n/evals/results/\n/traces/\n/tmp/\n*.raw.json\n*.raw.txt\n*.raw.bin\n`;
async function initializeWorkspaceStore(workspaceRoot) {
    const storageRoot = node_path_1.default.join(workspaceRoot, '.utk');
    await (0, promises_1.mkdir)(storageRoot, { recursive: true });
    await Promise.all(['tools', 'routes', 'grammars', 'quarantine', 'routing-telemetry', 'evals/fixtures', 'evals/results', 'traces'].map((part) => (0, promises_1.mkdir)(node_path_1.default.join(storageRoot, part), { recursive: true })));
    await (0, promises_1.writeFile)(node_path_1.default.join(storageRoot, '.gitignore'), STORE_GITIGNORE, 'utf8');
    return storageRoot;
}
async function cleanupObservations(storageRoot, toolIds) {
    let removed = 0;
    const toolsRoot = node_path_1.default.join(storageRoot, 'tools');
    for (const tool of await safeReadDir(toolsRoot)) {
        if (toolIds && !toolIds.includes(tool))
            continue;
        const observations = node_path_1.default.join(toolsRoot, tool, 'observations');
        for (const observation of await safeReadDir(observations)) {
            await (0, promises_1.rm)(node_path_1.default.join(observations, observation), { recursive: true, force: true });
            removed += 1;
        }
    }
    return removed;
}
async function validateArtifacts(storageRoot) {
    const invalid = [];
    for (const file of await walk(storageRoot)) {
        if (!file.endsWith('.json'))
            continue;
        try {
            JSON.parse(await (0, promises_1.readFile)(file, 'utf8'));
        }
        catch {
            invalid.push(file);
        }
    }
    return invalid;
}
async function quarantineInvalidArtifacts(storageRoot) {
    const invalid = await validateArtifacts(storageRoot);
    const quarantineRoot = node_path_1.default.join(storageRoot, 'quarantine');
    await (0, promises_1.mkdir)(quarantineRoot, { recursive: true });
    for (const file of invalid) {
        await (0, promises_1.rename)(file, node_path_1.default.join(quarantineRoot, node_path_1.default.relative(storageRoot, file).replaceAll(node_path_1.default.sep, '__')));
    }
    return invalid.length;
}
async function rebuildRoutes(storageRoot) {
    const routesRoot = node_path_1.default.join(storageRoot, 'routes');
    await (0, promises_1.mkdir)(routesRoot, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(routesRoot, 'index.json'), `${JSON.stringify({ routes: [] }, null, 2)}\n`, 'utf8');
    await (0, promises_1.writeFile)(node_path_1.default.join(routesRoot, 'index.toon'), 'routes[]\n', 'utf8');
    await (0, promises_1.writeFile)(node_path_1.default.join(routesRoot, 'index.min.toon'), 'routes[]\n', 'utf8');
}
async function compactSchemaHistory(storageRoot) {
    let removed = 0;
    const toolsRoot = node_path_1.default.join(storageRoot, 'tools');
    for (const tool of await safeReadDir(toolsRoot)) {
        const history = node_path_1.default.join(toolsRoot, tool, 'history');
        const schemas = (await safeReadDir(history)).filter((file) => file.endsWith('.schema.json')).sort();
        const keep = schemas.at(-1);
        for (const schema of schemas) {
            if (schema === keep)
                continue;
            await (0, promises_1.rm)(node_path_1.default.join(history, schema), { force: true });
            removed += 1;
        }
    }
    return removed;
}
async function walk(root) {
    const entries = await safeReadDir(root);
    const files = [];
    for (const entry of entries) {
        const full = node_path_1.default.join(root, entry);
        const children = await safeReadDir(full);
        if (children.length === 0)
            files.push(full);
        else
            files.push(...(await walk(full)));
    }
    return files;
}
async function safeReadDir(dir) {
    try {
        return await (0, promises_1.readdir)(dir);
    }
    catch {
        return [];
    }
}
