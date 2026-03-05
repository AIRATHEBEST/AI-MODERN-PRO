/**
 * Memory System - Context persistence and user preference learning
 */

export interface Memory {
  id: string;
  type: "conversation" | "preference" | "fact" | "skill";
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  importance: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

export interface UserPreference {
  key: string;
  value: any;
  confidence: number;
  learnedFrom: string[];
}

export class MemorySystem {
  private memories: Map<string, Memory> = new Map();
  private preferences: Map<string, UserPreference> = new Map();
  private conversationSummaries: Map<number, string> = new Map();

  addMemory(type: Memory["type"], content: string, metadata: Record<string, any> = {}): string {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const memory: Memory = {
      id,
      type,
      content,
      metadata,
      importance: this.calculateImportance(content, metadata),
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0
    };

    this.memories.set(id, memory);
    this.pruneMemories();
    return id;
  }

  private calculateImportance(content: string, metadata: Record<string, any>): number {
    let score = 0.5;
    
    // Longer content = more important
    if (content.length > 500) score += 0.2;
    
    // Has metadata = more important
    if (Object.keys(metadata).length > 0) score += 0.1;
    
    // Explicit importance flag
    if (metadata.important) score += 0.3;
    
    return Math.min(1, score);
  }

  recall(query: string, limit: number = 5): Memory[] {
    const queryLower = query.toLowerCase();
    const scored = Array.from(this.memories.values())
      .map(memory => ({
        memory,
        score: this.calculateRelevance(memory, queryLower)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Update access stats
    scored.forEach(item => {
      item.memory.lastAccessed = new Date();
      item.memory.accessCount++;
    });

    return scored.map(item => item.memory);
  }

  private calculateRelevance(memory: Memory, query: string): number {
    const contentLower = memory.content.toLowerCase();
    let score = 0;

    // Exact match
    if (contentLower.includes(query)) score += 0.5;

    // Word overlap
    const queryWords = query.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);
    const overlap = queryWords.filter(w => contentWords.includes(w)).length;
    score += (overlap / queryWords.length) * 0.3;

    // Recency bonus
    const daysSinceCreated = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 0.2 - (daysSinceCreated * 0.01));

    // Importance bonus
    score += memory.importance * 0.2;

    return score;
  }

  learnPreference(key: string, value: any, source: string) {
    const existing = this.preferences.get(key);
    
    if (existing) {
      existing.learnedFrom.push(source);
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      this.preferences.set(key, {
        key,
        value,
        confidence: 0.5,
        learnedFrom: [source]
      });
    }
  }

  getPreference(key: string): UserPreference | undefined {
    return this.preferences.get(key);
  }

  getAllPreferences(): UserPreference[] {
    return Array.from(this.preferences.values());
  }

  summarizeConversation(conversationId: number, messages: any[]): string {
    if (messages.length === 0) return "";

    // Simple summarization (in production, use LLM)
    const topics = new Set<string>();
    const keyPoints: string[] = [];

    messages.forEach(msg => {
      if (msg.role === "user") {
        const words = msg.content.split(/\s+/).filter((w: string) => w.length > 5);
        words.slice(0, 3).forEach((w: string) => topics.add(w));
      }
      if (msg.content.length > 100) {
        keyPoints.push(msg.content.substring(0, 100) + "...");
      }
    });

    const summary = `Topics: ${Array.from(topics).join(", ")}. ${keyPoints.length} key exchanges.`;
    this.conversationSummaries.set(conversationId, summary);
    
    return summary;
  }

  getConversationSummary(conversationId: number): string | undefined {
    return this.conversationSummaries.get(conversationId);
  }

  private pruneMemories() {
    const maxMemories = 1000;
    if (this.memories.size <= maxMemories) return;

    // Remove least important, least accessed memories
    const sorted = Array.from(this.memories.values())
      .sort((a, b) => {
        const scoreA = a.importance * 0.5 + (a.accessCount / 100) * 0.5;
        const scoreB = b.importance * 0.5 + (b.accessCount / 100) * 0.5;
        return scoreA - scoreB;
      });

    const toRemove = sorted.slice(0, this.memories.size - maxMemories);
    toRemove.forEach(mem => this.memories.delete(mem.id));
  }

  getStats() {
    return {
      totalMemories: this.memories.size,
      preferences: this.preferences.size,
      summaries: this.conversationSummaries.size,
      memoryTypes: {
        conversation: Array.from(this.memories.values()).filter(m => m.type === "conversation").length,
        preference: Array.from(this.memories.values()).filter(m => m.type === "preference").length,
        fact: Array.from(this.memories.values()).filter(m => m.type === "fact").length,
        skill: Array.from(this.memories.values()).filter(m => m.type === "skill").length
      }
    };
  }

  clear() {
    this.memories.clear();
    this.preferences.clear();
    this.conversationSummaries.clear();
  }
}

export const memorySystem = new MemorySystem();
