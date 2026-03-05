import { useState, useEffect, useCallback } from "react";
import { skipToken } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { ChatInterface, type ChatMessage } from "@/components/ChatInterface";
import { SearchHistory } from "@/components/SearchHistory";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UsageDashboard } from "@/components/UsageDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Settings, BarChart3, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  // Optimistic messages for instant streaming display
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  const conversationsQuery = trpc.chat.getConversations.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const conversationQuery = trpc.chat.getConversation.useQuery(
    selectedConversationId ? { id: selectedConversationId } : skipToken,
    { enabled: isAuthenticated && selectedConversationId !== null }
  );
  const createConvMutation = trpc.chat.createConversation.useMutation({
    onSuccess: () => conversationsQuery.refetch(),
  });
  // Fallback non-streaming mutation
  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: async () => {
      if (selectedConversationId) {
        await conversationQuery.refetch();
        setOptimisticMessages([]);
      }
    },
  });

  useEffect(() => {
    if (conversationsQuery.data && conversationsQuery.data.length > 0 && selectedConversationId === null) {
      const firstId = conversationsQuery.data[0]?.id;
      if (firstId) setSelectedConversationId(firstId);
    }
  }, [conversationsQuery.data?.length, selectedConversationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-center">AI Assistant</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Multi-provider AI: OpenAI · Claude · Gemini · Ollama · Deepseek · Grok · HuggingFace · Puter
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center text-xs text-muted-foreground">
              {["⚡ SSE Streaming", "🦙 Ollama Auto-detect", "📎 File Upload", "🗂 History"].map(f => (
                <span key={f} className="bg-muted px-2 py-0.5 rounded-full">{f}</span>
              ))}
            </div>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full shadow-lg hover:shadow-xl transition-all">
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  const handleCreateConversation = async () => {
    try {
      const result = await createConvMutation.mutateAsync({ title: "New Conversation" });
      setSelectedConversationId(result.id);
      setOptimisticMessages([]);
      setActiveTab("chat");
      toast.success("New conversation created");
    } catch {
      toast.error("Failed to create conversation");
    }
  };

  // Fallback: non-streaming via tRPC
  const handleSendMessage = async (message: string, attachmentUrls?: string[], provider?: string, model?: string) => {
    if (!selectedConversationId) return;
    // Optimistically add user message
    setOptimisticMessages(prev => [...prev, { role: "user", content: message }]);
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        message,
        provider,
        model,
        attachmentUrls,
      });
    } catch (error) {
      setOptimisticMessages([]);
      toast.error("Failed to send message");
    }
  };

  // Streaming callbacks
  const handleStreamingDone = async (_full: string, _provider: string, _model: string) => {
    // Refresh conversation after stream completes to get saved messages
    if (selectedConversationId) {
      await conversationQuery.refetch();
      setOptimisticMessages([]);
    }
  };

  const currentConversation = conversationQuery.data?.conversation || null;
  const dbMessages = conversationQuery.data?.messages || [];
  const attachments = conversationQuery.data?.attachments || [];

  // Merge DB messages with optimistic ones
  const allMessages: ChatMessage[] = dbMessages.length > 0
    ? dbMessages
    : optimisticMessages;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button onClick={handleCreateConversation} className="w-full" size="sm">
            <Plus className="size-4 mr-2" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SearchHistory
            onSelectConversation={(id) => {
              setSelectedConversationId(id);
              setOptimisticMessages([]);
              setActiveTab("chat");
            }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-card p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{currentConversation?.title || "AI Assistant"}</h1>
            {currentConversation?.provider && (
              <p className="text-sm text-muted-foreground">
                {currentConversation.provider}
                {currentConversation.model ? ` · ${currentConversation.model}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-background px-4">
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="size-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="size-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="usage" className="gap-2">
                <BarChart3 className="size-4" />
                Usage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 overflow-hidden p-0">
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
                  className="rounded-none"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm">
                    {conversationsQuery.isLoading ? "Loading…" : "Create a new conversation to get started"}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="flex-1 overflow-hidden p-4">
              <div className="h-full overflow-auto"><SettingsPanel /></div>
            </TabsContent>

            <TabsContent value="usage" className="flex-1 overflow-hidden p-4">
              <div className="h-full overflow-auto"><UsageDashboard /></div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
