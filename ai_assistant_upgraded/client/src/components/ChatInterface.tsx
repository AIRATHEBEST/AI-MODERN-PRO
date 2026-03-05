import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Loader2, Send, User, Sparkles, Paperclip, X, Copy, Check,
  Code, Image as ImageIcon, FileText, Music, Zap, StopCircle,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type ChatMessage = {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string | null;
  model?: string | null;
  createdAt?: Date;
  streaming?: boolean;
};

export type Attachment = {
  id: number;
  fileName: string;
  fileType: string;
  mimeType: string;
  storageUrl: string;
};

const PROVIDER_MODELS: Record<string, string[]> = {
  "built-in": ["gpt-4o-mini"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"],
  claude: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  gemini: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  ollama: [], // dynamically loaded
  huggingface: ["mistralai/Mistral-7B-Instruct-v0.3", "meta-llama/Llama-3.1-8B-Instruct", "google/gemma-2-9b-it", "Qwen/Qwen2.5-7B-Instruct"],
  deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
  grok: ["grok-beta", "grok-vision-beta", "grok-2", "grok-2-mini"],
  puter: ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "claude-3-haiku", "gemini-1.5-flash", "gemini-1.5-pro", "llama-3.1-70b", "mistral-large"],
};

const PROVIDER_LABELS: Record<string, string> = {
  "built-in": "⚡ Built-in",
  openai: "🔑 OpenAI",
  claude: "🧠 Anthropic Claude",
  gemini: "✨ Google Gemini",
  ollama: "🦙 Ollama (Local)",
  huggingface: "🤗 Hugging Face",
  deepseek: "🔍 Deepseek",
  grok: "🤖 Grok (xAI)",
  puter: "☁️ Puter",
};

export type ChatInterfaceProps = {
  conversationId: number;
  messages: ChatMessage[];
  attachments: Attachment[];
  isLoading?: boolean;
  provider?: string;
  model?: string;
  onSendMessage: (message: string, attachmentUrls?: string[], provider?: string, model?: string) => void;
  onStreamingMessage?: (partial: string) => void;
  onStreamingDone?: (full: string, provider: string, model: string) => void;
  streamingEnabled?: boolean;
  className?: string;
};

