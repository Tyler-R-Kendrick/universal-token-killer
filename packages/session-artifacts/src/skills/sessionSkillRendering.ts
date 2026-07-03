import {
  fallbackTrigger,
  normalizeRequiredSkills,
  sanitizeBodyLine,
  sanitizeProcedurePreview,
  uniqueNormalizedLines,
  yamlScalar
} from './sessionSkillText.js';

export function renderSessionSkill(params: {
  slug: string;
  description: string;
  purpose: string;
  triggers: string[];
  procedure: string[];
  referenceNames: string[];
  requiredSkills?: string[];
  whenNotToUse?: string[];
}): string {
  const normalizedTriggers = uniqueNormalizedLines(params.triggers);
  const triggers = normalizedTriggers.length > 0 ? normalizedTriggers.slice(0, 5) : [fallbackTrigger(params.description)];
  const procedure = shouldUseProcedureReferencePreview(params.procedure)
    ? ['See references/procedure.md.']
    : params.procedure.length > 0
      ? params.procedure.slice(0, 5)
      : ['See references/procedure.md.'];
  const requiredSkills = normalizeRequiredSkills(params.requiredSkills ?? []);
  const boundaries = uniqueNormalizedLines(params.whenNotToUse ?? []);
  const triggerText = triggers.map((trigger) => `- ${sanitizeBodyLine(trigger)}`).join('\n');
  const procedureText = procedure.map((step, index) => `${index + 1}. ${sanitizeProcedurePreview(step)}`).join('\n');
  const referenceText = params.referenceNames.map((fileName) => `- references/${fileName}`).join('\n');
  const requiredText = requiredSkills.length > 0 ? `\n\nRequired skills:\n${requiredSkills.map((skill) => `- ${skill}`).join('\n')}` : '';
  const boundaryText = boundaries.length > 0 ? `\n\nDo not use when:\n${boundaries.map((boundary) => `- ${boundary}`).join('\n')}` : '';
  return `---\nname: ${params.slug}\ndescription: ${yamlScalar(params.description)}\n---\n\n# ${params.slug}\n\nPurpose: ${sanitizeBodyLine(params.purpose) || 'Reduce repeated instructions across future turns.'}\n\nUse when repeated:\n${triggerText}\n\nProcedure:\n${procedureText}${requiredText}${boundaryText}\n\nRefs:\n${referenceText}\n`;
}

function shouldUseProcedureReferencePreview(procedure: string[]): boolean {
  return procedure.some((step) => /\r?\n|```|^\s*\||^\s*!!!/.test(step));
}
