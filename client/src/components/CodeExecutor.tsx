import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Loader2, Terminal, Copy, Check, Trash2 } from "lucide-react";

const LANGUAGES = [
  { value: "python", label: "🐍 Python" },
  { value: "javascript", label: "🟨 JavaScript" },
  { value: "typescript", label: "💙 TypeScript" },
  { value: "bash", label: "🐚 Bash" },
];

type Props = { initialCode?: string; initialLanguage?: string };

export function CodeExecutor({ initialCode = "", initialLanguage = "python" }: Props) {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRun = async () => {
    if (!code.trim()) { toast.error("No code to run"); return; }
    setIsRunning(true);
    setOutput(""); setError(""); setExitCode(null);
    try {
      const r = await fetch("/api/code/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, language }),
      });
      const data = await r.json() as { output: string; error: string; exitCode: number };
      setOutput(data.output || "");
      setError(data.error || "");
      setExitCode(data.exitCode);
      if (data.exitCode === 0) toast.success("Code executed successfully");
      else toast.error("Code execution failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed");
      setExitCode(1);
    } finally {
      setIsRunning(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output || error);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={handleRun} disabled={isRunning || !code.trim()} className="gap-1.5">
          {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Run
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setCode(""); setOutput(""); setError(""); setExitCode(null); }}><Trash2 className="size-3.5" /></Button>
        {exitCode !== null && (
          <Badge variant={exitCode === 0 ? "default" : "destructive"} className="text-xs">
            Exit {exitCode}
          </Badge>
        )}
      </div>

      {/* Code editor */}
      <Textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder={`Write ${language} code here…`}
        className="flex-1 font-mono text-sm resize-none min-h-[200px]"
        spellCheck={false}
        onKeyDown={e => {
          if (e.key === "Tab") { e.preventDefault(); const s = e.currentTarget.selectionStart; const end = e.currentTarget.selectionEnd; setCode(prev => prev.substring(0, s) + "    " + prev.substring(end)); setTimeout(() => { e.currentTarget.selectionStart = e.currentTarget.selectionEnd = s + 4; }, 0); }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
        }}
      />

      {/* Output */}
      {(output || error || isRunning) && (
        <div className="rounded-lg bg-zinc-950 text-zinc-100 font-mono text-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <span className="text-xs flex items-center gap-1.5 text-zinc-400">
              <Terminal className="size-3" /> Output
            </span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100" onClick={copyOutput}>
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </Button>
          </div>
          <div className="p-3 overflow-auto max-h-48">
            {isRunning ? (
              <span className="animate-pulse text-zinc-400">Running…</span>
            ) : (
              <>
                {output && <pre className="whitespace-pre-wrap text-green-400">{output}</pre>}
                {error && <pre className="whitespace-pre-wrap text-red-400">{error}</pre>}
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Ctrl+Enter to run · Execution timeout: 10 seconds</p>
    </div>
  );
}
