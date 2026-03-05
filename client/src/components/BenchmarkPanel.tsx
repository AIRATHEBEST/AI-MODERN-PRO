import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, BarChart3, Zap, Clock, CheckCircle2, XCircle, Play } from "lucide-react";

const PRESET_PROVIDERS = [
  { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o Mini" },
  { provider: "openai", model: "gpt-4o", label: "GPT-4o" },
  { provider: "claude", model: "claude-3-5-haiku-20241022", label: "Claude Haiku" },
  { provider: "claude", model: "claude-3-5-sonnet-20241022", label: "Claude Sonnet" },
  { provider: "gemini", model: "gemini-2.0-flash", label: "Gemini Flash" },
  { provider: "gemini", model: "gemini-1.5-pro", label: "Gemini Pro" },
  { provider: "deepseek", model: "deepseek-chat", label: "Deepseek Chat" },
  { provider: "grok", model: "grok-beta", label: "Grok Beta" },
  { provider: "ollama", model: "", label: "Ollama (local)" },
];

type BenchResult = { provider: string; model: string; response: string; durationMs: number; tokens: number; error?: string };

export function BenchmarkPanel() {
  const [prompt, setPrompt] = useState("Explain quantum entanglement in 3 sentences.");
  const [selected, setSelected] = useState<Set<string>>(new Set(["openai::gpt-4o-mini", "claude::claude-3-5-haiku-20241022"]));
  const [results, setResults] = useState<BenchResult[]>([]);

  const runMut = trpc.benchmark.run.useMutation({
    onSuccess: (data) => { setResults(data.results); toast.success("Benchmark complete!"); listQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const listQuery = trpc.benchmark.list.useQuery();

  const toggleProvider = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const handleRun = () => {
    if (!prompt.trim()) { toast.error("Enter a prompt"); return; }
    if (selected.size === 0) { toast.error("Select at least one provider"); return; }
    const providers = Array.from(selected).map(k => { const [p, m] = k.split("::"); return { provider: p, model: m || undefined }; });
    setResults([]);
    runMut.mutate({ prompt, providers });
  };

  const fastest = results.filter(r => !r.error).sort((a, b) => a.durationMs - b.durationMs)[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="size-5" /> Model Benchmark</h2>
        <p className="text-sm text-muted-foreground">Send the same prompt to multiple providers and compare responses side-by-side</p>
      </div>

      <div>
        <Label>Test Prompt</Label>
        <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} className="mt-1 font-mono text-sm" />
      </div>

      <div>
        <Label className="mb-3 block">Select Providers to Test</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_PROVIDERS.map(p => {
            const key = `${p.provider}::${p.model}`;
            return (
              <div key={key} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer" onClick={() => toggleProvider(key)}>
                <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleProvider(key)} />
                <span className="text-sm">{p.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={handleRun} disabled={runMut.isPending || selected.size === 0} className="gap-2">
        {runMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {runMut.isPending ? `Testing ${selected.size} providers…` : `Run Benchmark (${selected.size} providers)`}
      </Button>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Results <Badge variant="secondary">{results.filter(r => !r.error).length}/{results.length} succeeded</Badge>
          </h3>
          <div className="grid gap-4">
            {results.sort((a, b) => a.durationMs - b.durationMs).map((r, i) => (
              <Card key={i} className={fastest && r.provider === fastest.provider && r.model === fastest.model ? "border-green-500/50" : ""}>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {r.error ? <XCircle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-green-500" />}
                      <span className="font-medium">{r.provider}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.model}</code>
                      {fastest && r.durationMs === fastest.durationMs && !r.error && <Badge className="bg-green-500 text-white text-xs">⚡ Fastest</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3" />{(r.durationMs / 1000).toFixed(2)}s</span>
                      <span className="flex items-center gap-1"><Zap className="size-3" />{r.tokens} tokens</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  {r.error ? (
                    <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{r.error}</p>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{r.response}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {(listQuery.data?.length ?? 0) > 0 && !results.length && (
        <div>
          <h3 className="font-medium mb-3">Previous Benchmarks</h3>
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-2">
              {listQuery.data?.map(b => (
                <div key={b.id} className="p-3 rounded border cursor-pointer hover:bg-muted/50" onClick={() => { setPrompt(b.prompt); setResults(b.results as BenchResult[]); }}>
                  <p className="text-sm font-medium truncate">{b.prompt}</p>
                  <p className="text-xs text-muted-foreground">{(b.results as BenchResult[]).length} providers · {new Date(b.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
