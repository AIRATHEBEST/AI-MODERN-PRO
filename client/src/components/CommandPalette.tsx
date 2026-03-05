import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Settings, Plus, Search, Terminal, BookOpen, 
  Database, Image, BarChart, Sparkles, Zap, Users, FileText,
  Code, Brain, Clock, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: string;
}

interface CommandPaletteProps {
  onNewChat?: () => void;
  onNavigate?: (tab: string) => void;
  onExecuteAgent?: (agent: string) => void;
}

export function CommandPalette({ onNewChat, onNavigate, onExecuteAgent }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);

  const commands: Command[] = [
    {
      id: "new-chat",
      label: "New Chat",
      description: "Start a new conversation",
      icon: <Plus className="size-4" />,
      action: () => { onNewChat?.(); setOpen(false); },
      keywords: ["create", "start", "begin"],
      category: "Actions"
    },
    {
      id: "nav-chat",
      label: "Go to Chat",
      icon: <MessageSquare className="size-4" />,
      action: () => { onNavigate?.("chat"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "nav-code",
      label: "Go to Code Executor",
      icon: <Terminal className="size-4" />,
      action: () => { onNavigate?.("code"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "nav-templates",
      label: "Go to Templates",
      icon: <BookOpen className="size-4" />,
      action: () => { onNavigate?.("templates"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "nav-rag",
      label: "Go to RAG",
      icon: <Database className="size-4" />,
      action: () => { onNavigate?.("rag"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "nav-images",
      label: "Go to Image Generation",
      icon: <Image className="size-4" />,
      action: () => { onNavigate?.("images"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "nav-benchmark",
      label: "Go to Benchmark",
      icon: <BarChart className="size-4" />,
      action: () => { onNavigate?.("benchmark"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      icon: <Settings className="size-4" />,
      action: () => { onNavigate?.("settings"); setOpen(false); },
      category: "Navigation"
    },
    {
      id: "agent-researcher",
      label: "Research Agent",
      description: "Deep research with source synthesis",
      icon: <Search className="size-4" />,
      action: () => { onExecuteAgent?.("researcher"); setOpen(false); },
      keywords: ["research", "search", "find", "investigate"],
      category: "Agents"
    },
    {
      id: "agent-coder",
      label: "Code Agent",
      description: "Generate and debug code",
      icon: <Code className="size-4" />,
      action: () => { onExecuteAgent?.("coder"); setOpen(false); },
      keywords: ["code", "program", "develop", "debug"],
      category: "Agents"
    },
    {
      id: "agent-analyst",
      label: "Data Analyst",
      description: "Process and visualize data",
      icon: <TrendingUp className="size-4" />,
      action: () => { onExecuteAgent?.("analyst"); setOpen(false); },
      keywords: ["data", "analyze", "chart", "visualize"],
      category: "Agents"
    },
    {
      id: "agent-writer",
      label: "Content Writer",
      description: "Create engaging content",
      icon: <FileText className="size-4" />,
      action: () => { onExecuteAgent?.("writer"); setOpen(false); },
      keywords: ["write", "content", "blog", "article"],
      category: "Agents"
    },
    {
      id: "agent-planner",
      label: "Task Planner",
      description: "Break down complex tasks",
      icon: <Brain className="size-4" />,
      action: () => { onExecuteAgent?.("planner"); setOpen(false); },
      keywords: ["plan", "organize", "strategy", "breakdown"],
      category: "Agents"
    },
    {
      id: "agent-multi",
      label: "Multi-Agent Task",
      description: "Coordinate multiple agents",
      icon: <Users className="size-4" />,
      action: () => { onExecuteAgent?.("multi"); setOpen(false); },
      keywords: ["team", "collaborate", "multiple", "orchestrate"],
      category: "Agents"
    }
  ];

  const filteredCommands = commands.filter(cmd => {
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some(k => k.includes(searchLower)) ||
      cmd.category.toLowerCase().includes(searchLower)
    );
  });

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(0);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filteredCommands[selected]?.action();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-2xl">
        <div className="flex items-center border-b px-3">
          <Sparkles className="size-4 text-muted-foreground mr-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ESC
          </kbd>
        </div>
        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {category}
                </div>
                {cmds.map((cmd, idx) => {
                  const globalIdx = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelected(globalIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                        globalIdx === selected
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <div className="shrink-0">{cmd.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
            {filteredCommands.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No commands found
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘K</kbd>
            Toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
