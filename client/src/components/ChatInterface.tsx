import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Sparkles, Paperclip, X, Copy, Check, Image as ImageIcon, FileText, Music, Zap, StopCircle } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type ChatMessage = {
  id?: number; role: "user" | "assistant" | "system";
  content: string; provider?: string | null; model?: string | null; createdAt?: Date; streaming?: boolean;
};
export type Attachment = { id: number; fileName: string; fileType: string; mimeType: string; storageUrl: string; };

const PROVIDER_MODELS: Record<string, string[]> = {
  "built-in": ["gpt-4o-mini"],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "text-embedding-3-large", "text-embedding-3-small", "whisper-1", "dall-e-3"],
  claude: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.5-sonnet", "claude-3.5-haiku"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-pro"],
  groq: ["llama-3.3-70b-versatile", "llama-3.3-70b-specdec", "llama-3.1-8b-instant", "qwen/qwen3-32b", "openai/gpt-oss-120b", "deepseek-r1-distill-llama-70b", "deepseek-r1-distill-qwen-32b", "moonshotai/kimi-k2-instruct-0905"],
  mistral: ["mistral-large", "mistral-medium", "mistral-small", "mixtral-8x7b", "mixtral-8x22b"],
  cohere: ["command-r", "command-r-plus", "command-light"],
  deepseek: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner", "deepseek-v2", "deepseek-r1"],
  openrouter: ["meta-llama/llama-3.3-70b-instruct:free", "meta-llama/llama-3.1-405b-instruct:free", "meta-llama/llama-3.1-70b-instruct:free", "deepseek/deepseek-r1:free", "deepseek/deepseek-r1-0528:free", "qwen/qwen-3-235b-a22b:free", "xiaomi/mimo-v2-flash:free", "mistralai/mistral-small-3.1-24b:free", "mistralai/mistral-small-3.2-24b-instruct:free", "mistralai/mistral-nemo:free", "google/gemma-3-27b-instruct:free", "google/gemma-3-12b-instruct:free", "google/gemma-3-4b-instruct:free", "meta-llama/llama-3.1-8b-instruct:free", "meta-llama/llama-3.2-3b-instruct:free", "mistralai/devstral-2512:free", "qwen/qwen-3-coder:free", "deepseek/deepseek-coder-v2:free", "qwen/qwen2.5-vl-7b:free", "nvidia/nemotron-nano-12b-vl:free", "allenai/molmo-8b:free", "mistralai/mistral-7b-instruct:free", "openchat/openchat-3.5-0106:free", "nousresearch/nous-capybara-7b:free", "gryphe/mythomax-l2-13b:free", "meta-llama/llama-3-8b-instruct:free"],
  ollama: [],
  huggingface: [],
  grok: ["grok-3", "grok-3-mini", "grok-2", "grok-vision-beta"],
  puter: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-haiku", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "llama-3.3-70b", "llama-3.1-405b", "llama-3.1-70b", "mistral-large", "mistral-small", "deepseek-chat", "deepseek-coder"],
};
const PROVIDER_LABELS: Record<string, string> = {
  "built-in": "⚡ Built-in", openai: "🔑 OpenAI", claude: "🧠 Claude", gemini: "✨ Gemini",
  groq: "⚡ Groq", mistral: "🌟 Mistral", cohere: "🔷 Cohere", deepseek: "🔍 Deepseek",
  openrouter: "🌐 OpenRouter", ollama: "🦙 Ollama", huggingface: "🤗 HuggingFace", grok: "🤖 Grok", puter: "☁️ Puter",
};

export type ChatInterfaceProps = {
  conversationId: number; messages: ChatMessage[]; attachments: Attachment[];
  isLoading?: boolean; provider?: string; model?: string;
  onSendMessage: (msg: string, attachmentUrls?: string[], provider?: string, model?: string) => void;
  onStreamingDone?: () => void; streamingEnabled?: boolean; className?: string;
  prefillInput?: string; onPrefillConsumed?: () => void;
};

