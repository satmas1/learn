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
    u = { id: uuidv4(), email: 'demo@eduengine.local', name: 'Demo Student' };
    await users.insertOne(u);
  }
  return u;
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
