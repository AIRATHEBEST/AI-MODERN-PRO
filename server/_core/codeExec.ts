/**
 * Code Execution Sandbox
 * Runs JS/Python/Bash safely using isolated child processes with timeout
 */
import { execFile, exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

export interface CodeExecRequest {
  code: string;
  language: "javascript" | "python" | "bash" | "typescript";
  timeout?: number; // ms, default 10000
}

export interface CodeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  error?: string;
}

const BANNED_PATTERNS = [
  /require\s*\(\s*['"]child_process/i,
  /import\s+.*child_process/i,
  /process\.exit/i,
  /fs\.(unlink|rmdir|rm)\s*\(/i,
  /__import__\s*\(\s*['"]os['"]/i,
  /subprocess\.call/i,
  /os\.system/i,
  /rm\s+-rf/i,
  /sudo\s/i,
  /curl\s/i,
  /wget\s/i,
  /chmod\s/i,
];

function isSafe(code: string): boolean {
  return !BANNED_PATTERNS.some(p => p.test(code));
}

export async function executeCode(req: CodeExecRequest): Promise<CodeExecResult> {
  const timeout = Math.min(req.timeout || 10000, 15000);
  const start = Date.now();

  if (!isSafe(req.code)) {
    return { stdout: "", stderr: "Code contains disallowed operations.", exitCode: 1, durationMs: 0, error: "Security check failed" };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "aiexec-"));
  let filePath = "";

  try {
    switch (req.language) {
      case "javascript": {
        filePath = join(tmpDir, "code.mjs");
        // Wrap in async context, capture console.log
        const wrapped = `
const _logs = [];
const _origLog = console.log;
console.log = (...args) => _logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
console.error = (...args) => _logs.push('ERR: ' + args.join(' '));
try {
  ${req.code}
} catch(e) { console.log('Runtime Error:', e.message); }
process.stdout.write(_logs.join('\\n') + (process.stdout.bytesWritten ? '' : ''));
`;
        writeFileSync(filePath, wrapped);
        const { stdout, stderr } = await execAsync(`node "${filePath}"`, { timeout, cwd: tmpDir });
        return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0, durationMs: Date.now() - start };
      }

      case "typescript": {
        filePath = join(tmpDir, "code.ts");
        writeFileSync(filePath, req.code);
        const { stdout, stderr } = await execAsync(`npx --yes tsx "${filePath}" 2>&1 || true`, { timeout, cwd: tmpDir });
        return { stdout: stdout.trim(), stderr: "", exitCode: 0, durationMs: Date.now() - start };
      }

      case "python": {
        filePath = join(tmpDir, "code.py");
        writeFileSync(filePath, req.code);
        try {
          const { stdout, stderr } = await execAsync(`python3 "${filePath}"`, { timeout, cwd: tmpDir });
          return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0, durationMs: Date.now() - start };
        } catch (err: any) {
          return { stdout: err.stdout?.trim() || "", stderr: err.stderr?.trim() || err.message, exitCode: 1, durationMs: Date.now() - start };
        }
      }

      case "bash": {
        // Extra strict for bash
        if (/rm|curl|wget|nc|netcat|ssh|ftp|git/.test(req.code)) {
          return { stdout: "", stderr: "Bash command contains restricted operations.", exitCode: 1, durationMs: 0 };
        }
        filePath = join(tmpDir, "code.sh");
        writeFileSync(filePath, `#!/bin/bash\nset -e\n${req.code}`);
        try {
          const { stdout, stderr } = await execAsync(`bash "${filePath}"`, { timeout, cwd: tmpDir });
          return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0, durationMs: Date.now() - start };
        } catch (err: any) {
          return { stdout: err.stdout?.trim() || "", stderr: err.stderr?.trim() || err.message, exitCode: 1, durationMs: Date.now() - start };
        }
      }

      default:
        return { stdout: "", stderr: `Language ${req.language} not supported.`, exitCode: 1, durationMs: 0 };
    }
  } catch (err: any) {
    if (err.signal === "SIGTERM" || err.killed) {
      return { stdout: err.stdout?.trim() || "", stderr: `Execution timed out after ${timeout}ms`, exitCode: 124, durationMs: timeout, error: "timeout" };
    }
    return { stdout: err.stdout?.trim() || "", stderr: err.stderr?.trim() || err.message || String(err), exitCode: err.code || 1, durationMs: Date.now() - start };
  } finally {
    try { if (filePath) unlinkSync(filePath); } catch {}
    try { unlinkSync(tmpDir); } catch {}
  }
}
