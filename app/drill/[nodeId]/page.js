'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Flame, Target, Trophy, Loader2, Sparkles } from 'lucide-react';

const QuizMode = dynamic(() => import('@/components/QuizMode'), { ssr: false, loading: () => (
  <div className="h-64 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
)});

export default function DrillPage({ params }) {
  const { nodeId } = use(params);
  const [meta, setMeta] = useState(null);
  const [mastery, setMastery] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/nodes/${nodeId}`, { cache: 'no-store' });
      const json = await res.json();
      setMeta(json);
    })();
  }, [nodeId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <Badge className="bg-amber-500 hover:bg-amber-500 gap-1"><Flame className="h-3 w-3" /> Weak concept drill</Badge>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        <Card className="overflow-hidden relative border-amber-200">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
          <CardHeader className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shadow">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {meta?.node?.title || 'Focused Drill'}
                </CardTitle>
                <CardDescription>
                  {meta?.node?.description}
                </CardDescription>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Current mastery</div>
                <div className="text-2xl font-bold tabular-nums">
                  {mastery
                    ? `${(mastery.pMastery * 100).toFixed(1)}%`
                    : meta?.mastery
                      ? `${(meta.mastery.pMastery * 100).toFixed(1)}%`
                      : '—'}
                </div>
                {mastery && (
                  <div className="text-[11px] text-muted-foreground">
                    was {(mastery.previousP * 100).toFixed(1)}% <ArrowRight className="inline h-3 w-3" /> {(mastery.pMastery * 100).toFixed(1)}%
                    {mastery.mastered && <Badge className="ml-1 bg-emerald-500"><Trophy className="h-3 w-3 mr-1" /> Mastered</Badge>}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <QuizMode nodeId={nodeId} count={5} onMasteryUpdate={setMastery} />
      </main>
    </div>
  );
}
