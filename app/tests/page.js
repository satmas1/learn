'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, ClipboardList, Clock, ListChecks, Loader2, Trophy } from 'lucide-react';

export default function TestsPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/tests', { cache: 'no-store' });
      const json = await res.json();
      setTests(json.tests || []);
      setLoading(false);
    })();
  }, []);

  const tints = ['from-blue-500 to-cyan-500', 'from-indigo-500 to-fuchsia-500', 'from-amber-500 to-rose-500'];

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
            Full-length assessments spanning every strand you’ve practiced. Each submission runs a Bayesian update per concept and shows which topics need another pass.
          </p>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {tests.map((t, i) => (
              <Card key={t.id} className="overflow-hidden relative hover:shadow-lg transition">
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tints[i % tints.length]}`} />
                <CardHeader className="pt-6">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className={`h-5 w-5 text-transparent bg-clip-text bg-gradient-to-br ${tints[i % tints.length]}`} />
                    {t.title}
                  </CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1"><ListChecks className="h-3 w-3" /> {t.totalQuestions} questions</Badge>
                    <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> ~{t.estMinutes} min</Badge>
                  </div>
                  <Link href={`/tests/${t.id}`}>
                    <Button className="w-full group">
                      Start test <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
