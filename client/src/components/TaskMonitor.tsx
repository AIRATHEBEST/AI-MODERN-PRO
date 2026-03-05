import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { taskScheduler, type ScheduledTask } from "@/lib/taskScheduler";
import { Clock, CheckCircle2, XCircle, Loader2, X, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskMonitor() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [maxConcurrent, setMaxConcurrent] = useState(3);

  useEffect(() => {
    const unsubscribe = taskScheduler.subscribe(setTasks);
    return unsubscribe;
  }, []);

  const queuedTasks = tasks.filter(t => t.status === "queued");
  const runningTasks = tasks.filter(t => t.status === "running");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const failedTasks = tasks.filter(t => t.status === "failed");

  const getStatusIcon = (status: ScheduledTask["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="size-4 text-green-500" />;
      case "running": return <Loader2 className="size-4 text-blue-500 animate-spin" />;
      case "failed": return <XCircle className="size-4 text-red-500" />;
      case "cancelled": return <X className="size-4 text-gray-500" />;
      default: return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: ScheduledTask["priority"]) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return "-";
    const endTime = end || new Date();
    const ms = endTime.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Background Tasks</CardTitle>
              <CardDescription>Monitor and manage scheduled tasks</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Max Concurrent:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 5].map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={maxConcurrent === n ? "default" : "outline"}
                    onClick={() => {
                      setMaxConcurrent(n);
                      taskScheduler.setMaxConcurrent(n);
                    }}
                    className="h-7 w-8 p-0"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{queuedTasks.length}</div>
              <div className="text-xs text-muted-foreground">Queued</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{runningTasks.length}</div>
              <div className="text-xs text-muted-foreground">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{failedTasks.length}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No tasks scheduled yet
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getStatusIcon(task.status)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{task.name}</span>
                        <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                          {task.priority}
                        </Badge>
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
                        {task.status === "queued" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => taskScheduler.cancel(task.id)}
                            className="h-6 px-2 ml-auto"
                          >
                            <X className="size-3" />
                          </Button>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {task.description}
                      </p>

                      {task.status === "running" && task.progress !== undefined && (
                        <div className="space-y-1">
                          <Progress value={task.progress} className="h-1" />
                          <div className="text-xs text-muted-foreground">
                            {task.progress}% complete
                          </div>
                        </div>
                      )}

                      {task.error && (
                        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                          Error: {task.error}
                          {task.retries !== undefined && task.maxRetries !== undefined && (
                            <span className="ml-2">
                              (Retry {task.retries}/{task.maxRetries})
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created: {task.createdAt.toLocaleTimeString()}</span>
                        {task.startedAt && (
                          <span>Duration: {formatDuration(task.startedAt, task.completedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
