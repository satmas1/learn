import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { bktUpdate, DEFAULT_MASTERY_THRESHOLD } from '@/lib/bkt';
import { getQuestionsForNode, getTestQuestions, TESTS } from '@/lib/questionBank';
import { v4 as uuidv4 } from 'uuid';

// ---- Seed data (Ontario Grade 8 + 9 Math aligned examples) ----
const SCHEMA_VERSION = 5;

const bktEasy   = { pL0: 0.15, pT: 0.18, pG: 0.22, pS: 0.10 };
const bktMed    = { pL0: 0.10, pT: 0.15, pG: 0.20, pS: 0.10 };
const bktHard   = { pL0: 0.08, pT: 0.12, pG: 0.15, pS: 0.12 };

const SEED_STRANDS = [
  {
    id: 'strand-algebra',
    code: 'MTH1W-C',
    name: 'Algebra & Linear Relations',
    grade: 9,
    region: 'ON',
    description: 'Linear equations, slope, intercepts, and modelling.',
    nodes: [
      { id: 'node-slope-intercept',    code: 'C1.1', title: 'Slope\u2013Intercept Form',        description: 'Match a target line by adjusting slope (m) and y-intercept (b).',                  bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: {} } },
      { id: 'node-y-intercept',        code: 'C1.2', title: 'Y-Intercept Only',                description: 'The slope is fixed \u2014 dial in just the y-intercept.',                          bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: { fixedSlope: 1 } } },
      { id: 'node-slope-only',         code: 'C1.3', title: 'Slope Through Origin',            description: 'Y-intercept is 0 \u2014 focus on getting the slope right.',                        bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: { fixedIntercept: 0 } } },
      { id: 'node-negative-slopes',    code: 'C2.1', title: 'Negative Slopes',                 description: 'Lines that fall from left to right.',                                              bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: { mSet: [-4,-3,-2.5,-2,-1.5,-1,-0.5] } } },
      { id: 'node-steep-slopes',       code: 'C2.2', title: 'Steep Slopes',                    description: 'Working with large-magnitude slopes.',                                             bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mSet: [-5,-4,-3,3,4,5] } } },
      { id: 'node-fractional-slopes',  code: 'C2.3', title: 'Fractional Slopes',               description: 'Slopes like 1/2, 1/3, 2/3.',                                                       bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.10, config: { mSet: [-1, -0.5, -0.33, 0.33, 0.5, 1] } } },
      { id: 'node-parallel-lines',     code: 'C3.1', title: 'Parallel Lines',                  description: 'Draw a line PARALLEL to the reference line.',                                      bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: { mode: 'parallel', reference: { m: 2, b: -1 } } } },
      { id: 'node-perpendicular',      code: 'C3.2', title: 'Perpendicular Lines',             description: 'Draw a line PERPENDICULAR to the reference line.',                                 bktParams: bktHard, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mode: 'perpendicular', reference: { m: 2, b: 1 } } } },
      { id: 'node-linear-modelling',   code: 'C4.1', title: 'Modelling with Linear Functions', description: 'Match a linear model from a real-world scenario.',                                 bktParams: bktHard, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: {} } },
      { id: 'node-word-problems',      code: 'C4.2', title: 'Rate + Start Value',              description: 'Interpret slope (rate) and y-intercept (start value) in context.',                 bktParams: bktHard, widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: { mSet: [1,2,3,4,5], bSet: [0,5,10,15,20,25,30] } } },
    ],
  },
  {
    id: 'strand-number',
    code: 'MTH1W-B',
    name: 'Number Sense',
    grade: 9,
    region: 'ON',
    description: 'Fractions, rationals, and number-line reasoning.',
    nodes: [
      { id: 'node-frac-halves',        code: 'B1.1', title: 'Fractions with Halves & Quarters', description: 'Shade the bar to represent a fraction with denominator 4.',                       bktParams: bktEasy, widget: { kind: 'FractionBar',      config: { denoms: [4] } } },
      { id: 'node-frac-sixths',        code: 'B1.2', title: 'Fractions in Sixths',              description: 'Shade a bar divided into 6 equal parts.',                                          bktParams: bktEasy, widget: { kind: 'FractionBar',      config: { denoms: [6] } } },
      { id: 'node-frac-eighths',       code: 'B1.3', title: 'Fractions in Eighths',             description: 'Shade a bar divided into 8 equal parts.',                                          bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [8] } } },
      { id: 'node-frac-tenths',        code: 'B1.4', title: 'Fractions in Tenths',              description: 'Decimal-adjacent thinking with tenths.',                                           bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [10] } } },
      { id: 'node-frac-mixed',         code: 'B1.5', title: 'Mixed Denominators',               description: 'Recognize fractions across many denominators.',                                    bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [4,6,8,10,12] } } },
      { id: 'node-numline-integers',   code: 'B2.1', title: 'Number Line: Integers',            description: 'Slide the marker to hit a target integer.',                                        bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: -10, max: 10, step: 1, tolerance: 0.5 } } },
      { id: 'node-numline-halves',     code: 'B2.2', title: 'Number Line: Halves',              description: 'Place the marker at a target ending in .5.',                                       bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: -6,  max: 6,  step: 0.1, tolerance: 0.2 } } },
      { id: 'node-abs-value',          code: 'B2.3', title: 'Absolute Value',                   description: 'Find any x with the given |x|.',                                                   bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: -8,  max: 8,  step: 0.5, tolerance: 0.3, mode: 'absolute' } } },
      { id: 'node-squares',            code: 'B3.1', title: 'Squares (x\u00b2)',                description: 'Find an x whose square hits a target.',                                            bktParams: bktHard, widget: { kind: 'NumberLineMarker', config: { min: -6,  max: 6,  step: 0.1, tolerance: 0.4, mode: 'square' } } },
      { id: 'node-cubes',              code: 'B3.2', title: 'Cubes (x\u00b3)',                  description: 'Find an x whose cube hits a target.',                                              bktParams: bktHard, widget: { kind: 'NumberLineMarker', config: { min: -4,  max: 4,  step: 0.1, tolerance: 0.6, mode: 'cube' } } },
    ],
  },

  // ---- Ontario Grade 8 ----
  {
    id: 'strand-g8-number',
    code: 'MTH8-B',
    name: 'Number (Grade 8)',
    grade: 8,
    region: 'ON',
    description: 'Fractions, integers, powers and rates \u2014 Grade 8 number sense.',
    nodes: [
      { id: 'g8-frac-thirds',       code: 'B1.1', title: 'Fractions in Thirds',            description: 'Shade a bar divided into 3 equal parts.',                       bktParams: bktEasy, widget: { kind: 'FractionBar',      config: { denoms: [3] } } },
      { id: 'g8-frac-fifths',       code: 'B1.2', title: 'Fractions in Fifths',            description: 'Shade a bar divided into 5 equal parts.',                       bktParams: bktEasy, widget: { kind: 'FractionBar',      config: { denoms: [5] } } },
      { id: 'g8-frac-twelfths',     code: 'B1.3', title: 'Fractions in Twelfths',          description: 'Bars with 12 parts \u2014 useful for time and ratios.',         bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [12] } } },
      { id: 'g8-frac-mixed-8',      code: 'B1.4', title: 'Mixed Small Denominators',       description: 'Vary between 3, 4, 5, 6 parts.',                                bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [3,4,5,6] } } },
      { id: 'g8-integer-line',      code: 'B2.1', title: 'Integers on a Number Line',      description: 'Place a marker at a whole-number target between \u00b115.',     bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: -15, max: 15, step: 1, tolerance: 0.5 } } },
      { id: 'g8-integer-wide',      code: 'B2.2', title: 'Wider Integer Range',            description: 'Working across a wider integer number line.',                   bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: -20, max: 20, step: 1, tolerance: 0.5 } } },
      { id: 'g8-abs-8',             code: 'B2.3', title: 'Absolute Value (Grade 8)',       description: 'Place a value that has the given |x|.',                         bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: -10, max: 10, step: 0.5, tolerance: 0.4, mode: 'absolute' } } },
      { id: 'g8-squares-8',         code: 'B3.1', title: 'Perfect Squares',                description: 'Find x with x\u00b2 equal to a perfect square target.',         bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: -8,  max: 8,  step: 0.1, tolerance: 0.3, mode: 'square' } } },
      { id: 'g8-cubes-8',           code: 'B3.2', title: 'Perfect Cubes',                  description: 'Find x with x\u00b3 equal to a perfect cube target.',           bktParams: bktHard, widget: { kind: 'NumberLineMarker', config: { min: -4,  max: 4,  step: 0.1, tolerance: 0.6, mode: 'cube' } } },
      { id: 'g8-half-steps',        code: 'B4.1', title: 'Halves & Half-Steps',            description: 'Precision practice with values ending in .5.',                  bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: -8,  max: 8,  step: 0.5, tolerance: 0.25 } } },
    ],
  },
  {
    id: 'strand-g8-algebra',
    code: 'MTH8-C',
    name: 'Algebra & Patterns (Grade 8)',
    grade: 8,
    region: 'ON',
    description: 'Linear patterns, expressions and beginning algebra \u2014 Grade 8.',
    nodes: [
      { id: 'g8-slope-intro',       code: 'C1.1', title: 'Slope Concept (Intro)',          description: 'Y-intercept fixed at 0 \u2014 focus purely on slope.',          bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { fixedIntercept: 0, mSet: [1, 2, 3, -1, -2, -3] } } },
      { id: 'g8-intercept-intro',   code: 'C1.2', title: 'Y-Intercept (Intro)',            description: 'Slope fixed at 1 \u2014 focus on where the line crosses.',      bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: { fixedSlope: 1, bSet: [-3, -2, -1, 0, 1, 2, 3] } } },
      { id: 'g8-linear-pattern',    code: 'C1.3', title: 'Linear Growing Pattern',         description: 'Match a line for a positive growing pattern.',                  bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mSet: [1, 2, 3], bSet: [0, 1, 2, 3] } } },
      { id: 'g8-linear-shrink',     code: 'C1.4', title: 'Linear Shrinking Pattern',       description: 'Match a line for a shrinking (decreasing) pattern.',            bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mSet: [-1, -2, -3], bSet: [3, 4, 5, 6] } } },
      { id: 'g8-slope-basic',       code: 'C2.1', title: 'Slope Basics',                   description: 'General slopes with the intercept slider live.',                bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: { mSet: [-2, -1, 1, 2], bSet: [-2, -1, 0, 1, 2] } } },
      { id: 'g8-line-match',        code: 'C2.2', title: 'Match a Full Line',              description: 'Both slope and intercept can vary \u2014 general practice.',    bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.15, config: {} } },
      { id: 'g8-frac-slopes',       code: 'C2.3', title: 'Half Slopes',                    description: 'Recognize \u00b1\u00bd slopes on a Cartesian plane.',            bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.10, config: { mSet: [-0.5, 0.5] } } },
      { id: 'g8-model-savings',     code: 'C3.1', title: 'Savings Pattern',                description: 'Model a weekly savings scenario as a line.',                    bktParams: bktHard, widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: { mSet: [1, 2, 3, 4], bSet: [0, 5, 10] } } },
      { id: 'g8-model-cooling',     code: 'C3.2', title: 'Cooling / Draining Model',       description: 'Something starts high and decreases \u2014 model the line.',    bktParams: bktHard, widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: { mSet: [-1, -2, -3], bSet: [4, 5, 6] } } },
      { id: 'g8-mixed-review',      code: 'C4.1', title: 'Mixed Line Review',              description: 'All-in-one review covering slope & intercept sign combos.',    bktParams: bktHard, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: {} } },
    ],
  },
  {
    id: 'strand-g8-data',
    code: 'MTH8-D',
    name: 'Data Literacy (Grade 8)',
    grade: 8,
    region: 'ON',
    description: 'Reading data, probability and proportional reasoning.',
    nodes: [
      { id: 'g8-percent-basic',     code: 'D1.1', title: 'Percents on a Number Line',       description: 'Place a percent value between 0 and 100.',                      bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0,   max: 100, step: 1,   tolerance: 2 } } },
      { id: 'g8-prob-fraction',     code: 'D2.1', title: 'Probability as a Fraction',       description: 'Shade the bar to represent a probability like 3/8.',            bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [4, 5, 6, 8, 10] } } },
      { id: 'g8-prob-decimal',      code: 'D2.2', title: 'Probability as a Decimal',        description: 'Place a probability decimal between 0 and 1.',                  bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: 0,   max: 1,   step: 0.05, tolerance: 0.05 } } },
      { id: 'g8-proportion',        code: 'D3.1', title: 'Proportional Reasoning',          description: 'Model equivalent ratios as fractions of the same bar.',         bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [6, 8, 10, 12] } } },
    ],
  },
  {
    id: 'strand-g8-spatial',
    code: 'MTH8-E',
    name: 'Spatial Sense (Grade 8)',
    grade: 8,
    region: 'ON',
    description: 'Angles, measurement and geometric reasoning.',
    nodes: [
      { id: 'g8-angle-acute',       code: 'E1.1', title: 'Angle Measures (Acute)',          description: 'Place a marker at an acute angle in degrees (0\u201390).',       bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0,   max: 90,  step: 1,   tolerance: 3 } } },
      { id: 'g8-angle-obtuse',      code: 'E1.2', title: 'Angle Measures (Obtuse)',         description: 'Place a marker at an obtuse angle (90\u2013180).',              bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: 90,  max: 180, step: 1,   tolerance: 3 } } },
      { id: 'g8-perpendicular-8',   code: 'E2.1', title: 'Perpendicular Slopes',            description: 'Sketch a line perpendicular to a reference line.',              bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: { mode: 'perpendicular', reference: { m: 1, b: 0 } } } },
      { id: 'g8-parallel-8',        code: 'E2.2', title: 'Parallel Lines (Intro)',          description: 'Sketch a line parallel to a reference line.',                   bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mode: 'parallel', reference: { m: 1, b: 1 } } } },
    ],
  },
  {
    id: 'strand-g8-finance',
    code: 'MTH8-F',
    name: 'Financial Literacy (Grade 8)',
    grade: 8,
    region: 'ON',
    description: 'Percents, budgets and simple interest.',
    nodes: [
      { id: 'g8-discount-percent',  code: 'F1.1', title: 'Discount Percent',                description: 'Place a percent representing a store discount.',                bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0, max: 100, step: 5, tolerance: 3 } } },
      { id: 'g8-tax-percent',       code: 'F1.2', title: 'Tax Percent',                     description: 'Place a common tax rate on the percent line.',                  bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: 0, max: 20,  step: 0.5, tolerance: 0.5 } } },
      { id: 'g8-budget-linear',     code: 'F2.1', title: 'Budget as a Linear Model',        description: 'Model a saving-per-week budget as a line.',                     bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: { mSet: [5, 10, 15, 20], bSet: [0, 20, 40, 60] } } },
    ],
  },
  {
    id: 'strand-g9-data',
    code: 'MTH1W-D',
    name: 'Data (Grade 9)',
    grade: 9,
    region: 'ON',
    description: 'Data visualization and probability modelling.',
    nodes: [
      { id: 'g9-relative-freq',     code: 'D1.1', title: 'Relative Frequency',              description: 'Model a relative frequency as a fraction of a bar.',            bktParams: bktMed,  widget: { kind: 'FractionBar',      config: { denoms: [8, 10, 12, 20] } } },
      { id: 'g9-scatter-slope',     code: 'D2.1', title: 'Trend Lines',                     description: 'Fit a line of best-fit\u2013style linear model.',               bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: {} } },
      { id: 'g9-prob-decimal',      code: 'D3.1', title: 'Probability (Decimal)',           description: 'Place a probability estimate between 0 and 1.',                 bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0, max: 1, step: 0.05, tolerance: 0.05 } } },
      { id: 'g9-prob-percent',      code: 'D3.2', title: 'Probability (Percent)',           description: 'Place a probability as a percent from 0 to 100.',               bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0, max: 100, step: 1, tolerance: 2 } } },
    ],
  },
  {
    id: 'strand-g9-geometry',
    code: 'MTH1W-E',
    name: 'Geometry & Measurement (Grade 9)',
    grade: 9,
    region: 'ON',
    description: 'Angles, perpendicularity and coordinate geometry.',
    nodes: [
      { id: 'g9-angle-acute',       code: 'E1.1', title: 'Acute Angles',                    description: 'Locate an acute angle between 0 and 90 degrees.',               bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0,   max: 90,  step: 1, tolerance: 3 } } },
      { id: 'g9-angle-reflex',      code: 'E1.2', title: 'Reflex Angles',                   description: 'Locate a reflex angle beyond 180 degrees.',                     bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: 180, max: 360, step: 1, tolerance: 5 } } },
      { id: 'g9-perp-lines-9',      code: 'E2.1', title: 'Perpendicular Lines (Coord)',     description: 'Sketch a coordinate-plane line perpendicular to a reference.',  bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mode: 'perpendicular', reference: { m: 3, b: 0 } } } },
      { id: 'g9-parallel-lines-9',  code: 'E2.2', title: 'Parallel Lines (Coord)',          description: 'Sketch a coordinate-plane line parallel to a reference.',       bktParams: bktEasy, widget: { kind: 'LinearGraphMatcher', tolerance: 0.20, config: { mode: 'parallel', reference: { m: -1, b: 2 } } } },
    ],
  },
  {
    id: 'strand-g9-finance',
    code: 'MTH1W-F',
    name: 'Financial Literacy (Grade 9)',
    grade: 9,
    region: 'ON',
    description: 'Budgeting, interest and financial modelling.',
    nodes: [
      { id: 'g9-simple-interest',   code: 'F1.1', title: 'Simple Interest Rate',            description: 'Place a common annual interest rate on the percent line.',      bktParams: bktMed,  widget: { kind: 'NumberLineMarker', config: { min: 0, max: 15,  step: 0.25, tolerance: 0.5 } } },
      { id: 'g9-tax-rate',          code: 'F1.2', title: 'Provincial Tax',                  description: 'Place a common provincial tax rate.',                           bktParams: bktEasy, widget: { kind: 'NumberLineMarker', config: { min: 0, max: 20,  step: 0.25, tolerance: 0.5 } } },
      { id: 'g9-savings-linear',    code: 'F2.1', title: 'Savings Linear Model',            description: 'Model long-term savings as a line.',                            bktParams: bktMed,  widget: { kind: 'LinearGraphMatcher', tolerance: 0.25, config: { mSet: [10, 20, 25, 50], bSet: [0, 50, 100] } } },
    ],
  },
];

