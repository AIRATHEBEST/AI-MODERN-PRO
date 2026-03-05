/**
 * Export conversations to Markdown, PDF (HTML), or JSON
 */
export interface ExportMessage {
  role: string;
  content: string;
  model?: string | null;
  provider?: string | null;
  createdAt?: Date;
}

export interface ExportConversation {
  title: string;
  provider?: string | null;
  model?: string | null;
  createdAt: Date;
  messages: ExportMessage[];
}

export function exportToMarkdown(conv: ExportConversation): string {
  const lines: string[] = [
    `# ${conv.title}`,
    ``,
    `> **Provider:** ${conv.provider || "built-in"} | **Model:** ${conv.model || "default"}  `,
    `> **Created:** ${conv.createdAt.toLocaleString()}`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of conv.messages.filter(m => m.role !== "system")) {
    if (msg.role === "user") {
      lines.push(`**You:**`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    } else if (msg.role === "assistant") {
      lines.push(`**Assistant${msg.model ? ` (${msg.model})` : ""}:**`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join("\n");
}

export function exportToJSON(conv: ExportConversation): string {
  return JSON.stringify({
    title: conv.title,
    provider: conv.provider,
    model: conv.model,
    createdAt: conv.createdAt,
    messages: conv.messages.map(m => ({
      role: m.role,
      content: m.content,
      model: m.model,
      provider: m.provider,
      createdAt: m.createdAt,
    })),
  }, null, 2);
}

export function exportToHtml(conv: ExportConversation): string {
  const msgHtml = conv.messages
    .filter(m => m.role !== "system")
    .map(m => {
      const isUser = m.role === "user";
      return `
      <div class="message ${isUser ? 'user' : 'assistant'}">
        <div class="label">${isUser ? '👤 You' : `🤖 Assistant${m.model ? ` (${m.model})` : ''}`}</div>
        <div class="content">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div>
      </div>`;
    }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(conv.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; background: #f9fafb; color: #111; }
  h1 { font-size: 1.5rem; font-weight: 700; }
  .meta { color: #666; font-size: 0.875rem; margin-bottom: 24px; }
  .message { margin: 16px 0; padding: 16px; border-radius: 12px; }
  .user { background: #2563eb; color: white; margin-left: 20%; }
  .assistant { background: white; border: 1px solid #e5e7eb; margin-right: 20%; }
  .label { font-size: 0.75rem; font-weight: 600; margin-bottom: 8px; opacity: 0.7; }
  .content { white-space: pre-wrap; line-height: 1.6; }
  pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 6px; overflow-x: auto; }
</style>
</head>
<body>
<h1>${escapeHtml(conv.title)}</h1>
<div class="meta">Provider: ${conv.provider || 'built-in'} | Model: ${conv.model || 'default'} | ${conv.createdAt.toLocaleString()}</div>
${msgHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
