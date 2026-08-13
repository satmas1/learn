'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowLeft, ArrowRight, ClipboardList, Clock, Layers, ListChecks, Loader2, Trophy, Target } from 'lucide-react';

// Grade -> visual style
const GRADE_STYLE = {
  '8':     { rail: 'from-teal-500 to-cyan-500',   badge: 'bg-teal-500',   label: 'Grade 8' },
  '9':     { rail: 'from-indigo-500 to-fuchsia-500', badge: 'bg-indigo-500', label: 'Grade 9' },
  'mixed': { rail: 'from-amber-500 to-rose-500',  badge: 'bg-amber-500',  label: 'Mixed' },
};

export default function TestsPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('all'); // all | 8 | 9 | mixed

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/tests', { cache: 'no-store' });
      const json = await res.json();
      setTests(json.tests || []);
      setLoading(false);
    })();
    try {
      const saved = window.localStorage.getItem('eduengine.testGradeFilter');
      if (saved) setGradeFilter(saved);
      // Otherwise fall back to whatever the dashboard-level grade is
      else {
        const dashGrade = window.localStorage.getItem('eduengine.gradeFilter');
        if (dashGrade && ['8', '9'].includes(dashGrade)) setGradeFilter(dashGrade);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('eduengine.testGradeFilter', gradeFilter); } catch {}
  }, [gradeFilter]);

  const counts = useMemo(() => {
    const c = { all: tests.length, 8: 0, 9: 0, mixed: 0 };
    for (const t of tests) c[t.grade || 'mixed'] = (c[t.grade || 'mixed'] || 0) + 1;
    return c;
  }, [tests]);

  const filtered = gradeFilter === 'all'
    ? tests
    : tests.filter(t => (t.grade || 'mixed') === gradeFilter);

  // Group by grade for display when 'all'
  const groupedByGrade = useMemo(() => {
    const groups = { '8': [], '9': [], mixed: [] };
    for (const t of filtered) groups[t.grade || 'mixed'].push(t);
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <Badge variant="secondary" className="gap-1"><ClipboardList className="h-3 w-3" /> Assessments</Badge>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Practice Tests</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Full-length assessments spanning every strand. Grade-specific presets match the Ontario curriculum exactly — pick a grade to see only its exams.
          </p>

          {/* Grade filter toggle */}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Filter by grade
            </span>
            <ToggleGroup
              type="single"
              value={gradeFilter}
              onValueChange={(v) => v && setGradeFilter(v)}
              className="bg-white border rounded-md p-1 shadow-sm"
            >
              <ToggleGroupItem value="all" className="px-3 h-8 data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                All <span className="ml-1.5 text-[10px] opacity-70">{counts.all}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="8" className="px-3 h-8 data-[state=on]:bg-teal-600 data-[state=on]:text-white">
                Grade 8 <span className="ml-1.5 text-[10px] opacity-70">{counts['8'] || 0}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="9" className="px-3 h-8 data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                Grade 9 <span className="ml-1.5 text-[10px] opacity-70">{counts['9'] || 0}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="mixed" className="px-3 h-8 data-[state=on]:bg-amber-500 data-[state=on]:text-white">
                Mixed <span className="ml-1.5 text-[10px] opacity-70">{counts.mixed || 0}</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-10">
            {['8', '9', 'mixed'].map(g => {
              const list = groupedByGrade[g];
              if (!list || list.length === 0) return null;
              const style = GRADE_STYLE[g];
              return (
                <section key={g}>
                  <div className={`rounded-xl bg-gradient-to-br ${style.rail} text-white p-4 mb-4 flex items-center gap-3`}>
                    <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center font-bold">
                      {g === 'mixed' ? '✧' : g}
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-widest opacity-80">
                        {g === 'mixed' ? 'Cross-grade' : 'Ontario Curriculum'}
                      </div>
                      <div className="text-lg font-bold">
                        {g === 'mixed' ? 'Mixed Level Assessments' : `Grade ${g} Assessments`}
                      </div>
                    </div>
                    <Badge className="ml-auto bg-white/20 hover:bg-white/25 backdrop-blur">{list.length} test{list.length > 1 ? 's' : ''}</Badge>
                  </div>

                  {(() => {
                    const fullExams = list.filter(t => (t.category || 'full') === 'full');
                    const strandDrills = list.filter(t => t.category === 'strand');
                    return (
                      <div className="space-y-6">
                        {fullExams.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Trophy className="h-4 w-4 text-amber-500" />
                              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Full exams</h3>
                              <Badge variant="secondary" className="text-[10px]">{fullExams.length}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              {fullExams.map(t => <TestCard key={t.id} t={t} style={style} />)}
                            </div>
                          </div>
                        )}
                        {strandDrills.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="h-4 w-4 text-indigo-500" />
                              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Strand drills</h3>
                              <Badge variant="secondary" className="text-[10px]">{strandDrills.length}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              {strandDrills.map(t => <TestCard key={t.id} t={t} style={style} />)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function TestCard({ t, style }) {
  const isStrand = t.category === 'strand';
  return (
    <Card className="overflow-hidden relative hover:shadow-lg transition">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${style.rail}`} />
      <CardHeader className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {isStrand ? <Target className="h-4 w-4 text-indigo-500" /> : <Trophy className="h-4 w-4 text-amber-500" />}
            {t.title}
          </CardTitle>
          <Badge className={`${style.badge} hover:${style.badge} text-white shrink-0`}>{style.label}</Badge>
        </div>
        <CardDescription className="line-clamp-3">{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="gap-1"><ListChecks className="h-3 w-3" /> {t.totalQuestions} questions</Badge>
          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> ~{t.estMinutes} min</Badge>
          {isStrand && <Badge variant="outline" className="gap-1 text-indigo-700 border-indigo-200 bg-indigo-50">Strand</Badge>}
        </div>
        <Link href={`/tests/${t.id}`}>
          <Button className="w-full group">
            Start test <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