export function ChatInterface({ conversationId, messages, attachments, isLoading = false, provider: extProvider, model: extModel, onSendMessage, onStreamingDone, streamingEnabled = true, className, prefillInput, onPrefillConsumed }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState(extProvider || "puter");
  const [selectedModel, setSelectedModel] = useState(extModel || "claude-sonnet-4-6");
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingUserMsg, setStreamingUserMsg] = useState("");
  const [puterMessages, setPuterMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadMut = trpc.files.uploadAttachment.useMutation();

  // Load Puter messages from localStorage on mount
  useEffect(() => {
    const key = `puter-messages-${conversationId}`;
    const saved = localStorage.getItem(key);
    if (saved && selectedProvider === "puter") {
      const parsed = JSON.parse(saved);
      setPuterMessages(parsed);
      console.log("[Puter Client] Loaded", parsed.length, "messages from storage");
    }
  }, [conversationId, selectedProvider]);

  // Save Puter messages to localStorage
  useEffect(() => {
    if (selectedProvider === "puter" && puterMessages.length > 0) {
      const key = `puter-messages-${conversationId}`;
      localStorage.setItem(key, JSON.stringify(puterMessages));
      console.log("[Puter Client] Saved", puterMessages.length, "messages to storage");
    }
  }, [puterMessages, conversationId, selectedProvider]);

  // Persist provider/model selection globally
  useEffect(() => {
    const saved = localStorage.getItem('global-provider-model');
    if (saved) {
      const { provider, model } = JSON.parse(saved);
      setSelectedProvider(provider);
      setSelectedModel(model);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('global-provider-model', JSON.stringify({ provider: selectedProvider, model: selectedModel }));
  }, [selectedProvider, selectedModel]);

  // Handle prefill input from RAG/Templates
  useEffect(() => {
    if (prefillInput) { setInput(prefillInput); onPrefillConsumed?.(); }
  }, [prefillInput]);

  // Ollama auto-detect
  useEffect(() => {
    if (selectedProvider !== "ollama") return;
    fetch("/api/ollama/models", { credentials: "include" })
      .then(r => r.json()).then((d: any) => {
        setOllamaRunning(d.running);
        if (d.running) { setOllamaModels(d.models.map((m: any) => m.name)); if (d.models.length && !selectedModel) setSelectedModel(d.models[0].name); }
      }).catch(() => setOllamaRunning(false));
  }, [selectedProvider]);

  // Auto scroll only if user is at bottom
  useEffect(() => {
    const vp = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement;
    if (vp) {
      const isAtBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 100;
      if (isAtBottom) {
        requestAnimationFrame(() => vp.scrollTo({ top: vp.scrollHeight, behavior: "smooth" }));
      }
    }
  }, [messages, isLoading, streamingContent]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files; if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = async ev => {
        try {
          const b64 = (ev.target?.result as string).split(",")[1];
          const r = await uploadMut.mutateAsync({ conversationId, fileName: file.name, fileType: file.type.split("/")[0], fileSize: file.size, mimeType: file.type, base64Data: b64 });
          setSelectedAttachments(prev => [...prev, { id: r.attachmentId, fileName: file.name, fileType: file.type.split("/")[0], mimeType: file.type, storageUrl: r.url }]);
          toast.success(`${file.name} uploaded`);
        } catch { toast.error(`Failed to upload ${file.name}`); }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStreamingSend = useCallback(async (message: string, attachmentUrls?: string[]) => {
    // Use Puter.js for client-side if provider is puter
    if (selectedProvider === "puter" && typeof window !== "undefined" && (window as any).puter) {
      console.log("[Puter Client] Starting stream - Model:", selectedModel);
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingUserMsg(message);
      const ctrl = new AbortController(); 
      abortRef.current = ctrl;
      
      try {
        // Claude models have built-in web search - just ask naturally
        const response = await (window as any).puter.ai.chat(message, {
          model: selectedModel || "claude-sonnet-4-6",
          stream: true
        });
        
        let full = "";
        let chunkCount = 0;
        for await (const part of response) {
          if (ctrl.signal.aborted) {
            console.log("[Puter Client] Stream aborted by user");
            break;
          }
          if (part?.text) {
            full += part.text;
            chunkCount++;
            setStreamingContent(full);
          }
        }
        
        console.log("[Puter Client] Stream complete. Chunks:", chunkCount, "Length:", full.length);
        console.log("[Puter Client] Final content:", full.substring(0, 100));
        
        // Keep the content visible - save to puterMessages
        if (!ctrl.signal.aborted && full) {
          console.log("[Puter Client] Saving to puterMessages");
          setPuterMessages(prev => [
            ...prev,
            { role: "user", content: message },
            { role: "assistant", content: full, model: selectedModel }
          ]);
          setStreamingContent("");
          setStreamingUserMsg("");
        }
      } catch (e) {
        console.error("[Puter Client] Error:", e);
        if ((e as Error).name !== "AbortError") {
          toast.error(e instanceof Error ? e.message : "Puter failed");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
      return;
    }
    
    // Server-side streaming for other providers
    console.log("[Server Stream] Provider:", selectedProvider, "Model:", selectedModel);
    setIsStreaming(true); setStreamingContent("");
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const resp = await fetch("/api/stream/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message, provider: selectedProvider, model: selectedModel || undefined, attachmentUrls }),
        signal: ctrl.signal,
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({ error: "Stream failed" })) as any; throw new Error(e.error || `HTTP ${resp.status}`); }
      const reader = resp.body!.getReader(); const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim(); if (!t.startsWith("data: ")) continue;
          const d = t.slice(6); if (d === "[DONE]") break;
          try {
            const p = JSON.parse(d) as any;
            if (p.type === "delta" && p.content) { full += p.content; setStreamingContent(full); }
            else if (p.type === "error") throw new Error(p.error || "Stream error");
          } catch (pe) { if (pe instanceof Error && pe.message !== "Stream error") continue; throw pe; }
        }
      }
      onStreamingDone?.();
    } catch (e) {
      if ((e as Error).name !== "AbortError") { toast.error(e instanceof Error ? e.message : "Stream failed"); onSendMessage(message, attachmentUrls, selectedProvider, selectedModel || undefined); }
    } finally { setIsStreaming(false); setStreamingContent(""); abortRef.current = null; }
  }, [conversationId, selectedProvider, selectedModel, onSendMessage, onStreamingDone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim(); if (!msg || isLoading || isStreaming) return;
    const urls = selectedAttachments.map(a => a.storageUrl);
    const userMessage = msg;
    setInput(""); 
    setSelectedAttachments([]);
    
    // For Puter, add user message to display immediately
    if (selectedProvider === "puter") {
      console.log("[Puter Client] User message:", userMessage);
    }
    
    if (streamingEnabled) handleStreamingSend(userMessage, urls);
    else onSendMessage(userMessage, urls, selectedProvider, selectedModel || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  const displayMessages = messages.filter(m => m.role !== "system");
  const effectiveLoading = isLoading || isStreaming;
  const availableModels = selectedProvider === "ollama" ? ollamaModels : PROVIDER_MODELS[selectedProvider] || [];

  // Show user input as message immediately for Puter
  const allDisplayMessages = selectedProvider === "puter" 
    ? [...puterMessages] 
    : [...displayMessages];
  
  if (selectedProvider === "puter" && streamingUserMsg && isStreaming) {
    allDisplayMessages.push({ role: "user", content: streamingUserMsg });
  }
  
  console.log("[Puter Client] Displaying", allDisplayMessages.length, "messages");

  return (
    <div className={cn("flex flex-col bg-card text-card-foreground h-full", className)}>
      {/* Provider bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 flex-wrap">
        <Select value={selectedProvider} onValueChange={v => { setSelectedProvider(v); setSelectedModel(""); }}>
          <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PROVIDER_LABELS).map(([id, label]) => <SelectItem key={id} value={id} className="text-xs">{label}</SelectItem>)}</SelectContent>
        </Select>
        {availableModels.length > 0 && (
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-52 h-7 text-xs"><SelectValue placeholder="Default model" /></SelectTrigger>
            <SelectContent>{availableModels.map(m => <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {selectedProvider === "ollama" && ollamaRunning === false && <span className="text-xs text-destructive">⚠️ Ollama not running</span>}
        {selectedProvider === "ollama" && ollamaRunning === true && <span className="text-xs text-emerald-600">🦙 Local • Private • {ollamaModels.length} models</span>}
        {selectedProvider === "claude" && <span className="text-xs text-blue-600">🌐 Web search • 📎 Images/PDFs</span>}
        {selectedProvider === "gemini" && <span className="text-xs text-purple-600">🌐 Web search • 📎 All files + ZIP</span>}
        {selectedProvider === "openai" && <span className="text-xs text-green-600">🌐 Web search • 📎 Images/Docs</span>}
        {selectedProvider === "groq" && <span className="text-xs text-yellow-600">⚡ Ultra-fast inference</span>}
        {selectedProvider === "mistral" && <span className="text-xs text-indigo-600">🇫🇷 European AI</span>}
        {selectedProvider === "cohere" && <span className="text-xs text-teal-600">📚 Enterprise RAG</span>}
        {selectedProvider === "deepseek" && <span className="text-xs text-orange-600">💻 Code specialist</span>}
        {selectedProvider === "openrouter" && <span className="text-xs text-pink-600">🌐 All models • Unified API</span>}
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          {streamingEnabled && <><Zap className="size-3 text-yellow-500" />Live</>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-hidden">
        {allDisplayMessages.length === 0 && !streamingContent ? (
          <div className="flex h-full items-center justify-center flex-col gap-3 text-muted-foreground">
            <Sparkles className="size-12 opacity-15" />
            <p className="text-sm font-medium">Start a conversation</p>
            <p className="text-xs opacity-50">{PROVIDER_LABELS[selectedProvider] || selectedProvider}</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {allDisplayMessages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end items-start" : "justify-start items-start")}>
                  {msg.role === "assistant" && <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center"><Sparkles className="size-3.5 text-primary" /></div>}
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 group relative", msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                    {msg.role === "assistant" ? (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none"><Streamdown>{msg.content}</Streamdown></div>
                        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedId(`m${i}`); setTimeout(() => setCopiedId(null), 2000); }} className="size-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-accent">
                            {copiedId === `m${i}` ? <Check className="size-3" /> : <Copy className="size-3 text-muted-foreground" />}
                          </button>
                          <button onClick={() => { const blob = new Blob([msg.content], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `message-${i}.md`; a.click(); URL.revokeObjectURL(url); }} className="size-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-accent">
                            <svg className="size-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </button>
                        </div>
                        {msg.model && <p className="text-xs text-muted-foreground/50 mt-1 font-mono">{msg.model}</p>}
                      </>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedId(`m${i}`); setTimeout(() => setCopiedId(null), 2000); }} className="absolute -top-2 -right-2 size-6 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent">
                          {copiedId === `m${i}` ? <Check className="size-3" /> : <Copy className="size-3 text-muted-foreground" />}
                        </button>
                      </>
                    )}
                  </div>
                  {msg.role === "user" && <div className="size-7 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center"><User className="size-3.5 text-secondary-foreground" /></div>}
                </div>
              ))}
              {isStreaming && streamingContent && (
                <div className="flex gap-3 justify-start items-start">
                  <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center animate-pulse"><Sparkles className="size-3.5 text-primary" /></div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 bg-muted group relative">
                    <div className="prose prose-sm dark:prose-invert max-w-none"><Streamdown>{streamingContent}</Streamdown></div>
                    <div className="text-xs text-muted-foreground/50 mt-1 flex items-center gap-1"><Loader2 className="size-3 animate-spin" />thinking...</div>
                    <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { navigator.clipboard.writeText(streamingContent); toast.success("Copied!"); }} className="size-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-accent">
                        <Copy className="size-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => { const blob = new Blob([streamingContent], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "response.md"; a.click(); URL.revokeObjectURL(url); }} className="size-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-accent">
                        <svg className="size-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!isStreaming && streamingContent && selectedProvider === "puter" && (
                <div className="flex gap-3 justify-start items-start">
                  <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center"><Sparkles className="size-3.5 text-primary" /></div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 bg-muted">
                    <div className="prose prose-sm dark:prose-invert max-w-none"><Streamdown>{streamingContent}</Streamdown></div>
                  </div>
                </div>
              )}
              {isLoading && !isStreaming && (
                <div className="flex items-start gap-3">
                  <div className="size-7 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center animate-pulse"><Sparkles className="size-3.5 text-primary" /></div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 flex items-center gap-2"><Loader2 className="size-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">thinking...</span></div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Attachments */}
      {selectedAttachments.length > 0 && (
        <div className="border-t px-4 py-2 flex flex-wrap gap-2">
          {selectedAttachments.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
              <FileText className="size-3.5" /><span className="truncate max-w-xs text-xs">{a.fileName}</span>
              <button onClick={() => setSelectedAttachments(p => p.filter(x => x.id !== a.id))} className="hover:text-destructive ml-1"><X className="size-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-background/80 backdrop-blur">
        <div className="flex gap-2">
          <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Message ${PROVIDER_LABELS[selectedProvider]}… (Shift+Enter for newline)`} className="flex-1 max-h-28 resize-none min-h-[2.5rem]" rows={1} disabled={effectiveLoading} />
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
          <Button type="button" size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={effectiveLoading} className="shrink-0 size-9"><Paperclip className="size-4" /></Button>
          {isStreaming ? (
            <Button type="button" size="icon" variant="destructive" onClick={() => abortRef.current?.abort()} className="shrink-0 size-9"><StopCircle className="size-4" /></Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim() || effectiveLoading} className="shrink-0 size-9">
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
