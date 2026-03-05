import { useState, useEffect, useCallback } from "react";
import { skipToken } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
import { CommandPalette } from "@/components/CommandPalette";
import { AgentPanel } from "@/components/AgentPanel";
import { TaskMonitor } from "@/components/TaskMonitor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Loader2, MessageSquare, Settings, BarChart3, Plus, Sparkles,
  BookOpen, Database, Image, BarChart, Terminal, Sun, Moon,
  LogOut, User, ChevronDown, Users, Clock, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [pendingUserPrompt, setPendingUserPrompt] = useState<string | null>(null);

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
  const trpcUtils = trpc.useUtils();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: async () => {
      if (selectedConversationId) {
        await conversationQuery.refetch();
        setOptimisticMessages([]);
      }
    },
  });

  useEffect(() => {
    if (conversationsQuery.data?.length && selectedConversationId === null) {
      const first = conversationsQuery.data[0]?.id;
      if (first) setSelectedConversationId(first);
    }
  }, [conversationsQuery.data?.length, selectedConversationId]);

  // Keyboard shortcut: Cmd/Ctrl+N = new chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleCreateConversation();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") { e.preventDefault(); setActiveTab("chat"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") { e.preventDefault(); setActiveTab("code"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "3") { e.preventDefault(); setActiveTab("templates"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => window.location.reload()} />;
  }

  const handleCreateConversation = async (opts?: { systemPrompt?: string }) => {
    try {
      const result = await createConvMutation.mutateAsync({
        title: "New Conversation",
        systemPrompt: opts?.systemPrompt,
      });
      setSelectedConversationId(result.id);
      setOptimisticMessages([]);
      setActiveTab("chat");
      return result.id;
    } catch {
      toast.error("Failed to create conversation");
      return null;
    }
  };

  const handleSendMessage = async (
    message: string,
    attachmentUrls?: string[],
    provider?: string,
    model?: string
  ) => {
    if (!selectedConversationId) return;
    setOptimisticMessages(prev => [...prev, { role: "user", content: message }]);
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        message,
        provider,
        model,
        attachmentUrls,
      });
    } catch {
      setOptimisticMessages([]);
      toast.error("Failed to send message");
    }
  };

  const handleStreamingDone = async () => {
    if (selectedConversationId) {
      await conversationQuery.refetch();
      setOptimisticMessages([]);
    }
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
      const result = await trpcUtils.chat.exportConversation.fetch({
        id: selectedConversationId,
        format,
      });
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  };

  const currentConversation = conversationQuery.data?.conversation || null;
  const dbMessages = conversationQuery.data?.messages || [];
  const attachments = conversationQuery.data?.attachments || [];
  const allMessages: ChatMessage[] = dbMessages.length > 0
    ? (dbMessages as unknown as ChatMessage[])
    : optimisticMessages;

  const userInitial = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
      {/* Command Palette */}
      <CommandPalette 
        onNewChat={handleCreateConversation}
        onNavigate={setActiveTab}
        onExecuteAgent={(agent) => {
          setActiveTab("agents");
          toast.success(`${agent} agent activated`);
        }}
      />

      {/* Sidebar with glassmorphism */}
      <div className="w-64 border-r backdrop-blur-xl bg-card/80 flex flex-col shrink-0 shadow-lg">
        {/* Sidebar header */}
        <div className="p-3 border-b backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="size-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-md">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm truncate bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">AI MODERN PRO</span>
          </div>
          <Button
            onClick={() => handleCreateConversation()}
            className="w-full shadow-sm hover:shadow-md transition-shadow"
            size="sm"
          >
            <Plus className="size-4 mr-2" />New Chat
            <span className="ml-auto text-xs opacity-60 font-mono">⌘N</span>
          </Button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-hidden p-2">
          <SearchHistory
            onSelectConversation={(id) => {
              setSelectedConversationId(id);
              setOptimisticMessages([]);
              setActiveTab("chat");
            }}
          />
        </div>

        {/* Sidebar footer - user */}
        <div className="p-3 border-t backdrop-blur-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full rounded-lg p-2 hover:bg-accent/50 transition-all hover:shadow-sm text-left">
                <Avatar className="size-8 shrink-0 ring-2 ring-primary/20">
                  <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-none">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email || ""}</p>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setActiveTab("settings")}>
                <Settings className="mr-2 size-4" />Profile & Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark"
                  ? <><Sun className="mr-2 size-4" />Light Mode</>
                  : <><Moon className="mr-2 size-4" />Dark Mode</>
                }
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 size-4" />Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main area with glassmorphism */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with gradient */}
        <div className="border-b backdrop-blur-xl bg-card/80 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="min-w-0 flex items-center gap-3">
            <div className="min-w-0">
              <h1 className="font-semibold truncate leading-none">
                {currentConversation?.title || "AI Assistant"}
              </h1>
              {currentConversation?.provider && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentConversation.provider}
                  {currentConversation.model ? ` · ${currentConversation.model}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 shadow-sm hover:shadow-md transition-shadow"
                  onClick={() => {}}
                >
                  <Zap className="size-3" />
                  ⌘K
                </Button>
              </TooltipTrigger>
              <TooltipContent>Command Palette</TooltipContent>
            </Tooltip>
            {selectedConversationId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                    Export
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("markdown")}>
                    Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("txt")}>
                    Export as Text
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tabs navigation with modern styling */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b backdrop-blur-sm bg-background/50 px-2 h-10 shrink-0 overflow-x-auto gap-0.5">
            <TabsTrigger value="chat" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <MessageSquare className="size-3.5" />Chat
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <Users className="size-3.5" />Agents
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <Clock className="size-3.5" />Tasks
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <Terminal className="size-3.5" />Code
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <BookOpen className="size-3.5" />Templates
            </TabsTrigger>
            <TabsTrigger value="rag" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <Database className="size-3.5" />RAG
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <Image className="size-3.5" />Images
            </TabsTrigger>
            <TabsTrigger value="benchmark" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <BarChart className="size-3.5" />Benchmark
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <BarChart3 className="size-3.5" />Usage
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <Settings className="size-3.5" />Settings
            </TabsTrigger>
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
                <div className="text-center space-y-4 max-w-xs">
                  <div className="size-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-8 text-primary/60" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Start a conversation</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      {conversationsQuery.isLoading
                        ? "Loading conversations…"
                        : "Create a new chat to get started with any AI model"}
                    </p>
                  </div>
                  <Button onClick={() => handleCreateConversation()} size="sm">
                    <Plus className="size-4 mr-1" />New Chat
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tip: Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⌘N</kbd> for a new chat
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="agents" className="flex-1 overflow-auto p-4 m-0">
            <AgentPanel />
          </TabsContent>

          <TabsContent value="tasks" className="flex-1 overflow-auto p-4 m-0">
            <TaskMonitor />
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
