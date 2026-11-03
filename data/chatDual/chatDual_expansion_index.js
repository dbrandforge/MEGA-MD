/** COMPLETE dual bank expansion index - CONTENT ONLY. Isolated, not wired into production. */
import core from './chatDual_core_data.js';
import yoruba from './chatDual_yoruba_data.js';
import conversational from './chatDual_conversational_data.js';
import gist from './chatDual_gist_data.js';
import financialNeed from './chatDual_money_data.js';
import relationshipExtra from './chatDual_rel_life_data.js';
import e00 from './ev_0_0.js';
import e01 from './ev_0_1.js';
import e02 from './ev_0_2.js';
import e03 from './ev_0_3.js';
import e10 from './ev_1_0.js';
import e11 from './ev_1_1.js';
import e12 from './ev_1_2.js';
import e13 from './ev_1_3.js';
import e20 from './ev_2_0.js';
import e21 from './ev_2_1.js';
import e22 from './ev_2_2.js';
import e23 from './ev_2_3.js';
import e30 from './ev_3_0.js';
import e31 from './ev_3_1.js';
import e32 from './ev_3_2.js';
import e33 from './ev_3_3.js';

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
export const dualReasonedExpand = mergeExpand(e00, e01, e02, e03, e10, e11, e12, e13, e20, e21, e22, e23, e30, e31, e32, e33);
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
