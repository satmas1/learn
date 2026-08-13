'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Sparkles, Trophy, Loader2, ClipboardList, LineChart } from 'lucide-react';
import { toast } from 'sonner';

const WidgetRouter = dynamic(() => import('@/components/WidgetRouter'), { ssr: false });
const QuizMode = dynamic(() => import('@/components/QuizMode'), { ssr: false });

function PracticePage({ params }) {
  const { nodeId } = use(params);
  const [node, setNode] = useState(null);
  const [mastery, setMastery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/nodes/${nodeId}`, { cache: 'no-store' });
    const json = await res.json();
    setNode(json.node);
    setMastery(json.mastery);
    setLoading(false);
  };

  useEffect(() => { load(); }, [nodeId]);

  const handleAttempt = async (correct, dataJson) => {
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, correct, dataJson }),
      });
      const json = await res.json();
      if (json.mastery) {
        const prev = json.mastery.previousP;
        const cur = json.mastery.pMastery;
        const wasMastered = mastery?.mastered;
        setMastery(json.mastery);
        const delta = ((cur - prev) * 100).toFixed(1);
        toast(correct ? 'Correct!' : 'Not quite', {
          description: `p(L): ${(prev*100).toFixed(1)}% → ${(cur*100).toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta}%)`,
        });
        if (json.mastery.mastered && !wasMastered) {
          setTimeout(() => toast.success('Concept Mastered!', { description: 'p(L) ≥ 0.95 — well done.', icon: <Trophy className="h-4 w-4" /> }), 400);
        }
      }
      setAttempts(a => a + 1);
    } catch (e) {
      toast.error('Could not submit attempt');
    }
  };

  if (loading || !node) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const pct = Math.round((mastery?.pMastery || 0) * 100);
  const hasWidget = !!node?.widget?.kind;

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

        <Tabs defaultValue={hasWidget ? 'widget' : 'quiz'} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="widget" className="gap-1.5" disabled={!hasWidget}>
              <LineChart className="h-4 w-4" /> Interactive
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Quick Quiz
            </TabsTrigger>
          </TabsList>

          <TabsContent value="widget">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <WidgetRouter node={node} onSubmit={handleAttempt} />
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-500" /> Mastery</CardTitle>
                  <CardDescription>Updated by Bayesian Knowledge Tracing.</CardDescription>
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
