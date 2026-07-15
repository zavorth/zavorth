/**
 * Feature flags for the Learned Knowledge Plane (Workflows · Conversation · About you · Knowledge).
 * Zavorth-native product flags — no third-party memory brands.
 */

export type LearnedKnowledgeFlags = {
 /** Master switch for composition / knowledge CLI product surfaces (default on). */
 learnedKnowledgeEnabled: boolean;
 /** Opt-in About-you inject into agent prompts (default off; multi-tenant safe). */
 userModelEnabled: boolean;
 /** Soft token budget for future pack inject . */
 injectTokenBudget: number;
 /** Capture conversational turns into session continuum (default on). */
 continuumCaptureEnabled: boolean;
};

function truthy(raw: string | undefined, defaultOn: boolean): boolean {
 const v = String(raw ?? '').trim().toLowerCase();
 if (!v) return defaultOn;
 if (['0', 'false', 'off', 'no'].includes(v)) return false;
 if (['1', 'true', 'on', 'yes'].includes(v)) return true;
 return defaultOn;
}

/**
 * Resolve flags from env.
 *
 * | Env | Default | Effect |
 * |-----|---------|--------|
 * | ZAVORTH_LEARNED_KNOWLEDGE | on | Knowledge CLI / product plane |
 * | ZAVORTH_USER_MODEL | off | About-you inject into prompts |
 * | ZAVORTH_LEARNED_KNOWLEDGE_INJECT_TOKENS | 1200 | Pack inject budget |
 * | ZAVORTH_CONTINUUM_CAPTURE | on | Append turns to conversation continuum |
 */
export function resolveLearnedKnowledgeFlags(
 env: NodeJS.ProcessEnv = process.env,
): LearnedKnowledgeFlags {
 const injectRaw = Number(env.ZAVORTH_LEARNED_KNOWLEDGE_INJECT_TOKENS);
 const injectTokenBudget = Number.isFinite(injectRaw) && injectRaw > 0
 ? Math.min(8000, Math.floor(injectRaw))
 : 1200;
 return {
 learnedKnowledgeEnabled: truthy(env.ZAVORTH_LEARNED_KNOWLEDGE, true),
 userModelEnabled: truthy(env.ZAVORTH_USER_MODEL, false),
 injectTokenBudget,
 continuumCaptureEnabled: truthy(env.ZAVORTH_CONTINUUM_CAPTURE, true),
 };
}

export function isLearnedKnowledgeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
 return resolveLearnedKnowledgeFlags(env).learnedKnowledgeEnabled;
}

export function isContinuumCaptureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
 return resolveLearnedKnowledgeFlags(env).continuumCaptureEnabled;
}

export function isUserModelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
 return resolveLearnedKnowledgeFlags(env).userModelEnabled;
}
