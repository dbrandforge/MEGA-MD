/** COMPLETE dual bank expansion index - CONTENT ONLY. Isolated, not wired into production. */
import core from './chatDual_core_data.js';
import yoruba from './chatDual_yoruba_data.js';
import conversational from './chatDual_conversational_data.js';
import gist from './chatDual_gist_data.js';
import financialNeed from './chatDual_money_data.js';
import relationshipExtra from './chatDual_rel_life_data.js';
import v0 from './expand_vol_0.js';
import v1 from './expand_vol_1.js';
import v2 from './expand_vol_2.js';
import v3 from './expand_vol_3.js';

function mergeExpand(...objs) {
  const out = {};
  for (const o of objs) {
    for (const [k, arr] of Object.entries(o)) {
      out[k] = [...(out[k] || []), ...arr];
    }
  }
  return out;
}

export const dualReasonedCore = core;
export const dualReasonedExpand = mergeExpand(v0, v1, v2, v3);
export const dualYoruba = yoruba;
export const dualConversational = conversational;
export const dualGist = gist;
export const dualFinancial = financialNeed;
export const dualRelLife = relationshipExtra;

export default {
  core: dualReasonedCore,
  expand: dualReasonedExpand,
  yoruba: dualYoruba,
  conversational: dualConversational,
  gist: dualGist,
  financialNeed: dualFinancial,
  relationshipExtra: dualRelLife,
};

export function dualExpansionStats() {
  const coreN = Object.values(dualReasonedCore).reduce((s, a) => s + a.length, 0);
  const expandN = Object.values(dualReasonedExpand).reduce((s, a) => s + a.length, 0);
  return {
    core: coreN,
    expand: expandN,
    yoruba: dualYoruba.length,
    conversational: dualConversational.length,
    gist: dualGist.length,
    financialNeed: dualFinancial.length,
    relationshipExtra: dualRelLife.length,
    total: coreN + expandN + dualYoruba.length + dualConversational.length + dualGist.length + dualFinancial.length + dualRelLife.length,
  };
}

export const dualBankExpansionComplete = true;