export function ChatInterface({
  conversationId,
  messages,
  attachments,
  isLoading = false,
  provider: externalProvider,
  model: externalModel,
  onSendMessage,
  onStreamingMessage,
  onStreamingDone,
  streamingEnabled = true,
  className,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState(externalProvider || "built-in");
  const [selectedModel, setSelectedModel] = useState(externalModel || "");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadMutation = trpc.files.uploadAttachment.useMutation();

  const displayMessages = messages.filter((m) => m.role !== "system");
  const effectiveLoading = isLoading || isStreaming;

  // Detect Ollama models when Ollama provider selected
  useEffect(() => {
    if (selectedProvider === "ollama") {
      fetch("/api/ollama/models")
        .then(r => r.json())
        .then((data: { running: boolean; models: Array<{ name: string }> }) => {
          setOllamaRunning(data.running);
          if (data.running) {
            setOllamaModels(data.models.map((m) => m.name));
            if (data.models.length > 0 && !selectedModel) {
              setSelectedModel(data.models[0].name);
            }
          }
        })
        .catch(() => setOllamaRunning(false));
    }
  }, [selectedProvider]);

  // Auto-scroll
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      });
    }
  }, [displayMessages, effectiveLoading, streamingContent]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const base64Data = (event.target?.result as string).split(",")[1];
          const result = await uploadMutation.mutateAsync({
            conversationId,
            fileName: file.name,
            fileType: file.type.split("/")[0],
            fileSize: file.size,
            mimeType: file.type,
            base64Data,
          });

          setSelectedAttachments((prev) => [
            ...prev,
            {
              id: result.attachmentId,
              fileName: file.name,
              fileType: file.type.split("/")[0],
              mimeType: file.type,
              storageUrl: result.url,
            },
          ]);

          toast.success(`${file.name} uploaded`);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      };

      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStreamingSend = useCallback(async (message: string, attachmentUrls?: string[]) => {
    setIsStreaming(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/stream/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message,
          provider: selectedProvider,
          model: selectedModel || undefined,
          attachmentUrls,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Stream failed" })) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let finalModel = selectedModel;
      let finalProvider = selectedProvider;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as {
              type: string;
              content?: string;
              error?: string;
              model?: string;
              provider?: string;
            };

            if (parsed.type === "delta" && parsed.content) {
              full += parsed.content;
              setStreamingContent(full);
              onStreamingMessage?.(full);
            } else if (parsed.type === "done") {
              if (parsed.model) finalModel = parsed.model;
              if (parsed.provider) finalProvider = parsed.provider;
            } else if (parsed.type === "error") {
              throw new Error(parsed.error || "Stream error");
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Stream error") {
              // skip parse errors
            } else {
              throw parseErr;
            }
          }
        }
      }

      onStreamingDone?.(full, finalProvider, finalModel || "");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error(error instanceof Error ? error.message : "Streaming failed");
        // Fallback to non-streaming
        onSendMessage(message, attachmentUrls, selectedProvider, selectedModel || undefined);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  }, [conversationId, selectedProvider, selectedModel, onSendMessage, onStreamingMessage, onStreamingDone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || effectiveLoading) return;

    const attachmentUrls = selectedAttachments.map((a) => a.storageUrl);
    setInput("");
    setSelectedAttachments([]);

    if (streamingEnabled) {
      handleStreamingSend(trimmedInput, attachmentUrls);
    } else {
      onSendMessage(trimmedInput, attachmentUrls, selectedProvider, selectedModel || undefined);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getAttachmentIcon = (fileType: string) => {
    if (fileType === "image") return <ImageIcon className="size-4" />;
    if (fileType === "audio") return <Music className="size-4" />;
    if (fileType === "document" || fileType === "application") return <FileText className="size-4" />;
    return <Paperclip className="size-4" />;
  };

  const availableModels = selectedProvider === "ollama"
    ? ollamaModels
    : PROVIDER_MODELS[selectedProvider] || [];

  return (
    <div className={cn("flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm h-full", className)}>
      {/* Provider + Model selector bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/40 flex-wrap">
        <Select value={selectedProvider} onValueChange={(v) => { setSelectedProvider(v); setSelectedModel(""); }}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
              <SelectItem key={id} value={id} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {availableModels.length > 0 && (
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder={selectedProvider === "ollama" ? "Select model" : "Default model"} />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((m) => (
                <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedProvider === "ollama" && ollamaRunning === false && (
          <span className="text-xs text-destructive flex items-center gap-1">
            ⚠️ Ollama not detected at localhost:11434
          </span>
        )}

        {selectedProvider === "ollama" && ollamaRunning === true && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            ✓ Ollama running · {ollamaModels.length} model{ollamaModels.length !== 1 ? "s" : ""}
          </span>
        )}

        {selectedProvider === "puter" && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            ☁️ 500+ models via Puter
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {streamingEnabled && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="size-3 text-yellow-500" />
              Streaming
            </span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 && !streamingContent ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs opacity-60">{PROVIDER_LABELS[selectedProvider] || selectedProvider}</p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end items-start" : "justify-start items-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="size-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2.5 group relative",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                        <button
                          onClick={() => copyToClipboard(message.content, `msg-${index}`)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedId === `msg-${index}` ? <Check className="size-3" /> : <Copy className="size-3 text-muted-foreground" />}
                        </button>
                        {message.model && (
                          <div className="mt-1 text-xs text-muted-foreground/60 font-mono">{message.model}</div>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                      <User className="size-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Live streaming message */}
              {isStreaming && streamingContent && (
                <div className="flex gap-3 justify-start items-start">
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="max-w-[80%] rounded-lg px-4 py-2.5 bg-muted text-foreground">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Streamdown>{streamingContent}</Streamdown>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground/60 animate-pulse">● streaming…</div>
                  </div>
                </div>
              )}

              {/* Non-streaming loading indicator */}
              {isLoading && !isStreaming && (
                <div className="flex items-start gap-3">
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Attachments */}
      {selectedAttachments.length > 0 && (
        <div className="border-t bg-background/50 p-3 flex flex-wrap gap-2">
          {selectedAttachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
              {getAttachmentIcon(attachment.fileType)}
              <span className="truncate max-w-xs">{attachment.fileName}</span>
              <button
                onClick={() => setSelectedAttachments((prev) => prev.filter((a) => a.id !== attachment.id))}
                className="ml-1 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4 border-t bg-background/50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${PROVIDER_LABELS[selectedProvider] || selectedProvider}… (Shift+Enter for new line)`}
            className="flex-1 max-h-32 resize-none min-h-9"
            rows={1}
            disabled={effectiveLoading}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.md,.py,.ts,.js,.jsx,.tsx,.html,.css,.yaml,.yml,.xml,.zip,.tar,.gz"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={effectiveLoading}
            className="shrink-0"
          >
            <Paperclip className="size-4" />
          </Button>
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleStop}
              className="shrink-0"
            >
              <StopCircle className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || effectiveLoading}
              className="shrink-0"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
