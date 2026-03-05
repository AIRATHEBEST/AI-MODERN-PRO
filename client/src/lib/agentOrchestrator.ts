/**
 * Multi-Agent Orchestration System
 * Coordinates multiple AI agents for complex tasks
 */

export type AgentRole = "researcher" | "coder" | "analyst" | "writer" | "planner";

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  systemPrompt: string;
  capabilities: string[];
  provider?: string;
  model?: string;
}

export interface Task {
  id: string;
  description: string;
  assignedAgent?: AgentRole;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  dependencies?: string[];
  priority: number;
}

export interface AgentMessage {
  from: AgentRole;
  to: AgentRole | "orchestrator";
  content: string;
  timestamp: Date;
}

export class AgentOrchestrator {
  private agents: Map<AgentRole, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private messages: AgentMessage[] = [];

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents() {
    const agents: Agent[] = [
      {
        id: "researcher-1",
        role: "researcher",
        name: "Research Agent",
        systemPrompt: "You are a research specialist. Gather information from multiple sources, synthesize findings, and provide comprehensive analysis with citations.",
        capabilities: ["web_search", "source_analysis", "citation", "summarization"],
        provider: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct:free"
      },
      {
        id: "coder-1",
        role: "coder",
        name: "Code Agent",
        systemPrompt: "You are a full-stack developer. Write clean, production-ready code with tests. Debug issues and optimize performance.",
        capabilities: ["code_generation", "debugging", "testing", "optimization"],
        provider: "openrouter",
        model: "deepseek/deepseek-coder-v2:free"
      },
      {
        id: "analyst-1",
        role: "analyst",
        name: "Data Analyst",
        systemPrompt: "You are a data analyst. Process data, create visualizations, identify trends, and generate insights.",
        capabilities: ["data_processing", "visualization", "trend_analysis", "reporting"],
        provider: "openrouter",
        model: "qwen/qwen-3-235b-a22b:free"
      },
      {
        id: "writer-1",
        role: "writer",
        name: "Content Writer",
        systemPrompt: "You are a professional writer. Create engaging content, optimize for SEO, and maintain consistent tone.",
        capabilities: ["content_creation", "seo", "editing", "copywriting"],
        provider: "openrouter",
        model: "mistralai/mistral-small-3.2-24b-instruct:free"
      },
      {
        id: "planner-1",
        role: "planner",
        name: "Task Planner",
        systemPrompt: "You are a strategic planner. Break down complex tasks into steps, identify dependencies, and optimize execution order.",
        capabilities: ["task_decomposition", "planning", "optimization", "coordination"],
        provider: "openrouter",
        model: "deepseek/deepseek-r1:free"
      }
    ];

    agents.forEach(agent => this.agents.set(agent.role, agent));
  }

  async executeTask(description: string): Promise<{ plan: Task[], messages: AgentMessage[] }> {
    // Step 1: Planner decomposes task
    const plan = await this.planTask(description);
    
    // Step 2: Execute tasks in order
    for (const task of plan) {
      await this.executeSubTask(task);
    }

    return { plan, messages: this.messages };
  }

  private async planTask(description: string): Promise<Task[]> {
    const planner = this.agents.get("planner");
    if (!planner) throw new Error("Planner agent not found");

    // Simulate planning (in real implementation, call LLM)
    const tasks: Task[] = [
      {
        id: "task-1",
        description: `Research: ${description}`,
        assignedAgent: "researcher",
        status: "pending",
        priority: 1
      },
      {
        id: "task-2",
        description: `Analyze findings`,
        assignedAgent: "analyst",
        status: "pending",
        dependencies: ["task-1"],
        priority: 2
      },
      {
        id: "task-3",
        description: `Generate output`,
        assignedAgent: "writer",
        status: "pending",
        dependencies: ["task-2"],
        priority: 3
      }
    ];

    tasks.forEach(task => this.tasks.set(task.id, task));
    return tasks;
  }

  private async executeSubTask(task: Task): Promise<void> {
    if (!task.assignedAgent) return;
    
    const agent = this.agents.get(task.assignedAgent);
    if (!agent) return;

    task.status = "running";
    
    this.messages.push({
      from: "planner",
      to: task.assignedAgent,
      content: `Execute: ${task.description}`,
      timestamp: new Date()
    });

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    task.status = "completed";
    task.result = `Completed by ${agent.name}`;

    this.messages.push({
      from: task.assignedAgent,
      to: "orchestrator",
      content: `Task completed: ${task.description}`,
      timestamp: new Date()
    });
  }

  getAgent(role: AgentRole): Agent | undefined {
    return this.agents.get(role);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getTaskStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getMessages(): AgentMessage[] {
    return this.messages;
  }
}

export const orchestrator = new AgentOrchestrator();
