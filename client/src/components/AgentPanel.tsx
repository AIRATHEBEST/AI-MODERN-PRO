import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orchestrator, type Agent, type Task, type AgentMessage } from "@/lib/agentOrchestrator";
import { Search, Code, TrendingUp, FileText, Brain, Play, CheckCircle2, Clock, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const AGENT_ICONS = {
  researcher: Search,
  coder: Code,
  analyst: TrendingUp,
  writer: FileText,
  planner: Brain
};

const AGENT_COLORS = {
  researcher: "text-blue-500",
  coder: "text-green-500",
  analyst: "text-purple-500",
  writer: "text-orange-500",
  planner: "text-pink-500"
};

export function AgentPanel() {
  const [taskDescription, setTaskDescription] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Task[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [agents] = useState<Agent[]>(orchestrator.getAllAgents());

  const handleExecute = async () => {
    if (!taskDescription.trim()) return;
    
    setIsExecuting(true);
    try {
      const result = await orchestrator.executeTask(taskDescription);
      setCurrentPlan(result.plan);
      setMessages(result.messages);
    } catch (error) {
      console.error("Agent execution failed:", error);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="size-4 text-green-500" />;
      case "running": return <Clock className="size-4 text-blue-500 animate-spin" />;
      case "failed": return <AlertCircle className="size-4 text-red-500" />;
      default: return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Multi-Agent Orchestration
          </CardTitle>
          <CardDescription>
            Coordinate multiple AI agents to solve complex tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Description</label>
            <Textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Describe a complex task that requires multiple agents... e.g., 'Research the latest AI trends, analyze the data, and write a comprehensive report'"
              rows={4}
              disabled={isExecuting}
            />
          </div>
          <Button 
            onClick={handleExecute} 
            disabled={!taskDescription.trim() || isExecuting}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Clock className="size-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="size-4 mr-2" />
                Execute Multi-Agent Task
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="plan">Execution Plan</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-3">
          {agents.map((agent) => {
            const Icon = AGENT_ICONS[agent.role];
            const colorClass = AGENT_COLORS[agent.role];
            
            return (
              <Card key={agent.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("size-5", colorClass)} />
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {agent.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {agent.systemPrompt}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground pt-1">
                    Model: {agent.model}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="plan">
          {currentPlan.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No execution plan yet. Start a task to see the plan.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {currentPlan.map((task, idx) => (
                <Card key={task.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            Step {idx + 1}
                          </span>
                          {task.assignedAgent && (
                            <Badge variant="outline" className="text-xs">
                              {task.assignedAgent}
                            </Badge>
                          )}
                          <Badge 
                            variant={
                              task.status === "completed" ? "default" :
                              task.status === "running" ? "secondary" :
                              task.status === "failed" ? "destructive" :
                              "outline"
                            }
                            className="text-xs"
                          >
                            {task.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                        {task.result && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ {task.result}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No messages yet. Agents will communicate here during execution.
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {messages.map((msg, idx) => {
                  const FromIcon = msg.from === "orchestrator" ? Users : AGENT_ICONS[msg.from as keyof typeof AGENT_ICONS];
                  const fromColor = msg.from === "orchestrator" ? "text-gray-500" : AGENT_COLORS[msg.from as keyof typeof AGENT_COLORS];
                  
                  return (
                    <Card key={idx}>
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <FromIcon className={cn("size-4 mt-0.5 shrink-0", fromColor)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium capitalize">
                                {msg.from}
                              </span>
                              <span className="text-xs text-muted-foreground">→</span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {msg.to}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {msg.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
