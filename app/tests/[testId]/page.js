'use client';
import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, ArrowRight, ArrowLeftCircle, CheckCircle2, XCircle, Loader2, Trophy, Sparkles, ClipboardCheck, ListChecks, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TestPage({ params }) {
  const { testId } = use(params);
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/tests/${testId}`, { cache: 'no-store' });
      const json = await res.json();
      setBundle(json);
      setLoading(false);
    })();
  }, [testId]);

  const questions = bundle?.questions || [];
  const q = questions[idx];
  const answered = Object.keys(answers).length;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tests/${testId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      setResult(json);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error('Submission failed');
    } finally { setSubmitting(false); }
  };

  if (loading || !bundle) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (result) {
    return <ResultView bundle={bundle} answers={answers} result={result} onRetake={() => { setResult(null); setAnswers({}); setIdx(0); }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/tests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All tests
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{bundle.test.title}</Badge>
            <Badge variant="secondary">{answered}/{questions.length} answered</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-indigo-500" /> {bundle.test.title}
          </h1>
          <p className="text-muted-foreground mt-1">{bundle.test.description}</p>
        </div>

        <Progress value={(answered / questions.length) * 100} className="h-2 mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Question {idx + 1} of {questions.length}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-lg leading-relaxed">{q?.prompt}</div>
              <RadioGroup
                value={answers[q?.id] !== undefined ? String(answers[q.id]) : ''}
                onValueChange={(v) => setAnswers(a => ({ ...a, [q.id]: parseInt(v, 10) }))}
                className="space-y-2"
              >
                {q?.choices?.map((c, i) => (
                  <Label
                    key={i}
                    htmlFor={`opt-${q.id}-${i}`}
                    className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition ${answers[q.id] === i ? 'border-indigo-400 bg-indigo-50' : ''}`}
                  >
                    <RadioGroupItem id={`opt-${q.id}-${i}`} value={String(i)} />
                    <span className="font-mono text-sm">{c}</span>
                  </Label>
                ))}
              </RadioGroup>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
                  <ArrowLeftCircle className="h-4 w-4 mr-1" /> Previous
                </Button>
                {idx < questions.length - 1 ? (
                  <Button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}>
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={submit} disabled={answered < questions.length || submitting} className="bg-emerald-600 hover:bg-emerald-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Submit test
                  </Button>
                )}
              </div>
              {idx === questions.length - 1 && answered < questions.length && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  {questions.length - answered} unanswered. Use the navigator to jump back.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Navigator</CardTitle>
              <CardDescription>Green = answered</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px] pr-2">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIdx(i)}
                      className={`h-9 rounded-md text-xs font-semibold border transition ${
                        idx === i ? 'ring-2 ring-indigo-400 border-indigo-400' :
                        answers[questions[i].id] !== undefined ? 'bg-emerald-100 border-emerald-200 text-emerald-800' :
                        'hover:bg-muted'
                      }`}
                    >{i + 1}</button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function ResultView({ bundle, answers, result, onRetake }) {
  const pct = Math.round(result.percent * 100);
  const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
  const gradeTint = pct >= 80 ? 'from-emerald-500 to-teal-500' : pct >= 60 ? 'from-amber-500 to-orange-500' : 'from-rose-500 to-red-500';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/tests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All tests
          </Link>
          <Badge variant="outline">{bundle.test.title} · Results</Badge>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-8">
        <Card className="overflow-hidden relative">
          <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${gradeTint}`} />
          <CardContent className="p-8">
            <div className="flex items-center gap-8 flex-wrap">
              <div className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${gradeTint} text-white flex items-center justify-center text-5xl font-bold shadow-lg`}>
                {grade}
              </div>
              <div>
                <div className="text-4xl font-bold tabular-nums">{result.score}<span className="text-2xl text-muted-foreground">/{result.total}</span></div>
                <div className="text-sm text-muted-foreground">{pct}% correct · {bundle.test.title}</div>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={onRetake}><RefreshCw className="h-4 w-4 mr-1" /> Retake</Button>
                <Link href="/"><Button><Sparkles className="h-4 w-4 mr-1" /> Back to Dashboard</Button></Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4 text-indigo-500" /> Mastery updates by concept</CardTitle>
            <CardDescription>Each concept ran its own Bayesian update using the questions tagged to it.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.perNode.map(n => {
                const delta = (n.pMastery - n.previousP) * 100;
                return (
                  <div key={n.nodeId}>
                    <div className="flex items-baseline justify-between mb-1 flex-wrap gap-1">
                      <div className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{n.code}</span>
                        {n.title}
                        {n.mastered && <Badge className="ml-2 bg-emerald-500"><Trophy className="h-3 w-3 mr-1" /> Mastered</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {n.correct}/{n.total} correct ·
                        <span className="ml-1">p(L) {(n.previousP*100).toFixed(1)}% <ArrowRight className="inline h-3 w-3" /> <span className="font-semibold text-foreground">{(n.pMastery*100).toFixed(1)}%</span></span>
                        <span className={`ml-1 font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>({delta >= 0 ? '+' : ''}{delta.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <Progress value={n.pMastery * 100} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question review</CardTitle>
            <CardDescription>Every question, your answer, and the explanation.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-auto pr-2">
              {bundle.questions.map((qq, i) => {
                const pq = result.perQuestion.find(x => x.id === qq.id);
                if (!pq) return null;
                return (
                  <div key={qq.id} className={`rounded-md border p-3 ${pq.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
                    <div className="flex items-start gap-2 text-sm">
                      {pq.correct ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" /> : <XCircle className="h-4 w-4 text-rose-600 mt-0.5" />}
                      <div className="flex-1">
                        <div className="font-medium">{i + 1}. {qq.prompt}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Your answer: <span className={pq.correct ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>{qq.choices[answers[qq.id]] ?? '—'}</span>
                          {!pq.correct && <> · Correct: <span className="text-emerald-700 font-semibold">{qq.choices[pq.correctIndex]}</span></>}
                        </div>
                        <div className="mt-1 text-xs italic text-muted-foreground">{pq.explanation}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
