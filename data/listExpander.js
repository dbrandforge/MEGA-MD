/** Expand seed lists to target size with unique variants */
export function expandList(seeds, target, kind = 'truth') {
  const suffixes = kind === 'dare'
    ? [
        ' Keep it under 30 seconds if VN.',
        ' No clean wording.',
        ' Make it explicit.',
        ' Tag someone if needed.',
        ' Caption must be filthy.',
        ' Don\'t half-do it.',
        ' Group must understand every word.',
        ' Add how it made you feel.',
        ' Be honest not funny.',
        ' Do it now.',
        ' Maximum thirst.',
        ' Maximum honesty.'
      ]
    : [
        ' Be specific.',
        ' No soft version.',
        ' Full detail.',
        ' Don\'t skip the nasty part.',
        ' Name the feeling in your body.',
        ' Include what you said out loud.',
        ' Include what you wish you had done.',
        ' Rate it 1–10 and why.',
        ' What would you repeat?',
        ' What would you never do again?',
        ' How long did it last?',
        ' Who knows about this?',
        ' Would you do it with someone here?',
        ' Describe the sounds.',
        ' Describe the mess.',
        ' What triggered it?',
        ' Morning or night?',
        ' Solo or with someone?',
        ' Planned or spontaneous?',
        ' Drunk, high, or sober?'
      ];
  const extras = [
    '',
    ' Right now.',
    ' In this group context.',
    ' Compared to your last time.',
    ' As if nobody will screenshot it.',
    ' With zero shame.',
    ' Like you\'re confessing at 2am.',
    ' As detailed as a voice note.'
  ];
  const out = [];
  const seen = new Set();
  let i = 0;
  const seedsArr = Array.isArray(seeds) ? seeds.filter(Boolean) : [];
  if (!seedsArr.length) return out;
  while (out.length < target && i < target * 30) {
    const base = seedsArr[i % seedsArr.length];
    let line;
    if (i < seedsArr.length) {
      line = String(base).trim();
    } else {
      const suf = suffixes[(Math.floor(i / seedsArr.length)) % suffixes.length];
      const cycle = Math.floor(i / (seedsArr.length * suffixes.length));
      line = String(base).replace(/[?.!]+$/, '').trim() + suf + extras[cycle % extras.length];
      if (!/[?.!]$/.test(line)) {
        line += /^(what|how|have|ever|who|do |did |are |is |when|where|why)/i.test(base) ? '?' : '.';
      }
    }
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(line);
    }
    i += 1;
  }
  while (out.length < target) {
    out.push(`${seedsArr[out.length % seedsArr.length]} (variant ${out.length + 1})`);
  }
  return out.slice(0, target);
}
