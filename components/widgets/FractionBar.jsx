'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';

function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
function simplify(n, d) { const g = gcd(n, d); return [n / g, d / g]; }

// FractionBar: user clicks segments to shade N/D representation of a target fraction.
export default function FractionBar({ node, onSubmit }) {
  const cfg = node?.widget?.config || {};
  const denoms = cfg.denoms || [4, 6, 8, 10, 12];

  const genTarget = () => {
    const d = denoms[Math.floor(Math.random() * denoms.length)];
    const n = 1 + Math.floor(Math.random() * (d - 1));
    return { n, d };
  };

  const [target, setTarget] = useState(() => genTarget());
  const [shaded, setShaded] = useState(new Set());
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const segments = target.d;
  const [tn, td] = simplify(target.n, target.d);
  const shownFrac = tn === td ? '1' : `${tn}/${td}`;

  const toggle = (i) => {
    if (busy) return;
    const next = new Set(shaded);
    if (next.has(i)) next.delete(i); else next.add(i);
    setShaded(next);
  };

  const check = async () => {
    if (busy) return;
    setBusy(true);
    const correct = shaded.size === target.n;
    setFeedback({ correct, expected: target.n, got: shaded.size });
    try {
      await onSubmit(correct, { widget: 'FractionBar', target, shadedCount: shaded.size });
    } finally { setBusy(false); }
  };

  const nextRound = () => {
    setTarget(genTarget());
    setShaded(new Set());
    setFeedback(null);
  };

  const barWidth = 720;
  const barHeight = 100;
  const segW = barWidth / segments;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Shade the bar to represent <span className="font-mono ml-1">{shownFrac}</span></CardTitle>
        <CardDescription>Click segments to shade. Bar has {segments} equal parts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${barWidth} ${barHeight + 40}`} className="w-full max-w-3xl" preserveAspectRatio="xMidYMid meet">
            {/* Segment cells */}
            {Array.from({ length: segments }).map((_, i) => (
              <g key={i} onClick={() => toggle(i)} className="cursor-pointer">
                <rect
                  x={i * segW}
                  y={20}
                  width={segW - 2}
                  height={barHeight}
                  fill={shaded.has(i) ? '#6366f1' : '#f1f5f9'}
                  stroke={feedback ? (feedback.correct ? '#10b981' : '#f43f5e') : '#94a3b8'}
                  strokeWidth={2}
                  rx={4}
                />
              </g>
            ))}
            {/* Tick labels 0..1 */}
            <text x={0} y={barHeight + 40} fontSize={14} fill="#64748b">0</text>
            <text x={barWidth - 12} y={barHeight + 40} fontSize={14} fill="#64748b" textAnchor="end">1</text>
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Shaded: <span className="font-mono font-semibold text-foreground">{shaded.size}/{segments}</span></div>
          <div className="flex-1" />
          <Button onClick={check} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}</Button>
          <Button variant="outline" onClick={nextRound}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        {feedback && (
          <div className={`rounded-md p-3 text-sm border ${feedback.correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            <div className="flex items-center gap-2 font-medium">
              {feedback.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {feedback.correct ? `Correct! ${feedback.got}/${segments} shaded.` : `Not quite — you shaded ${feedback.got}/${segments}. Target was ${feedback.expected}/${segments}.`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
