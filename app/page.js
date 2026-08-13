'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, GraduationCap, Trophy, BookOpen, ArrowRight, Loader2 } from 'lucide-react';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/dashboard', { cache: 'no-store' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const strands = data?.strands || [];
  const allNodes = strands.flatMap(s => s.nodes);
  const totalNodes = allNodes.length;
  const masteredCount = allNodes.filter(n => n.mastery?.mastered).length;
  const avgMastery = totalNodes ? (allNodes.reduce((a, n) => a + (n.mastery?.pMastery || 0), 0) / totalNodes) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-lg leading-none">EduEngine</div>
              <div className="text-[11px] text-muted-foreground">Adaptive Mastery · BKT</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tests">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> Tests
              </Button>
            </Link>
            <Link href="/teacher">
              <Button size="sm" variant="outline" className="gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Teacher View
              </Button>
            </Link>
            <Badge variant="secondary" className="gap-1"><GraduationCap className="h-3 w-3" /> {data?.user?.name || 'Student'}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        {/* Hero stats */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your Mastery Journey</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Every answer you give updates a Bayesian estimate of what you truly know. Practice interactively and watch your mastery grow in real time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <StatCard icon={<BookOpen className="h-5 w-5" />} label="Concepts" value={totalNodes} tint="from-blue-500 to-cyan-500" />
            <StatCard icon={<Trophy className="h-5 w-5" />} label="Mastered" value={`${masteredCount} / ${totalNodes}`} tint="from-amber-500 to-orange-500" />
            <StatCard icon={<Sparkles className="h-5 w-5" />} label="Avg. p(L)" value={`${(avgMastery * 100).toFixed(1)}%`} tint="from-fuchsia-500 to-pink-500" />
          </div>
        </div>

        {/* Strands */}
        <div className="space-y-10">
          {strands.map(strand => (
            <section key={strand.id}>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{strand.name}</h2>
                  <p className="text-sm text-muted-foreground">{strand.description}</p>
                </div>
                <Badge variant="outline">{strand.code} · Grade {strand.grade}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {strand.nodes.map(node => (
                  <NodeCard key={node.id} node={node} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          EduEngine · Bayesian Knowledge Tracing · Real-time adaptive learning
        </footer>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, tint }) {
  return (
    <Card className="overflow-hidden relative">
      <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${tint}`} />
      <CardContent className="p-5 relative">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${tint} text-white flex items-center justify-center shadow`}>
            {icon}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NodeCard({ node }) {
  const p = node.mastery?.pMastery ?? node.bktParams?.pL0 ?? 0.1;
  const pct = Math.round(p * 100);
  const mastered = node.mastery?.mastered;
  const hasWidget = !!node.widget;
  return (
    <Card className={`transition hover:shadow-lg hover:-translate-y-0.5 ${mastered ? 'ring-2 ring-emerald-400/60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono text-muted-foreground">{node.code}</div>
            <CardTitle className="text-base leading-snug">{node.title}</CardTitle>
          </div>
          {mastered && <Badge className="bg-emerald-500 hover:bg-emerald-500"><Trophy className="h-3 w-3 mr-1" />Mastered</Badge>}
        </div>
        <CardDescription className="line-clamp-2">{node.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Mastery p(L)</span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="mt-4">
          {hasWidget ? (
            <Link href={`/practice/${node.id}`}>
              <Button className="w-full group" size="sm">
                Practice <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" className="w-full" disabled>Coming soon</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default Dashboard;
