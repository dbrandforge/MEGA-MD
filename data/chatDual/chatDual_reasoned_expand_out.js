/** Dual reasoned EXPAND index - merges all chunks. Content only, not wired. */
import c0 from './chatDual_reasoned_expand_0.js';
import c1 from './chatDual_reasoned_expand_1.js';
import c2 from './chatDual_reasoned_expand_2.js';
import c3 from './chatDual_reasoned_expand_3.js';
import c4 from './chatDual_reasoned_expand_4.js';

function merge(...objs) {
  const out = {};
  for (const o of objs) {
    for (const [k, arr] of Object.entries(o)) {
      out[k] = [...(out[k] || []), ...arr];
    }
  }
  return out;
}

export default merge(c0, c1, c2, c3, c4);
export const dualReasonedExpand = true;
