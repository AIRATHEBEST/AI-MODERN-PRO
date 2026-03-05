import { useState, useEffect, useCallback } from "react";
import { skipToken } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { LoginPage } from "@/components/LoginPage";
import { trpc } from "@/lib/trpc";
import { ChatInterface, type ChatMessage } from "@/components/ChatInterface";
import { SearchHistory } from "@/components/SearchHistory";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UsageDashboard } from "@/components/UsageDashboard";
import { PromptTemplates } from "@/components/PromptTemplates";
import { RagPanel } from "@/components/RagPanel";
import { ImageGenPanel } from "@/components/ImageGenPanel";
import { BenchmarkPanel } from "@/components/BenchmarkPanel";
import { CodeExecutor } from "@/components/CodeExecutor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, MessageSquare, Settings, BarChart3, Plus, Sparkles, BookTemplate, Database, Image, BarChart, Terminal, Download } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [pendingSystemPrompt, setPendingSystemPrompt] = useState<string | null>(null);
  const [pendingUserPrompt, setPendingUserPrompt] = useState<string | null>(null);

  const conversationsQuery = trpc.chat.getConversations.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30000 });
  const conversationQuery = trpc.chat.getConversation.useQuery(
    selectedConversationId ? { id: selectedConversationId } : skipToken,
    { enabled: isAuthenticated && selectedConversationId !== null }
  );
  const createConvMutation = trpc.chat.createConversation.useMutation({ onSuccess: () => conversationsQuery.refetch() });
  const trpcUtils = trpc.useUtils();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: async () => { if (selectedConversationId) { await conversationQuery.refetch(); setOptimisticMessages([]); } },
  });

  useEffect(() => {
    if (conversationsQuery.data?.length && selectedConversationId === null) {
      const first = conversationsQuery.data[0]?.id;
      if (first) setSelectedConversationId(first);
    }
  }, [conversationsQuery.data?.length, selectedConversationId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="size-8 animate-spin" /></div>;

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => window.location.reload()} />;
  }

  const handleCreateConversation = async (opts?: { systemPrompt?: string }) => {
    try {
      const result = await createConvMutation.mutateAsync({ title: "New Conversation", systemPrompt: opts?.systemPrompt });
      setSelectedConversationId(result.id);
      setOptimisticMessages([]);
      setActiveTab("chat");
      return result.id;
    } catch { toast.error("Failed to create conversation"); return null; }
  };

  const handleSendMessage = async (message: string, attachmentUrls?: string[], provider?: string, model?: string) => {
    if (!selectedConversationId) return;
    setOptimisticMessages(prev => [...prev, { role: "user", content: message }]);
    try {
      await sendMessageMutation.mutateAsync({ conversationId: selectedConversationId, message, provider, model, attachmentUrls });
    } catch { setOptimisticMessages([]); toast.error("Failed to send message"); }
  };

  const handleStreamingDone = async () => {
    if (selectedConversationId) { await conversationQuery.refetch(); setOptimisticMessages([]); }
  };

  const handleUseTemplate = async (systemPrompt: string, userPrompt?: string) => {
    const id = await handleCreateConversation({ systemPrompt });
    if (id) {
      setActiveTab("chat");
      if (userPrompt) setPendingUserPrompt(userPrompt);
      toast.success("Template applied — new conversation created");
    }
  };

  const handleInjectContext = async (context: string) => {
    let convId = selectedConversationId;
    if (!convId) { convId = await handleCreateConversation(); }
    if (!convId) return;
    setActiveTab("chat");
    setPendingUserPrompt(context);
  };

  const handleExport = async (format: "markdown" | "json" | "txt") => {
    if (!selectedConversationId) return;
    try {
      const result = await trpcUtils.chat.exportConversation.fetch({ id: selectedConversationId, format });
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch { toast.error("Export failed"); }
  };

  const currentConversation = conversationQuery.data?.conversation || null;
  const dbMessages = conversationQuery.data?.messages || [];
  const attachments = conversationQuery.data?.attachments || [];
  const allMessages: ChatMessage[] = (dbMessages.length > 0 ? dbMessages as unknown as ChatMessage[] : optimisticMessages);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-3 border-b space-y-1.5">
          <Button onClick={() => handleCreateConversation()} className="w-full" size="sm">
            <Plus className="size-4 mr-2" />New Chat
          </Button>
          {selectedConversationId && (
            <div className="flex gap-1">
              {(["markdown","json","txt"] as const).map(fmt => (
                <Button key={fmt} size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => handleExport(fmt)}>
                  .{fmt === "markdown" ? "md" : fmt}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden p-2">
          <SearchHistory onSelectConversation={(id) => { setSelectedConversationId(id); setOptimisticMessages([]); setActiveTab("chat"); }} />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{currentConversation?.title || "AI Assistant"}</h1>
            {currentConversation?.provider && (
              <p className="text-xs text-muted-foreground">{currentConversation.provider}{currentConversation.model ? ` · ${currentConversation.model}` : ""}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-background px-4 h-10 shrink-0 overflow-x-auto">
            <TabsTrigger value="chat" className="gap-1.5 text-xs"><MessageSquare className="size-3.5" />Chat</TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5 text-xs"><Terminal className="size-3.5" />Code</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs"><BookTemplate className="size-3.5" />Templates</TabsTrigger>
            <TabsTrigger value="rag" className="gap-1.5 text-xs"><Database className="size-3.5" />RAG</TabsTrigger>
            <TabsTrigger value="images" className="gap-1.5 text-xs"><Image className="size-3.5" />Images</TabsTrigger>
            <TabsTrigger value="benchmark" className="gap-1.5 text-xs"><BarChart className="size-3.5" />Benchmark</TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5 text-xs"><BarChart3 className="size-3.5" />Usage</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings className="size-3.5" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 overflow-hidden p-0 m-0">
            {selectedConversationId ? (
              <ChatInterface
                conversationId={selectedConversationId}
                messages={allMessages}
                attachments={attachments}
                isLoading={sendMessageMutation.isPending}
                provider={currentConversation?.provider || undefined}
                model={currentConversation?.model || undefined}
                onSendMessage={handleSendMessage}
                onStreamingDone={handleStreamingDone}
                streamingEnabled={true}
                prefillInput={pendingUserPrompt || undefined}
                onPrefillConsumed={() => setPendingUserPrompt(null)}
                className="rounded-none border-0"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <Sparkles className="size-12 mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">
                    {conversationsQuery.isLoading ? "Loading…" : "Create a new conversation to get started"}
                  </p>
                  <Button onClick={() => handleCreateConversation()} size="sm">
                    <Plus className="size-4 mr-1" />New Chat
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="flex-1 overflow-hidden p-4 m-0">
            <CodeExecutor />
          </TabsContent>

          <TabsContent value="templates" className="flex-1 overflow-auto p-4 m-0">
            <PromptTemplates onUseTemplate={handleUseTemplate} />
          </TabsContent>

          <TabsContent value="rag" className="flex-1 overflow-auto p-4 m-0">
            <RagPanel onInjectContext={handleInjectContext} />
          </TabsContent>

          <TabsContent value="images" className="flex-1 overflow-auto p-4 m-0">
            <ImageGenPanel />
          </TabsContent>

          <TabsContent value="benchmark" className="flex-1 overflow-auto p-4 m-0">
            <BenchmarkPanel />
          </TabsContent>

          <TabsContent value="usage" className="flex-1 overflow-auto p-4 m-0">
            <UsageDashboard />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto p-4 m-0">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
