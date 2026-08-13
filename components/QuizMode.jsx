'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, CheckCircle2, XCircle, RefreshCw, Trophy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function QuizMode({ nodeId, onMasteryUpdate, count: initialCount = 10, title, autoStart = false }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [seedOffset, setSeedOffset] = useState(0);
  const [count] = useState(initialCount);
  const [nodeMeta, setNodeMeta] = useState(null);

  const loadSet = async (offset) => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    setIdx(0);
    const off = offset ?? Math.floor(Math.random() * 200);
    setSeedOffset(off);
    const res = await fetch(`/api/practice/${nodeId}?count=${count}&offset=${off}`, { cache: 'no-store' });
    const json = await res.json();
    setQuestions(json.questions || []);
    setNodeMeta(json.node);
    setLoading(false);
  };

  useEffect(() => { loadSet(); }, [nodeId]);

  const answered = Object.keys(answers).length;
  const q = questions[idx];

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/practice/${nodeId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, seedOffset, count }),
      });
      const json = await res.json();
      setResult(json);
      if (json.mastery && onMasteryUpdate) onMasteryUpdate(json.mastery);
      const delta = ((json.mastery.pMastery - json.mastery.previousP) * 100).toFixed(1);
      toast(`Scored ${json.score}/${json.total}`, {
        description: `p(L): ${(json.mastery.previousP*100).toFixed(1)}% → ${(json.mastery.pMastery*100).toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta}%)`,
      });
    } catch (e) {
      toast.error('Submit failed');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (result) {
    const pct = Math.round(result.percent * 100);
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-fuchsia-500" />
            <CardTitle>Quiz Results</CardTitle>
          </div>
          <CardDescription>{questions.length} questions · {nodeMeta?.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-6">
            <div>
              <div className="text-5xl font-bold tabular-nums">{result.score}<span className="text-2xl text-muted-foreground">/{result.total}</span></div>
              <div className="text-sm text-muted-foreground">Score {pct}%</div>
            </div>
            <div className="flex-1 pb-2">
              <div className="text-xs text-muted-foreground mb-1">Mastery p(L)</div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="tabular-nums">{(result.mastery.previousP*100).toFixed(1)}%</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-bold tabular-nums">{(result.mastery.pMastery*100).toFixed(1)}%</span>
                {result.mastery.mastered && <Badge className="bg-emerald-500 ml-1"><Trophy className="h-3 w-3 mr-1" /> Mastered</Badge>}
              </div>
              <Progress value={result.mastery.pMastery * 100} className="h-2 mt-2" />
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-auto pr-2">
            {questions.map((qq, i) => {
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

          <div className="flex gap-2">
            <Button onClick={() => loadSet()} className="flex-1"><RefreshCw className="h-4 w-4 mr-1.5" /> New set</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Question {idx + 1} of {questions.length}</CardTitle>
            <Badge variant="secondary">{answered}/{questions.length} answered</Badge>
          </div>
          <Progress value={(answered / (questions.length || 1)) * 100} className="h-2 mt-2" />
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
            <Button variant="outline" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>Previous</Button>
            {idx < questions.length - 1 ? (
              <Button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))} disabled={answers[q?.id] === undefined}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={answered < questions.length || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Submit quiz
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question Navigator</CardTitle>
          <CardDescription>Jump to any question</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-9 rounded-md text-sm font-medium border transition ${
                  idx === i ? 'ring-2 ring-indigo-400 border-indigo-400' :
                  answers[questions[i].id] !== undefined ? 'bg-indigo-100 border-indigo-200 text-indigo-800' :
                  'hover:bg-muted'
                }`}
              >{i + 1}</button>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Get all questions answered before submitting. Each correct answer applies a Bayesian update to your mastery.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
