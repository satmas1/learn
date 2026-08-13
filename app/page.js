'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Sparkles, GraduationCap, Trophy, BookOpen, ArrowRight, Loader2, Target, Flame, Layers } from 'lucide-react';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('all'); // 'all' | '8' | '9'

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('eduengine.gradeFilter');
      if (saved) setGradeFilter(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('eduengine.gradeFilter', gradeFilter); } catch {}
  }, [gradeFilter]);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/dashboard', { cache: 'no-store' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Hooks that must run every render (before any early return)
  const allStrandsRaw = data?.strands || [];
  const gradeCounts = useMemo(() => {
    const c = { all: 0, 8: 0, 9: 0 };
    for (const s of allStrandsRaw) {
      c.all += s.nodes.length;
      c[String(s.grade)] = (c[String(s.grade)] || 0) + s.nodes.length;
    }
    return c;
  }, [allStrandsRaw]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allStrands = allStrandsRaw;
  const strands = gradeFilter === 'all'
    ? allStrands
    : allStrands.filter(s => String(s.grade) === gradeFilter);
  const allNodes = strands.flatMap(s => s.nodes);
  const totalNodes = allNodes.length;
  const masteredCount = allNodes.filter(n => n.mastery?.mastered).length;
  const avgMastery = totalNodes ? (allNodes.reduce((a, n) => a + (n.mastery?.pMastery || 0), 0) / totalNodes) : 0;

  // Weakest not-yet-mastered node within the current filter
  const weakest = (() => {
    const pool = allNodes.filter(n => !n.mastery?.mastered);
    if (!pool.length) return null;
    return pool.reduce((min, n) => (n.mastery?.pMastery ?? 1) < (min.mastery?.pMastery ?? 1) ? n : min, pool[0]);
  })();

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

          {/* Grade filter toggle */}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Grade level
            </span>
            <ToggleGroup
              type="single"
              value={gradeFilter}
              onValueChange={(v) => v && setGradeFilter(v)}
              className="bg-white border rounded-md p-1 shadow-sm"
            >
              <ToggleGroupItem value="all" className="px-3 h-8 data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                All <span className="ml-1.5 text-[10px] opacity-70">{gradeCounts.all}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="8" className="px-3 h-8 data-[state=on]:bg-teal-600 data-[state=on]:text-white">
                Grade 8 <span className="ml-1.5 text-[10px] opacity-70">{gradeCounts['8'] || 0}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="9" className="px-3 h-8 data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                Grade 9 <span className="ml-1.5 text-[10px] opacity-70">{gradeCounts['9'] || 0}</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <StatCard icon={<BookOpen className="h-5 w-5" />} label="Concepts" value={totalNodes} tint="from-blue-500 to-cyan-500" />
            <StatCard icon={<Trophy className="h-5 w-5" />} label="Mastered" value={`${masteredCount} / ${totalNodes}`} tint="from-amber-500 to-orange-500" />
            <StatCard icon={<Sparkles className="h-5 w-5" />} label="Avg. p(L)" value={`${(avgMastery * 100).toFixed(1)}%`} tint="from-fuchsia-500 to-pink-500" />
          </div>
        </div>

        {/* Weakest concept CTA */}
        {weakest && (
          <Card className="mb-10 overflow-hidden relative border-amber-200">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
            <CardContent className="p-5 pt-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shadow">
                <Target className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Focus area</div>
                  <Badge className="bg-amber-500 hover:bg-amber-500 gap-1"><Flame className="h-3 w-3" /> weakest</Badge>
                </div>
                <div className="font-semibold text-lg">{weakest.title}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{weakest.code}</span> · current mastery{' '}
                  <span className="font-semibold text-foreground">{((weakest.mastery?.pMastery ?? 0) * 100).toFixed(1)}%</span>{' '}
                  · a targeted 5-question drill can push it up.
                </div>
              </div>
              <Link href={`/drill/${weakest.id}`}>
                <Button className="bg-gradient-to-br from-amber-500 to-rose-500 hover:opacity-90">
                  <Target className="h-4 w-4 mr-1" /> Start 5-question drill
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Strands grouped by grade */}
        <div className="space-y-14">
          {(() => {
            // group strands by grade
            const byGrade = {};
            for (const s of strands) {
              const g = s.grade || 0;
              if (!byGrade[g]) byGrade[g] = [];
              byGrade[g].push(s);
            }
            const grades = Object.keys(byGrade).map(Number).sort((a, b) => a - b);
            const gradeTints = { 8: 'from-teal-500 to-cyan-500', 9: 'from-indigo-500 to-fuchsia-500' };
            return grades.map(g => {
              const gs = byGrade[g];
              const nodes = gs.flatMap(s => s.nodes);
              const mastered = nodes.filter(n => n.mastery?.mastered).length;
              const avg = nodes.length ? (nodes.reduce((a, n) => a + (n.mastery?.pMastery || 0), 0) / nodes.length) : 0;
              return (
                <div key={g}>
                  <div className={`rounded-xl bg-gradient-to-br ${gradeTints[g] || 'from-slate-500 to-slate-700'} text-white p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-3`}>
                    <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl font-bold backdrop-blur">
                      {g}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-widest opacity-80">Ontario Curriculum</div>
                      <div className="text-2xl font-bold">Grade {g}</div>
                      <div className="text-sm opacity-90">{gs.length} strand{gs.length > 1 ? 's' : ''} · {nodes.length} concepts</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge className="bg-white/20 hover:bg-white/25 backdrop-blur"><Trophy className="h-3 w-3 mr-1" /> {mastered} mastered</Badge>
                      <Badge className="bg-white/20 hover:bg-white/25 backdrop-blur">avg p(L) {(avg * 100).toFixed(0)}%</Badge>
                    </div>
                  </div>

                  <div className="space-y-10">
                    {gs.map(strand => (
                      <section key={strand.id}>
                        <div className="flex items-baseline justify-between mb-4">
                          <div>
                            <h2 className="text-xl font-semibold tracking-tight">{strand.name}</h2>
                            <p className="text-sm text-muted-foreground">{strand.description}</p>
                          </div>
                          <Badge variant="outline">{strand.code}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {strand.nodes.map(node => (
                            <NodeCard key={node.id} node={node} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
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
