/**
 * Task Scheduler - Background job execution system
 */

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  progress?: number;
  executor: () => Promise<any>;
  retries?: number;
  maxRetries?: number;
}

export class TaskScheduler {
  private queue: ScheduledTask[] = [];
  private running: Map<string, ScheduledTask> = new Map();
  private completed: Map<string, ScheduledTask> = new Map();
  private maxConcurrent = 3;
  private listeners: Set<(tasks: ScheduledTask[]) => void> = new Set();

  schedule(task: Omit<ScheduledTask, "id" | "status" | "createdAt">): string {
    const scheduledTask: ScheduledTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "queued",
      createdAt: new Date(),
      retries: 0,
      maxRetries: task.maxRetries || 3
    };

    this.queue.push(scheduledTask);
    this.sortQueue();
    this.notifyListeners();
    this.processQueue();

    return scheduledTask.id;
  }

  private sortQueue() {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    this.queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const task = this.queue.shift();
      if (!task) break;

      task.status = "running";
      task.startedAt = new Date();
      this.running.set(task.id, task);
      this.notifyListeners();

      this.executeTask(task);
    }
  }

  private async executeTask(task: ScheduledTask) {
    try {
      const result = await task.executor();
      task.result = result;
      task.status = "completed";
      task.completedAt = new Date();
      task.progress = 100;
    } catch (error) {
      task.error = error instanceof Error ? error.message : "Unknown error";
      
      if (task.retries! < task.maxRetries!) {
        task.retries!++;
        task.status = "queued";
        this.queue.unshift(task);
      } else {
        task.status = "failed";
        task.completedAt = new Date();
      }
    } finally {
      this.running.delete(task.id);
      if (task.status === "completed" || task.status === "failed") {
        this.completed.set(task.id, task);
      }
      this.notifyListeners();
      this.processQueue();
    }
  }

  cancel(taskId: string): boolean {
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue[queueIndex];
      task.status = "cancelled";
      this.queue.splice(queueIndex, 1);
      this.completed.set(taskId, task);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.running.get(taskId) || 
           this.completed.get(taskId) || 
           this.queue.find(t => t.id === taskId);
  }

  getAllTasks(): ScheduledTask[] {
    return [
      ...this.queue,
      ...Array.from(this.running.values()),
      ...Array.from(this.completed.values())
    ];
  }

  getRunningTasks(): ScheduledTask[] {
    return Array.from(this.running.values());
  }

  subscribe(listener: (tasks: ScheduledTask[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const allTasks = this.getAllTasks();
    this.listeners.forEach(listener => listener(allTasks));
  }

  updateProgress(taskId: string, progress: number) {
    const task = this.running.get(taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      this.notifyListeners();
    }
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, max);
    this.processQueue();
  }
}

export const taskScheduler = new TaskScheduler();