async function ensureSeeded(db) {
  const strands = db.collection('strands');
  const nodes = db.collection('nodes');
  const meta = db.collection('meta');
  const versionDoc = await meta.findOne({ key: 'schemaVersion' });
  const currentVer = versionDoc?.value ?? 0;
  const existing = await strands.countDocuments();
  if (existing > 0 && currentVer === SCHEMA_VERSION) return;
  // wipe and reseed
  await strands.deleteMany({});
  await nodes.deleteMany({});
  for (const s of SEED_STRANDS) {
    const { nodes: nodeList, ...strandDoc } = s;
    await strands.insertOne(strandDoc);
    for (const n of nodeList) {
      await nodes.insertOne({ ...n, strandId: s.id });
    }
  }
  await meta.updateOne(
    { key: 'schemaVersion' },
    { $set: { key: 'schemaVersion', value: SCHEMA_VERSION, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function getOrCreateDemoUser(db) {
  const users = db.collection('users');
  let u = await users.findOne({ email: 'demo@eduengine.local' });
  if (!u) {
    u = { id: uuidv4(), email: 'demo@eduengine.local', name: 'Demo Student', role: 'student' };
    await users.insertOne(u);
  }
  return u;
}

// Auto-generated reteach suggestions from class distribution + error patterns
function buildReteachSuggestions({ node, strand, dist, avgP, roster, errorPattern }) {
  const s = [];
  const total = roster.length || 1;
  const strugglingPct = (dist.struggling + dist.developing) / total;
  const isLinear = /Linear|Slope|Parallel|Modelling/i.test(node.title);

  // Whole-class urgency
  if (avgP < 0.35) {
    s.push({
      priority: 'high',
      title: 'Restart with a concrete anchor',
      body: `Class average is ${(avgP*100).toFixed(0)}%. Open a mini-lesson with a real-world anchor (walking speed / phone plan cost) before touching symbols.`,
    });
  } else if (avgP < 0.65) {
    s.push({
      priority: 'medium',
      title: 'Split-group instruction',
      body: `About ${(strugglingPct*100).toFixed(0)}% of the class is still developing. Pull the bottom third for a 10-min guided reteach while the rest tackles practice.`,
    });
  } else {
    s.push({
      priority: 'low',
      title: 'Ready for extension',
      body: `Most students are proficient. Push the top group into a challenge task (multi-step modelling) and use them as peer coaches.`,
    });
  }

  // Concept-specific tips (linear graphs)
  if (isLinear) {
    if (errorPattern.slopeErrs > errorPattern.interceptErrs) {
      s.push({
        priority: 'high',
        title: 'Focus on slope intuition',
        body: `Wrong answers skew toward slope errors (${errorPattern.slopeErrs} vs ${errorPattern.interceptErrs}). Try a rise-over-run motion drill: physically walk grids before adjusting the m slider.`,
      });
    } else if (errorPattern.interceptErrs > errorPattern.slopeErrs) {
      s.push({
        priority: 'high',
        title: 'Reinforce y-intercept meaning',
        body: `Most errors are on the intercept (${errorPattern.interceptErrs} vs ${errorPattern.slopeErrs}). Emphasize “where the line crosses at x=0” with a story-problem frame.`,
      });
    } else {
      s.push({
        priority: 'medium',
        title: 'Two-parameter dance',
        body: `Slope and intercept errors are balanced. Have students lock one slider and vary the other to isolate each parameter\u2019s effect.`,
      });
    }
    s.push({
      priority: 'medium',
      title: 'Warm-up: predict then check',
      body: `Before opening the widget, show a graph and have students predict m and b on paper. Then verify with the sliders \u2014 metacognition boosts retention.`,
    });
  }

  // Struggler outreach
  if (dist.struggling >= 3) {
    const names = roster.filter(r => r.pMastery < 0.3).slice(0, 5).map(r => r.name).join(', ');
    s.push({
      priority: 'high',
      title: 'Priority check-ins',
      body: `${dist.struggling} students are below 30% mastery. Consider 1:1 or small-group check-ins with: ${names}.`,
    });
  }

  // Almost-there nudge
  const almostThere = roster.filter(r => r.pMastery >= 0.8 && r.pMastery < 0.95).length;
  if (almostThere >= 2) {
    s.push({
      priority: 'low',
      title: `${almostThere} students on the mastery edge`,
      body: `They\u2019re between 80\u201395%. A single well-targeted practice round should push them across the threshold.`,
    });
  }

  return s;
}

// Seed a synthetic classroom (~24 students) with varied mastery per node
const FIRST_NAMES = ['Ava','Liam','Noah','Emma','Olivia','Ethan','Mia','Zoe','Kai','Nora','Aria','Leo','Maya','Ivan','Sara','Jade','Owen','Ruby','Finn','Isla','Ari','Theo','Luna','Rex'];
async function seedClassroom(db) {
  const nodes = await db.collection('nodes').find({}).toArray();
  const usersColl = db.collection('users');
  const masteriesColl = db.collection('masteries');

  // profile archetypes with target p per node band
  const archetypes = [
    { skill: 0.2, name: 'struggling' },
    { skill: 0.45, name: 'developing' },
    { skill: 0.7, name: 'proficient' },
    { skill: 0.92, name: 'advanced' },
  ];

  const students = [];
  for (let i = 0; i < FIRST_NAMES.length; i++) {
    const name = FIRST_NAMES[i];
    const arche = archetypes[i % archetypes.length];
    const u = {
      id: uuidv4(),
      email: `${name.toLowerCase()}${i}@class.local`,
      name,
      role: 'student',
    };
    students.push({ ...u, arche });
    await usersColl.insertOne(u);
  }

  const ops = [];
  for (const s of students) {
    for (const n of nodes) {
      // noise around skill; nodes with higher pS/pG feel harder
      const noise = (Math.random() - 0.5) * 0.3;
      let p = Math.min(0.999, Math.max(0.02, s.arche.skill + noise));
      // small chance to be very low (recent intro)
      if (Math.random() < 0.08) p = 0.05 + Math.random() * 0.1;
      ops.push({
        updateOne: {
          filter: { userId: s.id, nodeId: n.id },
          update: {
            $set: { pMastery: p, mastered: p >= 0.95, updatedAt: new Date() },
            $setOnInsert: { id: uuidv4(), userId: s.id, nodeId: n.id },
          },
          upsert: true,
        },
      });
    }
  }
  if (ops.length) await masteriesColl.bulkWrite(ops);
  return students.length;
}

// ---- Routing helpers ----
function parsePath(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return parts;
}

export async function GET(request) {
  try {
    const db = await getDb();
    await ensureSeeded(db);
    const parts = parsePath(request);
    const [root, arg1, arg2] = parts;

    if (!root || root === 'health') {
      return NextResponse.json({ ok: true, service: 'EduEngine' });
    }

    if (root === 'me') {
      const user = await getOrCreateDemoUser(db);
      return NextResponse.json({ user });
    }

    if (root === 'dashboard') {
      const user = await getOrCreateDemoUser(db);
      const strands = await db.collection('strands').find({}).toArray();
      const nodes = await db.collection('nodes').find({}).toArray();
      const masteries = await db.collection('masteries').find({ userId: user.id }).toArray();
      const masteryMap = Object.fromEntries(masteries.map(m => [m.nodeId, m]));
      const result = strands.map(s => ({
        ...s,
        _id: undefined,
        nodes: nodes
          .filter(n => n.strandId === s.id)
          .map(n => {
            const m = masteryMap[n.id];
            return {
              ...n,
              _id: undefined,
              mastery: m ? { pMastery: m.pMastery, mastered: m.mastered } : { pMastery: n.bktParams.pL0, mastered: false },
            };
          }),
      }));
      return NextResponse.json({ user, strands: result });
    }

    if (root === 'nodes' && arg1) {
      const node = await db.collection('nodes').findOne({ id: arg1 });
      if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const strand = await db.collection('strands').findOne({ id: node.strandId });
      const user = await getOrCreateDemoUser(db);
      const m = await db.collection('masteries').findOne({ userId: user.id, nodeId: node.id });
      delete node._id;
      if (strand) delete strand._id;
      return NextResponse.json({
        node,
        strand,
        mastery: m ? { pMastery: m.pMastery, mastered: m.mastered } : { pMastery: node.bktParams.pL0, mastered: false },
      });
    }

    if (root === 'attempts' && arg1) {
      // /api/attempts/:nodeId - history
      const user = await getOrCreateDemoUser(db);
      const items = await db.collection('attempts')
        .find({ userId: user.id, nodeId: arg1 })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      return NextResponse.json({ attempts: items.map(a => ({ ...a, _id: undefined })) });
    }

    if (root === 'practice' && arg1) {
      // /api/practice/:nodeId?count=10&offset=0  -> question set
      const url = new URL(request.url);
      const count = Math.min(50, parseInt(url.searchParams.get('count') || '10', 10));
      const offset = parseInt(url.searchParams.get('offset') || `${Math.floor(Math.random() * 100)}`, 10);
      const node = await db.collection('nodes').findOne({ id: arg1 });
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      const qs = getQuestionsForNode(arg1, count, offset);
      // strip correctIndex + explanation from client
      const client = qs.map(q => ({ id: q.id, prompt: q.prompt, choices: q.choices, nodeId: q.nodeId }));
      return NextResponse.json({
        node: { id: node.id, code: node.code, title: node.title, description: node.description },
        questions: client,
        totalAvailable: 60,
      });
    }

    if (root === 'tests' && !arg1) {
      return NextResponse.json({ tests: TESTS.map(t => ({
        id: t.id, title: t.title, description: t.description,
        totalQuestions: t.totalQuestions, estMinutes: t.estMinutes,
        grade: t.grade || 'mixed',
      })) });
    }

    if (root === 'tests' && arg1) {
      const bundle = getTestQuestions(arg1);
      if (!bundle) return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      const client = bundle.questions.map(q => ({
        id: q.id, prompt: q.prompt, choices: q.choices, nodeId: q.nodeId,
      }));
      return NextResponse.json({
        test: {
          id: bundle.test.id, title: bundle.test.title, description: bundle.test.description,
          estMinutes: bundle.test.estMinutes, totalQuestions: bundle.test.totalQuestions,
        },
        questions: client,
      });
    }

    if (root === 'teacher' && arg1 === 'concept' && arg2) {
      // /api/teacher/concept/:nodeId  -> ranked roster + reteach hints
      const node = await db.collection('nodes').findOne({ id: arg2 });
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      const strand = await db.collection('strands').findOne({ id: node.strandId });
      const students = await db.collection('users').find({ role: 'student' }).toArray();
      const studentIds = students.map(s => s.id);
      const masteries = await db.collection('masteries')
        .find({ userId: { $in: studentIds }, nodeId: arg2 })
        .toArray();
      const mMap = Object.fromEntries(masteries.map(m => [m.userId, m]));

      const roster = students.map(s => {
        const m = mMap[s.id];
        const p = m ? m.pMastery : node.bktParams.pL0;
        return {
          id: s.id,
          name: s.name,
          pMastery: p,
          mastered: p >= 0.95,
        };
      }).sort((a, b) => a.pMastery - b.pMastery); // ascending -> strugglers first

      const dist = { struggling: 0, developing: 0, proficient: 0, mastered: 0 };
      let sum = 0;
      for (const r of roster) {
        sum += r.pMastery;
        if (r.pMastery >= 0.95) dist.mastered++;
        else if (r.pMastery >= 0.7) dist.proficient++;
        else if (r.pMastery >= 0.3) dist.developing++;
        else dist.struggling++;
      }
      const avgP = roster.length ? sum / roster.length : 0;

      // recent attempt error patterns for this node
      const attempts = await db.collection('attempts')
        .find({ nodeId: arg2, userId: { $in: studentIds } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      let slopeErrs = 0, interceptErrs = 0, wrongCount = 0;
      for (const a of attempts) {
        if (a.correct) continue;
        wrongCount++;
        const d = a.dataJson || {};
        if (Math.abs(d.dm ?? 0) > Math.abs(d.db ?? 0)) slopeErrs++;
        else interceptErrs++;
      }

      // Auto-generated reteach suggestions based on class shape
      const suggestions = buildReteachSuggestions({
        node, strand, dist, avgP, roster,
        errorPattern: { slopeErrs, interceptErrs, wrongCount },
      });

      // Bottom 5 strugglers / top 5 leaders
      const strugglers = roster.slice(0, Math.min(5, roster.length));
      const leaders = [...roster].reverse().slice(0, Math.min(5, roster.length));

      return NextResponse.json({
        node: { id: node.id, code: node.code, title: node.title, description: node.description, bktParams: node.bktParams, widget: node.widget || null },
        strand: strand ? { id: strand.id, code: strand.code, name: strand.name } : null,
        avgP,
        distribution: dist,
        totalStudents: roster.length,
        roster,
        strugglers,
        leaders,
        suggestions,
        errorPattern: { slopeErrs, interceptErrs, wrongCount },
      });
    }

    if (root === 'teacher' && arg1 === 'analytics') {
      // Ensure we have a classroom to analyze
      const usersColl = db.collection('users');
      const studentsCount = await usersColl.countDocuments({ role: 'student' });
      if (studentsCount === 0) {
        await seedClassroom(db);
      }

      const students = await usersColl.find({ role: 'student' }).toArray();
      const strands = await db.collection('strands').find({}).toArray();
      const nodes = await db.collection('nodes').find({}).toArray();
      const studentIds = students.map(s => s.id);
      const masteries = await db.collection('masteries').find({ userId: { $in: studentIds } }).toArray();

      // build matrix: studentId -> nodeId -> pMastery
      const matrix = {};
      for (const s of students) matrix[s.id] = {};
      for (const m of masteries) {
        if (matrix[m.userId]) matrix[m.userId][m.nodeId] = { pMastery: m.pMastery, mastered: m.mastered };
      }

      // per-node distribution buckets
      const buckets = ['struggling', 'developing', 'proficient', 'mastered']; // <0.3, 0.3-0.7, 0.7-0.95, >=0.95
      const nodeStats = nodes.map(n => {
        const dist = { struggling: 0, developing: 0, proficient: 0, mastered: 0 };
        let sum = 0; let count = 0;
        for (const s of students) {
          const cell = matrix[s.id][n.id];
          const p = cell ? cell.pMastery : n.bktParams.pL0;
          sum += p; count += 1;
          if (p >= 0.95) dist.mastered += 1;
          else if (p >= 0.7) dist.proficient += 1;
          else if (p >= 0.3) dist.developing += 1;
          else dist.struggling += 1;
        }
        return {
          nodeId: n.id,
          code: n.code,
          title: n.title,
          strandId: n.strandId,
          avgP: count ? sum / count : 0,
          distribution: dist,
          total: count,
        };
      });

      // strand rollups
      const strandStats = strands.map(s => {
        const ns = nodeStats.filter(x => x.strandId === s.id);
        const avg = ns.length ? ns.reduce((a, x) => a + x.avgP, 0) / ns.length : 0;
        return { id: s.id, code: s.code, name: s.name, avgP: avg, nodeCount: ns.length };
      });

      return NextResponse.json({
        students: students.map(s => ({ id: s.id, name: s.name })),
        nodes: nodes.map(n => ({ id: n.id, code: n.code, title: n.title, strandId: n.strandId })),
        strands: strands.map(s => ({ id: s.id, code: s.code, name: s.name })),
        matrix,
        nodeStats,
        strandStats,
      });
    }

    return NextResponse.json({ error: 'Unknown route' }, { status: 404 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = await getDb();
    await ensureSeeded(db);
    const parts = parsePath(request);
    const [root, arg1, arg2] = parts;
    const body = await request.json().catch(() => ({}));

    if (root === 'seed') {
      // force reseed
      await db.collection('strands').deleteMany({});
      await db.collection('nodes').deleteMany({});
      for (const s of SEED_STRANDS) {
        const { nodes: nodeList, ...strandDoc } = s;
        await db.collection('strands').insertOne(strandDoc);
        for (const n of nodeList) {
          await db.collection('nodes').insertOne({ ...n, strandId: s.id });
        }
      }
      return NextResponse.json({ ok: true, reseeded: true });
    }

    if (root === 'practice' && arg1 && parts[2] === 'submit') {
      // POST /api/practice/:nodeId/submit  { answers: { qid: choiceIndex } }
      const user = await getOrCreateDemoUser(db);
      const node = await db.collection('nodes').findOne({ id: arg1 });
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      const { answers = {}, seedOffset = 0, count = 10 } = body || {};

      // Regenerate the same question set to get correctIndex authoritatively
      const qs = getQuestionsForNode(arg1, count, seedOffset);

      const masteries = db.collection('masteries');
      let mDoc = await masteries.findOne({ userId: user.id, nodeId: arg1 });
      let p = mDoc ? mDoc.pMastery : (node.bktParams.pL0 ?? 0.1);
      const prevP = p;

      const perQuestion = [];
      let correctCount = 0;
      for (const q of qs) {
        const chosen = answers[q.id];
        const isCorrect = typeof chosen === 'number' && chosen === q.correctIndex;
        if (isCorrect) correctCount++;
        p = bktUpdate(p, isCorrect, node.bktParams);
        perQuestion.push({
          id: q.id,
          correct: isCorrect,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        });
        await db.collection('attempts').insertOne({
          id: uuidv4(),
          userId: user.id,
          nodeId: arg1,
          correct: isCorrect,
          dataJson: { source: 'practice-set', qid: q.id, chosen, correctIndex: q.correctIndex },
          createdAt: new Date(),
        });
      }
      const mastered = p >= DEFAULT_MASTERY_THRESHOLD;
      await masteries.updateOne(
        { userId: user.id, nodeId: arg1 },
        {
          $set: { pMastery: p, mastered, updatedAt: new Date() },
          $setOnInsert: { id: uuidv4(), userId: user.id, nodeId: arg1 },
        },
        { upsert: true }
      );
      return NextResponse.json({
        score: correctCount,
        total: qs.length,
        percent: qs.length ? correctCount / qs.length : 0,
        mastery: { previousP: prevP, pMastery: p, mastered },
        perQuestion,
      });
    }

    if (root === 'tests' && arg1 && parts[2] === 'submit') {
      // POST /api/tests/:testId/submit { answers: { qid: choiceIndex } }
      const user = await getOrCreateDemoUser(db);
      const bundle = getTestQuestions(arg1);
      if (!bundle) return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      const { answers = {} } = body || {};

      // Group by node
      const byNode = {};
      for (const q of bundle.questions) {
        if (!byNode[q.nodeId]) byNode[q.nodeId] = [];
        byNode[q.nodeId].push(q);
      }

      const masteries = db.collection('masteries');
      const nodesColl = db.collection('nodes');
      const perNode = [];
      let totalCorrect = 0;
      const perQuestion = [];

      for (const [nodeId, qs] of Object.entries(byNode)) {
        const node = await nodesColl.findOne({ id: nodeId });
        if (!node) continue;
        let mDoc = await masteries.findOne({ userId: user.id, nodeId });
        let p = mDoc ? mDoc.pMastery : (node.bktParams.pL0 ?? 0.1);
        const prevP = p;
        let nodeCorrect = 0;
        for (const q of qs) {
          const chosen = answers[q.id];
          const isCorrect = typeof chosen === 'number' && chosen === q.correctIndex;
          if (isCorrect) { nodeCorrect++; totalCorrect++; }
          p = bktUpdate(p, isCorrect, node.bktParams);
          perQuestion.push({
            id: q.id, nodeId, correct: isCorrect,
            correctIndex: q.correctIndex, explanation: q.explanation,
          });
          await db.collection('attempts').insertOne({
            id: uuidv4(), userId: user.id, nodeId,
            correct: isCorrect,
            dataJson: { source: 'test', testId: arg1, qid: q.id, chosen, correctIndex: q.correctIndex },
            createdAt: new Date(),
          });
        }
        const mastered = p >= DEFAULT_MASTERY_THRESHOLD;
        await masteries.updateOne(
          { userId: user.id, nodeId },
          { $set: { pMastery: p, mastered, updatedAt: new Date() },
            $setOnInsert: { id: uuidv4(), userId: user.id, nodeId } },
          { upsert: true }
        );
        perNode.push({
          nodeId, code: node.code, title: node.title,
          correct: nodeCorrect, total: qs.length,
          previousP: prevP, pMastery: p, mastered,
        });
      }

      return NextResponse.json({
        testId: arg1,
        score: totalCorrect,
        total: bundle.questions.length,
        percent: bundle.questions.length ? totalCorrect / bundle.questions.length : 0,
        perNode,
        perQuestion,
      });
    }

    if (root === 'teacher' && (body?.action === 'seedClassroom' || parts[1] === 'seed-classroom')) {
      // wipe synthetic students & their masteries, then reseed
      const students = await db.collection('users').find({ role: 'student' }).toArray();
      const ids = students.map(s => s.id);
      await db.collection('users').deleteMany({ role: 'student' });
      await db.collection('masteries').deleteMany({ userId: { $in: ids } });
      const count = await seedClassroom(db);
      return NextResponse.json({ ok: true, students: count });
    }

    if (root === 'attempts') {
      const { nodeId, correct, dataJson } = body || {};
      if (!nodeId || typeof correct !== 'boolean') {
        return NextResponse.json({ error: 'nodeId and correct required' }, { status: 400 });
      }
      const user = await getOrCreateDemoUser(db);
      const node = await db.collection('nodes').findOne({ id: nodeId });
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });

      // Load current mastery
      const masteries = db.collection('masteries');
      let mastery = await masteries.findOne({ userId: user.id, nodeId });
      const currentP = mastery ? mastery.pMastery : (node.bktParams.pL0 ?? 0.1);

      const newP = bktUpdate(currentP, correct, node.bktParams);
      const nowMastered = newP >= DEFAULT_MASTERY_THRESHOLD;

      await masteries.updateOne(
        { userId: user.id, nodeId },
        {
          $set: {
            pMastery: newP,
            mastered: nowMastered,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            id: uuidv4(),
            userId: user.id,
            nodeId,
          },
        },
        { upsert: true }
      );

      const attempt = {
        id: uuidv4(),
        userId: user.id,
        nodeId,
        correct,
        dataJson: dataJson || null,
        createdAt: new Date(),
      };
      await db.collection('attempts').insertOne(attempt);

      return NextResponse.json({
        attempt: { ...attempt },
        mastery: { pMastery: newP, mastered: nowMastered, previousP: currentP },
      });
    }

    return NextResponse.json({ error: 'Unknown route' }, { status: 404 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
