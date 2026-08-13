'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';

const GraphView = dynamic(() => import('@/components/GraphView'), { ssr: false, loading: () => (
  <div className="h-[420px] flex items-center justify-center bg-muted/30 rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div>
)});

function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function LinearGraphMatcher({ node, onSubmit }) {
  const cfg = node?.widget?.config || {};
  const mSet = cfg.mSet || [-3, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3];
  const bSet = cfg.bSet || [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  const tolerance = node?.widget?.tolerance ?? cfg.tolerance ?? 0.15;
  const fixedSlope = cfg.fixedSlope; // if set, m slider hidden
  const fixedIntercept = cfg.fixedIntercept; // if set, b slider hidden
  const reference = cfg.reference; // { m, b } shown as reference
  const mode = cfg.mode || 'match'; // 'match' | 'parallel' | 'perpendicular'

  const genTarget = () => {
    if (mode === 'parallel' && reference) {
      return { m: reference.m, b: pickFrom(bSet.filter(b => b !== reference.b)) };
    }
    if (mode === 'perpendicular' && reference) {
      const pm = Math.round((-1 / (reference.m || 1)) * 100) / 100;
      return { m: pm, b: pickFrom(bSet) };
    }
    return {
      m: fixedSlope !== undefined ? fixedSlope : pickFrom(mSet),
      b: fixedIntercept !== undefined ? fixedIntercept : pickFrom(bSet),
    };
  };

  const [target, setTarget] = useState(() => genTarget());
  const [guess, setGuess] = useState({
    m: fixedSlope !== undefined ? fixedSlope : 0,
    b: fixedIntercept !== undefined ? fixedIntercept : 0,
  });
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const dm = guess.m - target.m;
  const db = guess.b - target.b;

  const check = async () => {
    if (busy) return;
    setBusy(true);
    const correct = Math.abs(dm) <= tolerance && Math.abs(db) <= tolerance;
    setFeedback({ correct, dm, db });
    try {
      await onSubmit(correct, { widget: 'LinearGraphMatcher', target, guess, dm, db, tolerance, mode });
    } finally { setBusy(false); }
  };

  const nextRound = () => {
    setTarget(genTarget());
    setGuess({
      m: fixedSlope !== undefined ? fixedSlope : 0,
      b: fixedIntercept !== undefined ? fixedIntercept : 0,
    });
    setFeedback(null);
  };

  const promptLabel =
    mode === 'parallel' ? 'Draw a line PARALLEL to the blue reference' :
    mode === 'perpendicular' ? 'Draw a line PERPENDICULAR to the blue reference' :
    'Match the target line';
  const targetLabel = mode === 'match'
    ? `y = ${target.m}x ${target.b >= 0 ? '+' : '-'} ${Math.abs(target.b)}`
    : reference ? `y = ${reference.m}x ${reference.b >= 0 ? '+' : '-'} ${Math.abs(reference.b)}` : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{promptLabel}</CardTitle>
          <CardDescription>
            {mode === 'match' && <>Target (dashed blue): <span className="font-mono">{targetLabel}</span></>}
            {mode !== 'match' && <>Reference (dashed blue): <span className="font-mono">{targetLabel}</span></>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraphView
            target={mode === 'match' ? target : reference}
            guess={guess}
            showFeedback={!!feedback}
            correct={feedback?.correct}
          />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your Line</CardTitle>
          <CardDescription><span className="font-mono">y = {guess.m.toFixed(2)}x {guess.b >= 0 ? '+' : '-'} {Math.abs(guess.b).toFixed(2)}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {fixedSlope === undefined && (
            <div>
              <div className="flex justify-between text-xs mb-2"><span>Slope (m)</span><span className="font-mono tabular-nums">{guess.m.toFixed(2)}</span></div>
              <Slider min={-5} max={5} step={0.05} value={[guess.m]} onValueChange={v => setGuess(g => ({ ...g, m: v[0] }))} />
            </div>
          )}
          {fixedIntercept === undefined && (
            <div>
              <div className="flex justify-between text-xs mb-2"><span>Y-Intercept (b)</span><span className="font-mono tabular-nums">{guess.b.toFixed(2)}</span></div>
              <Slider min={-6} max={6} step={0.1} value={[guess.b]} onValueChange={v => setGuess(g => ({ ...g, b: v[0] }))} />
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={check} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check answer'}</Button>
            <Button variant="outline" onClick={nextRound}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          {feedback && (
            <div className={`rounded-md p-3 text-sm border ${feedback.correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              <div className="flex items-center gap-2 font-medium">
                {feedback.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {feedback.correct ? 'Nice match!' : 'Close, but not within tolerance.'}
              </div>
              <div className="mt-1 text-xs opacity-80">Δm = {feedback.dm.toFixed(2)} · Δb = {feedback.db.toFixed(2)} · tol ±{tolerance}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
