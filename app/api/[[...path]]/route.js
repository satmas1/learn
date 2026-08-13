import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { bktUpdate, DEFAULT_MASTERY_THRESHOLD } from '@/lib/bkt';
import { v4 as uuidv4 } from 'uuid';

// ---- Seed data (Ontario Grade 9 Math aligned examples) ----
const SEED_STRANDS = [
  {
    id: 'strand-algebra',
    code: 'MTH1W-C',
    name: 'Algebra & Linear Relations',
    grade: 9,
    region: 'ON',
    description: 'Linear equations, slope, intercepts, and modelling.',
    nodes: [
      {
        id: 'node-slope-intercept',
        code: 'C3.1',
        title: 'Slope–Intercept Form',
        description: 'Match a target line by adjusting slope (m) and y-intercept (b).',
        bktParams: { pL0: 0.10, pT: 0.15, pG: 0.20, pS: 0.10 },
        widget: { kind: 'LinearGraphMatcher', tolerance: 0.15 },
      },
      {
        id: 'node-parallel-lines',
        code: 'C3.2',
        title: 'Parallel & Perpendicular Lines',
        description: 'Identify slope relationships between lines.',
        bktParams: { pL0: 0.10, pT: 0.12, pG: 0.25, pS: 0.10 },
        widget: { kind: 'LinearGraphMatcher', tolerance: 0.15 },
      },
      {
        id: 'node-linear-modelling',
        code: 'C4.1',
        title: 'Modelling with Linear Functions',
        description: 'Fit a line to a real-world scenario.',
        bktParams: { pL0: 0.08, pT: 0.14, pG: 0.18, pS: 0.12 },
        widget: { kind: 'LinearGraphMatcher', tolerance: 0.20 },
      },
    ],
  },
  {
    id: 'strand-number',
    code: 'MTH1W-B',
    name: 'Number Sense',
    grade: 9,
    region: 'ON',
    description: 'Operations with rational numbers and exponents.',
    nodes: [
      {
        id: 'node-rational-ops',
        code: 'B2.1',
        title: 'Rational Number Operations',
        description: 'Practice adding, subtracting, multiplying rationals.',
        bktParams: { pL0: 0.15, pT: 0.15, pG: 0.20, pS: 0.10 },
        widget: null,
      },
    ],
  },
];

async function ensureSeeded(db) {
  const strands = db.collection('strands');
  const nodes = db.collection('nodes');
  const existing = await strands.countDocuments();
  if (existing > 0) return;
  for (const s of SEED_STRANDS) {
    const { nodes: nodeList, ...strandDoc } = s;
    await strands.insertOne(strandDoc);
    for (const n of nodeList) {
      await nodes.insertOne({ ...n, strandId: s.id });
    }
  }
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
    const [root] = parts;
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
