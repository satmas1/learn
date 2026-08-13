// Deterministic question bank generator
// Produces multiple-choice items for each curriculum node.
// Uses a seeded PRNG for stable output.

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
function shuffleWithSeed(seed, arr) {
  const r = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtLine(m, b) {
  const bAbs = Math.abs(b);
  const bPart = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${bAbs}`;
  const mPart = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`;
  return `y = ${mPart}${bPart}`;
}

// ---------- Per-node generators ----------

function genSlopeIntercept(idx) {
  const r = mulberry32(1000 + idx);
  const t = Math.floor(r() * 3); // 0: slope-from-two-points, 1: identify m, 2: identify b
  if (t === 0) {
    // slope from two points
    const x1 = Math.floor(r() * 9) - 4;
    let x2 = x1 + 1 + Math.floor(r() * 4);
    const m = Math.round((r() * 8 - 4) * 2) / 2; // half-integer slope
    const y1 = Math.floor(r() * 9) - 4;
    const y2 = y1 + m * (x2 - x1);
    if (!Number.isFinite(m) || x2 === x1) return genSlopeIntercept(idx + 7);
    const correct = m;
    const distractSet = new Set();
    for (const cand of [m + 1, m - 1, -m, m + 0.5, m - 0.5, m * 2]) {
      if (cand !== correct && !distractSet.has(cand)) distractSet.add(cand);
      if (distractSet.size >= 3) break;
    }
    const choices = shuffleWithSeed(idx * 3 + 1, [correct, ...distractSet]);
    return {
      id: `si-${idx}-a`,
      prompt: `What is the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2})?`,
      choices: choices.map(String),
      correctIndex: choices.indexOf(correct),
      explanation: `Slope = (y2 - y1)/(x2 - x1) = (${y2} - ${y1})/(${x2} - ${x1}) = ${m}.`,
    };
  }
  if (t === 1) {
    const m = Math.round((r() * 8 - 4) * 2) / 2 || 1;
    const b = Math.floor(r() * 11) - 5;
    const eq = fmtLine(m, b);
    const correct = m;
    const distractSet = new Set();
    for (const cand of [m + 1, m - 1, -m, m + 2, m - 2, m * 2]) {
      if (cand !== correct && !distractSet.has(cand)) distractSet.add(cand);
      if (distractSet.size >= 3) break;
    }
    const choices = shuffleWithSeed(idx * 3 + 2, [correct, ...distractSet]);
    return {
      id: `si-${idx}-b`,
      prompt: `In the equation ${eq}, what is the slope (m)?`,
      choices: choices.map(String),
      correctIndex: choices.indexOf(correct),
      explanation: `The coefficient of x is the slope. Here m = ${m}.`,
    };
  }
  const m = Math.round((r() * 8 - 4) * 2) / 2 || 1;
  const b = Math.floor(r() * 11) - 5;
  const eq = fmtLine(m, b);
  const correct = b;
  const distractSet = new Set();
  for (const cand of [b + 2, b - 2, -b, b + 1, b - 1, b + 3]) {
    if (cand !== correct && !distractSet.has(cand)) distractSet.add(cand);
    if (distractSet.size >= 3) break;
  }
  const choices = shuffleWithSeed(idx * 3 + 3, [correct, ...distractSet]);
  return {
    id: `si-${idx}-c`,
    prompt: `What is the y-intercept of ${eq}?`,
    choices: choices.map(String),
    correctIndex: choices.indexOf(correct),
    explanation: `The constant term is the y-intercept. Here b = ${b}.`,
  };
}

function genParallelPerp(idx) {
  const r = mulberry32(2000 + idx);
  const parallel = r() > 0.5;
  const m = Math.round((r() * 8 - 4) * 2) / 2 || 2;
  const b = Math.floor(r() * 11) - 5;
  const eq = fmtLine(m, b);
  if (parallel) {
    const correct = fmtLine(m, b + 3);
    const wrong = [fmtLine(-m, b + 1), fmtLine(1/m || 1, b - 2), fmtLine(m + 1, b)];
    const choices = shuffleWithSeed(idx * 5, [correct, ...wrong]);
    return {
      id: `pp-${idx}-par`,
      prompt: `Which line is PARALLEL to ${eq}?`,
      choices,
      correctIndex: choices.indexOf(correct),
      explanation: `Parallel lines share the same slope (${m}) but have different y-intercepts.`,
    };
  } else {
    const mPerpRaw = -1 / m;
    const mPerp = Math.round(mPerpRaw * 100) / 100;
    const correct = fmtLine(mPerp, b + 2);
    const wrong = [fmtLine(m, b + 1), fmtLine(-m, b), fmtLine(m + 1, b - 1)];
    const choices = shuffleWithSeed(idx * 5 + 1, [correct, ...wrong]);
    return {
      id: `pp-${idx}-perp`,
      prompt: `Which line is PERPENDICULAR to ${eq}?`,
      choices,
      correctIndex: choices.indexOf(correct),
      explanation: `Perpendicular slopes multiply to -1. Here perpendicular slope = -1/(${m}) = ${mPerp}.`,
    };
  }
}

const SCENARIOS = [
  { setup: 'A taxi charges a $%b flat fee plus $%m per mile', ask: 'total cost y for x miles', bmeans: 'flat fee ($)', mmeans: 'cost per mile ($)' },
  { setup: 'A gym membership costs $%b to join plus $%m per month', ask: 'total cost y after x months', bmeans: 'one-time joining fee ($)', mmeans: 'monthly cost ($)' },
  { setup: 'A phone plan has a $%b monthly base fee plus $%m per GB', ask: 'monthly cost y for x GB used', bmeans: 'base monthly fee ($)', mmeans: 'per-GB rate ($)' },
  { setup: 'A candle starts at %b cm tall and shrinks %m cm per hour', ask: 'height y after x hours (use negative slope)', bmeans: 'starting height (cm)', mmeans: 'burn rate (cm/hour)' },
  { setup: 'A savings account starts with $%b and grows by $%m each week', ask: 'balance y after x weeks', bmeans: 'starting balance ($)', mmeans: 'weekly deposit ($)' },
];

function genLinearModelling(idx) {
  const r = mulberry32(3000 + idx);
  const scen = SCENARIOS[Math.floor(r() * SCENARIOS.length)];
  const m = 1 + Math.floor(r() * 9);
  const b = 5 + Math.floor(r() * 40);
  const setup = scen.setup.replace('%m', m).replace('%b', b);
  const askType = Math.floor(r() * 3);
  if (askType === 0) {
    const correct = `y = ${m}x + ${b}`;
    const wrong = [`y = ${b}x + ${m}`, `y = ${m}x - ${b}`, `y = ${m + 1}x + ${b}`];
    const choices = shuffleWithSeed(idx * 7, [correct, ...wrong]);
    return {
      id: `lm-${idx}-a`,
      prompt: `${setup}. Which equation models the ${scen.ask}?`,
      choices,
      correctIndex: choices.indexOf(correct),
      explanation: `Slope (m = ${m}) is the rate; y-intercept (b = ${b}) is the starting value.`,
    };
  }
  if (askType === 1) {
    const correct = scen.mmeans;
    const wrong = [scen.bmeans, 'the total after x=0', 'the ending value'];
    const choices = shuffleWithSeed(idx * 7 + 1, [correct, ...wrong]);
    return {
      id: `lm-${idx}-b`,
      prompt: `${setup}. In the equation y = ${m}x + ${b}, what does the slope (${m}) represent?`,
      choices,
      correctIndex: choices.indexOf(correct),
      explanation: `Slope is the change per unit of x, i.e., ${scen.mmeans}.`,
    };
  }
  const correct = scen.bmeans;
  const wrong = [scen.mmeans, 'the amount used', 'the number of units'];
  const choices = shuffleWithSeed(idx * 7 + 2, [correct, ...wrong]);
  return {
    id: `lm-${idx}-c`,
    prompt: `${setup}. In the equation y = ${m}x + ${b}, what does the y-intercept (${b}) represent?`,
    choices,
    correctIndex: choices.indexOf(correct),
    explanation: `The y-intercept is the value when x = 0 — the ${scen.bmeans}.`,
  };
}

function frac(n, d) { return `${n}/${d}`; }
function reduce(n, d) {
  const g = (a, b) => b ? g(b, a % b) : Math.abs(a);
  const k = g(n, d);
  n /= k; d /= k;
  if (d < 0) { n = -n; d = -d; }
  return [n, d];
}

function genRationalOps(idx) {
  const r = mulberry32(4000 + idx);
  const op = Math.floor(r() * 4); // 0 +, 1 -, 2 *, 3 /
  const a = (Math.floor(r() * 8) + 1) * (r() < 0.4 ? -1 : 1);
  const b = Math.floor(r() * 8) + 2;
  const c = (Math.floor(r() * 8) + 1) * (r() < 0.4 ? -1 : 1);
  const d = Math.floor(r() * 8) + 2;
  let n, den, sym;
  if (op === 0) { n = a * d + c * b; den = b * d; sym = '+'; }
  else if (op === 1) { n = a * d - c * b; den = b * d; sym = '-'; }
  else if (op === 2) { n = a * c; den = b * d; sym = '×'; }
  else { n = a * d; den = b * c; sym = '÷'; }
  const [rn, rd] = reduce(n, den);
  const correct = rd === 1 ? `${rn}` : frac(rn, rd);
  const wrongs = [
    frac(a + c, b + d),
    frac(a * c, b + d),
    rd === 1 ? `${rn + 1}` : frac(rn + 1, rd),
  ];
  const choices = shuffleWithSeed(idx * 11, [correct, ...wrongs]);
  return {
    id: `ro-${idx}`,
    prompt: `Compute: ${frac(a, b)} ${sym} ${frac(c, d)}`,
    choices,
    correctIndex: choices.indexOf(correct),
    explanation: `Perform the operation and reduce: result = ${correct}.`,
  };
}

const GENERATORS = {
  // Original ids (kept for backward compat with existing tests / users)
  'node-slope-intercept': genSlopeIntercept,
  'node-parallel-lines': genParallelPerp,
  'node-linear-modelling': genLinearModelling,
  'node-rational-ops': genRationalOps,

  // Grade 9 Algebra strand
  'node-y-intercept':        genSlopeIntercept,
  'node-slope-only':         genSlopeIntercept,
  'node-negative-slopes':    genSlopeIntercept,
  'node-steep-slopes':       genSlopeIntercept,
  'node-fractional-slopes':  genSlopeIntercept,
  'node-perpendicular':      genParallelPerp,
  'node-word-problems':      genLinearModelling,

  // Grade 9 Number Sense strand
  'node-frac-halves':        genRationalOps,
  'node-frac-sixths':        genRationalOps,
  'node-frac-eighths':       genRationalOps,
  'node-frac-tenths':        genRationalOps,
  'node-frac-mixed':         genRationalOps,
  'node-numline-integers':   genRationalOps,
  'node-numline-halves':     genRationalOps,
  'node-abs-value':          genRationalOps,
  'node-squares':            genRationalOps,
  'node-cubes':              genRationalOps,

  // Grade 8 Number strand
  'g8-frac-thirds':          genRationalOps,
  'g8-frac-fifths':          genRationalOps,
  'g8-frac-twelfths':        genRationalOps,
  'g8-frac-mixed-8':         genRationalOps,
  'g8-integer-line':         genRationalOps,
  'g8-integer-wide':         genRationalOps,
  'g8-abs-8':                genRationalOps,
  'g8-squares-8':            genRationalOps,
  'g8-cubes-8':              genRationalOps,
  'g8-half-steps':           genRationalOps,

  // Grade 8 Algebra strand
  'g8-slope-intro':          genSlopeIntercept,
  'g8-intercept-intro':      genSlopeIntercept,
  'g8-linear-pattern':       genLinearModelling,
  'g8-linear-shrink':        genLinearModelling,
  'g8-slope-basic':          genSlopeIntercept,
  'g8-line-match':           genSlopeIntercept,
  'g8-frac-slopes':          genSlopeIntercept,
  'g8-model-savings':        genLinearModelling,
  'g8-model-cooling':        genLinearModelling,
  'g8-mixed-review':         genSlopeIntercept,

  // Grade 8 Data / Spatial / Finance
  'g8-percent-basic':        genRationalOps,
  'g8-prob-fraction':        genRationalOps,
  'g8-prob-decimal':         genRationalOps,
  'g8-proportion':           genRationalOps,
  'g8-angle-acute':          genRationalOps,
  'g8-angle-obtuse':         genRationalOps,
  'g8-perpendicular-8':      genParallelPerp,
  'g8-parallel-8':           genParallelPerp,
  'g8-discount-percent':     genRationalOps,
  'g8-tax-percent':          genRationalOps,
  'g8-budget-linear':        genLinearModelling,

  // Grade 9 Data / Geometry / Finance
  'g9-relative-freq':        genRationalOps,
  'g9-scatter-slope':        genLinearModelling,
  'g9-prob-decimal':         genRationalOps,
  'g9-prob-percent':         genRationalOps,
  'g9-angle-acute':          genRationalOps,
  'g9-angle-reflex':         genRationalOps,
  'g9-perp-lines-9':         genParallelPerp,
  'g9-parallel-lines-9':     genParallelPerp,
  'g9-simple-interest':      genRationalOps,
  'g9-tax-rate':             genRationalOps,
  'g9-savings-linear':       genLinearModelling,
};

export function getQuestionsForNode(nodeId, count = 40, seedOffset = 0) {
  const gen = GENERATORS[nodeId];
  if (!gen) return [];
  const out = [];
  const seen = new Set();
  let i = seedOffset;
  let guard = 0;
  while (out.length < count && guard < count * 6) {
    const q = gen(i);
    if (q && !seen.has(q.prompt)) {
      seen.add(q.prompt);
      out.push({ ...q, nodeId });
    }
    i++; guard++;
  }
  return out;
}

// ---------- Final tests ----------
export const TESTS = [
  {
    id: 'test-foundations', grade: 'mixed',
    title: 'Foundations Quiz',
    description: 'Warm up across core algebra + number sense concepts. Great for a quick check-in.',
    totalQuestions: 20, estMinutes: 10,
    weights: {
      'node-slope-intercept': 7,
      'node-parallel-lines': 4,
      'node-linear-modelling': 4,
      'node-rational-ops': 5,
    },
  },
  {
    id: 'test-midterm', grade: 'mixed',
    title: 'Comprehensive Midterm',
    description: 'Mid-course assessment covering slope, intercepts, parallel/perpendicular relationships, modelling, and rationals.',
    totalQuestions: 35, estMinutes: 25,
    weights: {
      'node-slope-intercept': 12,
      'node-parallel-lines': 8,
      'node-linear-modelling': 8,
      'node-rational-ops': 7,
    },
  },
  {
    id: 'test-final', grade: 'mixed',
    title: 'Final Exam',
    description: 'Full-length final exam. All concepts, harder distractors, timed practice recommended.',
    totalQuestions: 50, estMinutes: 40,
    weights: {
      'node-slope-intercept': 16,
      'node-parallel-lines': 12,
      'node-linear-modelling': 12,
      'node-rational-ops': 10,
    },
  },

  // ---- Grade 8 presets ----
  {
    id: 'test-g8-quick', grade: '8',
    title: 'Grade 8 Quick Check',
    description: 'Short check-up across Ontario Grade 8 strands — patterns, integers, fractions, and percents.',
    totalQuestions: 15, estMinutes: 10,
    weights: {
      'g8-slope-intro':      3,
      'g8-linear-pattern':   3,
      'g8-frac-thirds':      2,
      'g8-frac-fifths':      2,
      'g8-integer-line':     2,
      'g8-percent-basic':    3,
    },
  },
  {
    id: 'test-g8-final', grade: '8',
    title: 'Grade 8 Final Exam',
    description: 'Full-length Grade 8 exam covering Number, Algebra & Patterns, Data, Spatial Sense, and Financial Literacy.',
    totalQuestions: 30, estMinutes: 25,
    weights: {
      'g8-slope-intro':      3,
      'g8-intercept-intro':  3,
      'g8-linear-pattern':   3,
      'g8-linear-shrink':    2,
      'g8-line-match':       3,
      'g8-frac-thirds':      2,
      'g8-frac-fifths':      2,
      'g8-integer-line':     2,
      'g8-integer-wide':     2,
      'g8-percent-basic':    2,
      'g8-discount-percent': 2,
      'g8-perpendicular-8':  2,
      'g8-parallel-8':       2,
    },
  },

  // ---- Grade 9 presets ----
  {
    id: 'test-g9-quick', grade: '9',
    title: 'Grade 9 Quick Check',
    description: 'Short check-up across Ontario Grade 9 strands — linear relations, rationals, and probability.',
    totalQuestions: 15, estMinutes: 10,
    weights: {
      'node-slope-intercept': 4,
      'node-parallel-lines':  3,
      'node-linear-modelling':2,
      'node-rational-ops':    3,
      'g9-prob-percent':      3,
    },
  },
  {
    id: 'test-g9-final', grade: '9',
    title: 'Grade 9 Final Exam',
    description: 'Full-length Grade 9 exam covering Algebra & Linear Relations, Number Sense, Data, Geometry, and Financial Literacy.',
    totalQuestions: 30, estMinutes: 25,
    weights: {
      'node-slope-intercept': 5,
      'node-parallel-lines':  3,
      'node-perpendicular':   3,
      'node-linear-modelling':3,
      'node-negative-slopes': 2,
      'node-rational-ops':    4,
      'g9-prob-percent':      3,
      'g9-relative-freq':     2,
      'g9-perp-lines-9':      3,
      'g9-simple-interest':   2,
    },
  },
];

export function getTestQuestions(testId) {
  const t = TESTS.find(x => x.id === testId);
  if (!t) return null;
  const seedMap = {
    'test-foundations': 500,
    'test-midterm':     1200,
    'test-final':       2000,
    'test-g8-quick':    3100,
    'test-g8-final':    3200,
    'test-g9-quick':    4100,
    'test-g9-final':    4200,
  };
  const seedBase = seedMap[testId] ?? 5000;
  const items = [];
  for (const [nodeId, n] of Object.entries(t.weights)) {
    const qs = getQuestionsForNode(nodeId, n, seedBase);
    items.push(...qs);
  }
  return { test: t, questions: shuffleWithSeed(seedBase, items) };
}
