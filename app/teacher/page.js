'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Users, Trophy, AlertTriangle, RefreshCw, Loader2, Sparkles, TrendingUp,
  Lightbulb, Flame, ArrowRight, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// color scale from p in [0,1] -> tailwind bg + text
function cellColor(p) {
  if (p >= 0.95) return { bg: 'bg-emerald-500', text: 'text-white', label: 'Mastered' };
  if (p >= 0.7)  return { bg: 'bg-emerald-300', text: 'text-emerald-950', label: 'Proficient' };
  if (p >= 0.5)  return { bg: 'bg-amber-300',  text: 'text-amber-950',  label: 'Developing' };
  if (p >= 0.3)  return { bg: 'bg-orange-400', text: 'text-orange-950', label: 'Developing' };
  return { bg: 'bg-rose-500', text: 'text-white', label: 'Struggling' };
}

function TeacherPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reseeding, setReseeding] = useState(false);
  const [drillNodeId, setDrillNodeId] = useState(null);
  const [drillData, setDrillData] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/teacher/analytics', { cache: 'no-store' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDrill = async (nodeId) => {
    setDrillNodeId(nodeId);
    setDrillLoading(true);
    setDrillData(null);
    try {
      const res = await fetch(`/api/teacher/concept/${nodeId}`, { cache: 'no-store' });
      const json = await res.json();
      setDrillData(json);
    } catch (e) {
      toast.error('Failed to load concept detail');
    } finally { setDrillLoading(false); }
  };
  const closeDrill = () => { setDrillNodeId(null); setDrillData(null); };

  const reseed = async () => {
    setReseeding(true);
    try {
      const res = await fetch('/api/teacher/seed-classroom', { method: 'POST' });
      const json = await res.json();
      toast.success(`Reseeded ${json.students} students`);
      await load();
    } catch (e) {
      toast.error('Reseed failed');
    } finally { setReseeding(false); }
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const totalStudents = data.students.length;
    const totalNodes = data.nodes.length;
    let sum = 0, count = 0, masteredCells = 0, strugglingCells = 0;
    for (const s of data.students) {
      for (const n of data.nodes) {
        const cell = data.matrix[s.id]?.[n.id];
        const p = cell ? cell.pMastery : 0.1;
        sum += p; count += 1;
        if (p >= 0.95) masteredCells += 1;
        if (p < 0.3) strugglingCells += 1;
      }
    }
    return {
      totalStudents,
      totalNodes,
      avgP: count ? sum / count : 0,
      masteredCells,
      strugglingCells,
      totalCells: count,
    };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Student View
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Teacher View</Badge>
            <Button size="sm" variant="outline" onClick={reseed} disabled={reseeding}>
              {reseeding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Reseed classroom
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classroom Mastery</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Heatmap of every student&apos;s Bayesian mastery estimate for each concept. Spot cold rows (students needing support) and cold columns (concepts needing reteach) at a glance.
          </p>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Students" value={stats.totalStudents} tint="from-blue-500 to-cyan-500" />
          <StatCard icon={<Sparkles className="h-5 w-5" />} label="Class Avg p(L)" value={`${(stats.avgP*100).toFixed(1)}%`} tint="from-indigo-500 to-fuchsia-500" />
          <StatCard icon={<Trophy className="h-5 w-5" />} label="Mastered Cells" value={`${stats.masteredCells}/${stats.totalCells}`} tint="from-emerald-500 to-teal-500" />
          <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="At Risk (<30%)" value={stats.strugglingCells} tint="from-rose-500 to-orange-500" />
        </div>

        {/* Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mastery Heatmap</CardTitle>
            <CardDescription>Rows: students · Columns: concepts · Hover a cell for p(L). Warmer = struggling, greener = mastered.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white text-left text-xs font-medium text-muted-foreground pr-3 pb-2 min-w-[140px]">Student</th>
                    {data.nodes.map(n => (
                      <th key={n.id} className="text-[10px] font-mono text-muted-foreground align-bottom px-1 pb-2 whitespace-nowrap">
                        <button
                          onClick={() => openDrill(n.id)}
                          className="h-24 flex items-end justify-center group focus:outline-none"
                          title={`Drill into ${n.title}`}
                        >
                          <div className="rotate-[-60deg] origin-bottom-left translate-x-3 translate-y-0 max-w-[120px] truncate group-hover:text-indigo-600 underline-offset-4 group-hover:underline">
                            {n.code} · {n.title}
                          </div>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map(s => (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-10 bg-white text-sm pr-3 py-0.5 whitespace-nowrap">{s.name}</td>
                      {data.nodes.map(n => {
                        const cell = data.matrix[s.id]?.[n.id];
                        const p = cell ? cell.pMastery : 0.1;
                        const c = cellColor(p);
                        return (
                          <td key={n.id} className="p-0">
                            <div
                              onClick={() => openDrill(n.id)}
                              className={`h-8 w-14 rounded-md ${c.bg} ${c.text} text-[11px] font-semibold flex items-center justify-center cursor-pointer transition hover:scale-110 hover:z-20 relative`}
                              title={`${s.name} · ${n.code}: p(L)=${(p*100).toFixed(1)}% (${c.label}) — click to drill`}
                            >
                              {(p*100).toFixed(0)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legend />
          </CardContent>
        </Card>

        {/* Per-node distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-500" /> Per-Concept Mastery Distribution</CardTitle>
            <CardDescription>How the class is split across mastery bands, one bar per concept.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.nodeStats.map(n => {
                const total = n.total || 1;
                const parts = [
                  { key: 'struggling', label: '<30%', bg: 'bg-rose-500', val: n.distribution.struggling },
                  { key: 'developing', label: '30-70%', bg: 'bg-amber-400', val: n.distribution.developing },
                  { key: 'proficient', label: '70-95%', bg: 'bg-emerald-300', val: n.distribution.proficient },
                  { key: 'mastered', label: '≥95%', bg: 'bg-emerald-600', val: n.distribution.mastered },
                ];
                return (
                  <button
                    key={n.nodeId}
                    onClick={() => openDrill(n.nodeId)}
                    className="w-full text-left group rounded-md p-2 -mx-2 hover:bg-muted/60 transition"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{n.code}</span>
                        <span className="group-hover:underline underline-offset-4">{n.title}</span>
                        <ChevronRight className="inline h-3.5 w-3.5 ml-1 text-muted-foreground group-hover:translate-x-0.5 transition" />
                      </div>
                      <div className="text-xs text-muted-foreground">avg <span className="font-semibold text-foreground">{(n.avgP*100).toFixed(1)}%</span></div>
                    </div>
                    <div className="flex h-5 rounded-md overflow-hidden ring-1 ring-border">
                      {parts.map(p => (
                        <div
                          key={p.key}
                          className={`${p.bg} flex items-center justify-center text-[10px] text-white/95 font-semibold`}
                          style={{ width: `${(p.val/total)*100}%` }}
                          title={`${p.label}: ${p.val} students`}
                        >
                          {p.val > 0 && ((p.val/total)*100 >= 8) ? p.val : ''}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Strand roll-ups */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Strand Roll-ups</CardTitle>
            <CardDescription>Average class mastery by curriculum strand.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.strandStats.map(s => (
              <div key={s.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-mono text-muted-foreground">{s.code}</div>
                    <div className="font-medium">{s.name}</div>
                  </div>
                  <Badge className={s.avgP >= 0.7 ? 'bg-emerald-500' : s.avgP >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'}>
                    {(s.avgP*100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="h-2 w-full bg-muted rounded mt-3 overflow-hidden">
                  <div className={`h-full ${s.avgP >= 0.7 ? 'bg-emerald-500' : s.avgP >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${s.avgP*100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      {/* Concept drill-down drawer */}
      <Sheet open={!!drillNodeId} onOpenChange={(o) => { if (!o) closeDrill(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {drillLoading || !drillData ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ConceptDrillDown data={drillData} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ConceptDrillDown({ data }) {
  const { node, strand, avgP, distribution, totalStudents, roster, strugglers, leaders, suggestions, errorPattern } = data;
  const priorityStyle = {
    high:   { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', icon: <Flame className="h-4 w-4" /> },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: <Lightbulb className="h-4 w-4" /> },
    low:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: <Sparkles className="h-4 w-4" /> },
  };
  return (
    <div className="space-y-6">
      <SheetHeader className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono">{node.code}</Badge>
          {strand && <span>· {strand.name}</span>}
        </div>
        <SheetTitle className="text-2xl">{node.title}</SheetTitle>
        <SheetDescription>{node.description}</SheetDescription>
      </SheetHeader>

      {/* Snapshot */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="Students" value={totalStudents} />
        <MiniStat label="Class avg" value={`${(avgP*100).toFixed(0)}%`} />
        <MiniStat label="Mastered" value={distribution.mastered} tone="emerald" />
        <MiniStat label="At risk" value={distribution.struggling} tone="rose" />
      </div>

      {/* Distribution bar */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Mastery distribution</div>
        <div className="flex h-5 rounded-md overflow-hidden ring-1 ring-border">
          {[
            { k: 'struggling', bg: 'bg-rose-500', val: distribution.struggling },
            { k: 'developing', bg: 'bg-amber-400', val: distribution.developing },
            { k: 'proficient', bg: 'bg-emerald-300', val: distribution.proficient },
            { k: 'mastered', bg: 'bg-emerald-600', val: distribution.mastered },
          ].map(p => (
            <div key={p.k} className={`${p.bg} text-white/95 text-[10px] font-semibold flex items-center justify-center`} style={{ width: `${(p.val/(totalStudents||1))*100}%` }}>
              {p.val > 0 ? p.val : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Reteach suggestions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Reteach suggestions</h3>
          <Badge variant="secondary" className="text-[10px]">auto-generated</Badge>
        </div>
        <div className="space-y-2">
          {suggestions.map((s, i) => {
            const st = priorityStyle[s.priority] || priorityStyle.medium;
            return (
              <div key={i} className={`border ${st.border} ${st.bg} rounded-lg p-3`}>
                <div className={`flex items-center gap-2 text-sm font-semibold ${st.text}`}>
                  {st.icon}
                  {s.title}
                  <Badge variant="outline" className="ml-auto text-[10px] capitalize">{s.priority}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">{s.body}</div>
              </div>
            );
          })}
        </div>
        {errorPattern.wrongCount > 0 && (
          <div className="text-[11px] text-muted-foreground mt-2">
            Based on {errorPattern.wrongCount} recent incorrect attempts · slope errors: {errorPattern.slopeErrs} · intercept errors: {errorPattern.interceptErrs}
          </div>
        )}
      </div>

      <Separator />

      {/* Focus groups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FocusGroup title="Needs support" tone="rose" icon={<AlertTriangle className="h-4 w-4" />} students={strugglers} />
        <FocusGroup title="Ready to extend" tone="emerald" icon={<Trophy className="h-4 w-4" />} students={leaders} />
      </div>

      {/* Full ranked roster */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold">Ranked roster</h3>
          <span className="text-xs text-muted-foreground">(ascending by p(L))</span>
        </div>
        <ScrollArea className="h-72 pr-3">
          <div className="space-y-1.5">
            {roster.map((r, i) => {
              const c = cellColor(r.pMastery);
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="text-[11px] font-mono text-muted-foreground w-6 text-right tabular-nums">{i+1}</div>
                  <div className="text-sm min-w-[80px]">{r.name}</div>
                  <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                    <div className={`h-full ${c.bg}`} style={{ width: `${r.pMastery*100}%` }} />
                  </div>
                  <div className="text-xs tabular-nums font-semibold w-10 text-right">{(r.pMastery*100).toFixed(0)}%</div>
                  {r.mastered && <Trophy className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {node.widget && (
        <Link href={`/practice/${node.id}`}>
          <Button className="w-full">
            Open student practice view <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const tones = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  };
  return (
    <div className="border rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tones[tone] || ''}`}>{value}</div>
    </div>
  );
}

function FocusGroup({ title, tone, icon, students }) {
  const toneMap = {
    rose: 'text-rose-700 border-rose-200 bg-rose-50/40',
    emerald: 'text-emerald-700 border-emerald-200 bg-emerald-50/40',
  };
  return (
    <div className={`border rounded-lg p-3 ${toneMap[tone]}`}>
      <div className="flex items-center gap-2 font-semibold text-sm mb-2">
        {icon} {title}
      </div>
      <div className="space-y-1">
        {students.map(s => (
          <div key={s.id} className="flex items-center justify-between text-sm">
            <span>{s.name}</span>
            <span className="font-mono tabular-nums text-xs">{(s.pMastery*100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
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
            <div className="text-xl md:text-2xl font-bold tabular-nums">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend() {
  const items = [
    { bg: 'bg-rose-500', label: 'Struggling (<30%)' },
    { bg: 'bg-orange-400', label: '30-50%' },
    { bg: 'bg-amber-300', label: '50-70%' },
    { bg: 'bg-emerald-300', label: 'Proficient (70-95%)' },
    { bg: 'bg-emerald-500', label: 'Mastered (≥95%)' },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs">
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-5 rounded ${i.bg}`} />
          <span className="text-muted-foreground">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export default TeacherPage;
