'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';

// NumberLineMarker: slide a marker onto a target real number within a tolerance.
export default function NumberLineMarker({ node, onSubmit }) {
  const cfg = node?.widget?.config || {};
  const min = cfg.min ?? -10;
  const max = cfg.max ?? 10;
  const step = cfg.step ?? 0.1;
  const tolerance = cfg.tolerance ?? 0.2;
  const mode = cfg.mode || 'value'; // 'value' | 'absolute' | 'square' | 'cube'

  const genTarget = () => {
    // choose a nice-ish target
    const candidates = [];
    for (let x = min; x <= max; x += 0.5) candidates.push(Math.round(x * 2) / 2);
    let target = candidates[Math.floor(Math.random() * candidates.length)];
    if (mode === 'absolute') target = Math.abs(target); // display |x|
    return target;
  };

  const [target, setTarget] = useState(() => genTarget());
  const [value, setValue] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const label = useMemo(() => {
    if (mode === 'absolute') return `|x| = ${Math.abs(target)}, place x at a value with that absolute value`;
    if (mode === 'square') return `Place a value x where x² = ${target * target}`;
    if (mode === 'cube') return `Place a value x where x³ = ${(target ** 3).toFixed(2)}`;
    return `Place the marker at ${target}`;
  }, [target, mode]);

  const acceptable = (v) => {
    if (mode === 'absolute') return Math.abs(Math.abs(v) - Math.abs(target)) <= tolerance;
    if (mode === 'square') return Math.abs(v * v - target * target) <= tolerance * 2;
    if (mode === 'cube') return Math.abs(v ** 3 - target ** 3) <= tolerance * 4;
    return Math.abs(v - target) <= tolerance;
  };

  const check = async () => {
    if (busy) return;
    setBusy(true);
    const correct = acceptable(value);
    setFeedback({ correct, target, value });
    try {
      await onSubmit(correct, { widget: 'NumberLineMarker', target, value, mode, tolerance });
    } finally { setBusy(false); }
  };

  const nextRound = () => {
    setTarget(genTarget());
    setValue(0);
    setFeedback(null);
  };

  // Render number line SVG
  const width = 720;
  const height = 80;
  const pad = 24;
  const xToPx = (x) => pad + ((x - min) / (max - min)) * (width - 2 * pad);
  const ticks = [];
  for (let t = min; t <= max; t++) ticks.push(t);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>Slide the marker. Tolerance ±{tolerance}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-3xl" preserveAspectRatio="xMidYMid meet">
            <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="#94a3b8" strokeWidth={2} />
            {ticks.map(t => (
              <g key={t}>
                <line x1={xToPx(t)} y1={height / 2 - 6} x2={xToPx(t)} y2={height / 2 + 6} stroke="#94a3b8" />
                <text x={xToPx(t)} y={height / 2 + 22} fontSize={12} textAnchor="middle" fill="#64748b">{t}</text>
              </g>
            ))}
            {/* Marker */}
            <g transform={`translate(${xToPx(value)}, ${height / 2})`}>
              <polygon points="0,-20 -10,-4 10,-4" fill={feedback ? (feedback.correct ? '#10b981' : '#f43f5e') : '#6366f1'} />
              <circle r={5} fill={feedback ? (feedback.correct ? '#10b981' : '#f43f5e') : '#6366f1'} />
            </g>
          </svg>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-2"><span>Marker</span><span className="font-mono tabular-nums">{value.toFixed(2)}</span></div>
          <Slider min={min} max={max} step={step} value={[value]} onValueChange={v => setValue(v[0])} />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={check} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}</Button>
          <Button variant="outline" onClick={nextRound}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {feedback && (
          <div className={`rounded-md p-3 text-sm border ${feedback.correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            <div className="flex items-center gap-2 font-medium">
              {feedback.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {feedback.correct ? 'On target!' : `Not within tolerance (${tolerance}).`}
            </div>
            <div className="mt-1 text-xs opacity-80">Target: {target} · Your value: {value.toFixed(2)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
