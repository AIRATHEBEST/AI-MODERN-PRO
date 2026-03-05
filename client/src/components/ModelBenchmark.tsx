import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, BarChart3, Clock, Coins, Plus, X, Trophy, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { id: "openai", label: "🔑 OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] },
  { id: "claude", label: "🧠 Claude", models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"] },
  { id: "gemini", label: "✨ Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { id: "ollama", label: "🦙 Ollama", models: ["llama3.2", "mistral", "codellama", "phi3"] },
  { id: "deepseek", label: "🔍 Deepseek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "grok", label: "🤖 Grok", models: ["grok-beta", "grok-2"] },
  { id: "built-in", label: "⚡ Built-in", models: ["gpt-4o-mini"] },
];

const PRESET_PROMPTS = [
  "Explain quantum entanglement in simple terms",
  "Write a haiku about artificial intelligence",
  "What is the best programming language and why?",
  "Summarize the French Revolution in 3 sentences",
  "Give me a creative name for a startup that makes AI tools",
];

interface BenchmarkEntry {
  provider: string;
  model: string;
}

interface BenchmarkResult {
  provider: string;
  model: string;
  response: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  error?: string;
}

export function ModelBenchmark() {
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0]);
  const [entries, setEntries] = useState<BenchmarkEntry[]>([
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "claude", model: "claude-3-5-haiku-20241022" },
  ]);
  const [results, setResults] = useState<BenchmarkResult[] | null>(null);

  const benchmarkMutation = trpc.benchmark.run.useMutation({
    onSuccess: (data) => setResults(data.results as unknown as BenchmarkResult[]),
    onError: (e) => toast.error(e.message),
  });

  const addEntry = () => {
    if (entries.length >= 6) { toast.error("Max 6 providers"); return; }
    setEntries(e => [...e, { provider: "built-in", model: "gpt-4o-mini" }]);
  };

  const removeEntry = (i: number) => setEntries(e => e.filter((_, idx) => idx !== i));

  const updateEntry = (i: number, field: keyof BenchmarkEntry, value: string) => {
    setEntries(e => e.map((entry, idx) => idx === i ? { ...entry, [field]: value } : entry));
  };

  const handleRun = () => {
    if (!prompt.trim()) { toast.error("Enter a prompt"); return; }
    setResults(null);
    benchmarkMutation.mutate({ prompt, providers: entries });
  };

  const fastest = results?.filter(r => !r.error).sort((a, b) => a.durationMs - b.durationMs)[0];
  const mostTokens = results?.filter(r => !r.error).sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="size-5" /> Model Benchmark</h3>
        <p className="text-sm text-muted-foreground mt-1">Send the same prompt to multiple providers and compare responses side-by-side</p>
      </div>

      {/* Prompt */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Test Prompt</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {PRESET_PROMPTS.map(p => (
                <button key={p} onClick={() => setPrompt(p)} className={cn("text-xs px-2 py-1 rounded border transition-colors", prompt === p ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border")}>
                  {p.substring(0, 40)}…
                </button>
              ))}
            </div>
            <textarea
              className="w-full mt-2 p-3 text-sm border rounded-md resize-none bg-background"
              rows={3}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Enter your benchmark prompt..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Providers to Test</CardTitle>
            <Button size="sm" variant="outline" onClick={addEntry} disabled={entries.length >= 6}>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const providerDef = PROVIDERS.find(p => p.id === entry.provider);
              return (
                <div key={i} className="flex items-center gap-2">
                  <Select value={entry.provider} onValueChange={v => { updateEntry(i, "provider", v); const pd = PROVIDERS.find(p => p.id === v); updateEntry(i, "model", pd?.models[0] || ""); }}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={entry.model} onValueChange={v => updateEntry(i, "model", v)}>
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{(providerDef?.models || []).map(m => <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeEntry(i)} disabled={entries.length <= 1}>
                    <X className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button onClick={handleRun} disabled={benchmarkMutation.isPending || !prompt.trim()} className="w-full mt-4">
            {benchmarkMutation.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Running benchmark…</> : <><Zap className="size-4 mr-2" /> Run Benchmark</>}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {benchmarkMutation.isPending && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span>Querying {entries.length} providers in parallel…</span>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            {fastest && (
              <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <Trophy className="size-4" />
                    <span className="text-xs font-semibold">Fastest Response</span>
                  </div>
                  <p className="font-medium mt-1">{fastest.provider} / {fastest.model}</p>
                  <p className="text-sm text-muted-foreground">{fastest.durationMs}ms</p>
                </CardContent>
              </Card>
            )}
            {mostTokens && (
              <Card className="border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <BarChart3 className="size-4" />
                    <span className="text-xs font-semibold">Most Detailed</span>
                  </div>
                  <p className="font-medium mt-1">{mostTokens.provider} / {mostTokens.model}</p>
                  <p className="text-sm text-muted-foreground">{mostTokens.completionTokens} tokens</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Individual results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.map((r, i) => (
              <Card key={i} className={r.error ? "border-destructive/40" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm">{r.provider} / {r.model}</CardTitle>
                    <div className="flex items-center gap-2">
                      {r === fastest && !r.error && <Badge variant="default" className="text-xs bg-yellow-500">⚡ Fastest</Badge>}
                      {!r.error && (
                        <>
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Clock className="size-3" /> {r.durationMs}ms
                          </Badge>
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Coins className="size-3" /> {r.totalTokens} tok
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {r.error ? (
                    <div className="flex items-start gap-2 text-destructive text-sm">
                      <AlertCircle className="size-4 mt-0.5 shrink-0" />
                      <span>{r.error}</span>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                      {r.response}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
