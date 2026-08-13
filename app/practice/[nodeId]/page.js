'use client';
import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw, Sparkles, Trophy, Loader2, ClipboardList, LineChart } from 'lucide-react';
import { toast } from 'sonner';

const QuizMode = dynamic(() => import('@/components/QuizMode'), { ssr: false });

const GraphView = dynamic(() => import('@/components/GraphView'), { ssr: false, loading: () => (
  <div className="h-[420px] flex items-center justify-center bg-muted/30 rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div>
)});

function genTarget() {
  const ms = [-3, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3];
  const bs = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  return {
    m: ms[Math.floor(Math.random() * ms.length)],
    b: bs[Math.floor(Math.random() * bs.length)],
  };
}

function PracticePage({ params }) {
  const { nodeId } = use(params);
  const [node, setNode] = useState(null);
  const [mastery, setMastery] = useState(null);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState({ m: 1, b: 0 });
  const [guess, setGuess] = useState({ m: 0, b: 0 });
  const [feedback, setFeedback] = useState(null); // { correct, dm, db }
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/nodes/${nodeId}`, { cache: 'no-store' });
    const json = await res.json();
    setNode(json.node);
    setMastery(json.mastery);
    setTarget(genTarget());
    setGuess({ m: 0, b: 0 });
    setFeedback(null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [nodeId]);

  const tolerance = node?.widget?.tolerance ?? 0.15;

  const dm = guess.m - target.m;
  const db = guess.b - target.b;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const correct = Math.abs(dm) <= tolerance && Math.abs(db) <= tolerance;
    setFeedback({ correct, dm, db });
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          correct,
          dataJson: { target, guess, dm, db, tolerance },
        }),
      });
      const json = await res.json();
      if (json.mastery) {
        setMastery(json.mastery);
        const prev = json.mastery.previousP;
        const cur = json.mastery.pMastery;
        const delta = ((cur - prev) * 100).toFixed(1);
        toast(correct ? 'Correct!' : 'Not quite', {
          description: `p(L): ${(prev*100).toFixed(1)}% → ${(cur*100).toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta}%)`,
          icon: correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />,
        });
        if (json.mastery.mastered && !mastery?.mastered) {
          setTimeout(() => toast.success('Concept Mastered!', { description: 'p(L) ≥ 0.95 — well done.', icon: <Trophy className="h-4 w-4" /> }), 400);
        }
      }
      setAttempts(a => a + 1);
    } catch (e) {
      toast.error('Could not submit attempt');
    } finally {
      setSubmitting(false);
    }
  };

  const nextRound = () => {
    setTarget(genTarget());
    setGuess({ m: 0, b: 0 });
    setFeedback(null);
  };

  if (loading || !node) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pct = Math.round((mastery?.pMastery || 0) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{node.code}</Badge>
            {mastery?.mastered && <Badge className="bg-emerald-500"><Trophy className="h-3 w-3 mr-1" />Mastered</Badge>}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            {node.title}
          </h1>
          <p className="text-muted-foreground mt-1">{node.description}</p>
        </div>

        <Tabs defaultValue="widget" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="widget" className="gap-1.5"><LineChart className="h-4 w-4" /> Interactive Graph</TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1.5"><ClipboardList className="h-4 w-4" /> Quick Quiz</TabsTrigger>
          </TabsList>

          <TabsContent value="widget">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Graph */}
              <Card className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Match the target line</CardTitle>
                  <CardDescription>
                    Target (dashed blue): <span className="font-mono">y = {target.m}x {target.b >= 0 ? '+' : '-'} {Math.abs(target.b)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GraphView target={target} guess={guess} showFeedback={!!feedback} correct={feedback?.correct} />
                </CardContent>
              </Card>

              {/* Controls */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Line</CardTitle>
                <CardDescription>
                  <span className="font-mono">y = {guess.m.toFixed(2)}x {guess.b >= 0 ? '+' : '-'} {Math.abs(guess.b).toFixed(2)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span>Slope (m)</span>
                    <span className="font-mono tabular-nums">{guess.m.toFixed(2)}</span>
                  </div>
                  <Slider min={-5} max={5} step={0.05} value={[guess.m]} onValueChange={v => setGuess(g => ({ ...g, m: v[0] }))} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span>Y-Intercept (b)</span>
                    <span className="font-mono tabular-nums">{guess.b.toFixed(2)}</span>
                  </div>
                  <Slider min={-6} max={6} step={0.1} value={[guess.b]} onValueChange={v => setGuess(g => ({ ...g, b: v[0] }))} />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={submit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check answer'}
                  </Button>
                  <Button variant="outline" onClick={nextRound} title="New target line">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {feedback && (
                  <div className={`rounded-md p-3 text-sm border ${feedback.correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                    <div className="flex items-center gap-2 font-medium">
                      {feedback.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {feedback.correct ? 'Nice match!' : 'Close, but not within tolerance.'}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      Δm = {feedback.dm.toFixed(2)} · Δb = {feedback.db.toFixed(2)} · tol ±{tolerance}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-500" /> Mastery Estimate</CardTitle>
                <CardDescription>Updated by Bayesian Knowledge Tracing after each attempt.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">p(L)</span>
                  <span className="font-bold tabular-nums">{pct}%</span>
                </div>
                <Progress value={pct} className="h-3" />
                <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Threshold: 95%</span>
                  <span>Attempts this session: {attempts}</span>
                </div>
              </CardContent>
            </Card>
          </div>
            </div>
          </TabsContent>

          <TabsContent value="quiz">
            <QuizMode nodeId={nodeId} onMasteryUpdate={(m) => setMastery(m)} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default PracticePage;
