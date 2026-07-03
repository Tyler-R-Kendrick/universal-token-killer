export const EMISSION_MODES = ['lite', 'full', 'ultra', 'off'] as const;
export type EmissionMode = (typeof EMISSION_MODES)[number];

/**
 * Output classes that are never minified, macro-compressed, or dropped.
 * No mode — including ultra — can remove one: Ponytail's own control arm
 * showed that removing safety carve-outs regresses correctness, so the
 * built-in set is a floor, not a default.
 */
export const EMISSION_SAFETY_CARVE_OUTS = [
  'security',
  'trust-boundary',
  'data-loss',
  'diagnostics',
  'user-facing-strings'
] as const;

export type EmissionPolicyConfig = {
  mode?: string;
  carve_outs?: string[];
};

export type EmissionPolicy = {
  mode: EmissionMode;
  carveOuts: string[];
};

export function resolveEmissionPolicy(config: EmissionPolicyConfig = {}): EmissionPolicy {
  const mode = config.mode ?? 'full';
  if (!EMISSION_MODES.includes(mode as EmissionMode)) {
    throw new Error(`Emission mode '${mode}' is not one of ${EMISSION_MODES.join(', ')}`);
  }
  const carveOuts: string[] = [...EMISSION_SAFETY_CARVE_OUTS];
  for (const extra of config.carve_outs ?? []) {
    if (!carveOuts.includes(extra)) {
      carveOuts.push(extra);
    }
  }
  return { mode: mode as EmissionMode, carveOuts };
}
