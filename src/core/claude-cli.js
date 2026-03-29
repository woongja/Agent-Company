/**
 * Claude CLI Wrapper - Spawns real Claude Code instances via `claude -p`
 * Uses stream-json format to capture tool calls, text, and results in real-time
 */
import { spawn } from 'child_process';
import { platform } from 'os';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

function parseStreamLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export class ClaudeCLI {
  constructor(options = {}) {
    this.workDir = options.workDir || process.cwd();
    this.onEvent = options.onEvent || null;
    this.permissionMode = options.permissionMode || 'bypassPermissions';
    this._proc = null;   // 현재 실행 중인 프로세스
    this._aborted = false;
  }

  /**
   * 현재 실행 중인 claude 프로세스를 강제 종료
   * Windows: taskkill /T /F로 프로세스 트리 전체 kill
   * Unix: SIGTERM
   */
  abort() {
    this._aborted = true;
    if (this._proc && this._proc.pid) {
      const pid = this._proc.pid;
      if (platform() === 'win32') {
        // Windows: cmd.exe → claude 프로세스 트리 전체 강제 종료
        spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        this._proc.kill('SIGTERM');
      }
      this._proc = null;
    }
  }

  async run(prompt, systemPrompt = '') {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    // 프롬프트를 임시 파일에 저장 (cmd line 길이 제한 및 특수문자 문제 방지)
    const tmpFile = join(tmpdir(), `ac-prompt-${randomUUID()}.txt`);
    writeFileSync(tmpFile, fullPrompt, 'utf-8');

    this._aborted = false;

    return new Promise((resolve, reject) => {
      if (this._aborted) {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        return reject(new Error('Agent aborted'));
      }

      const isWin = platform() === 'win32';

      // 고정 인자만 command line에 전달 (사용자 입력 없음 = 안전)
      const claudeArgs = [
        '-p',
        '--output-format', 'stream-json',
        '--verbose',
      ];

      if (this.permissionMode) {
        claudeArgs.push('--permission-mode', this.permissionMode);
      }

      // Windows: .cmd 파일은 cmd.exe를 통해 실행해야 함
      // Unix: 직접 실행
      let proc;
      if (isWin) {
        proc = spawn('cmd.exe', ['/c', 'claude', ...claudeArgs], {
          cwd: this.workDir,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } else {
        proc = spawn('claude', claudeArgs, {
          cwd: this.workDir,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }

      this._proc = proc;

      // 프롬프트를 stdin으로 전달 (cmd line 대신)
      proc.stdin.write(fullPrompt);
      proc.stdin.end();

      let resultText = '';
      let buffer = '';

      proc.stdout.on('data', (data) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = parseStreamLine(line);
          if (!event) continue;

          this.handleEvent(event);

          if (event.type === 'result' && event.result) {
            resultText = event.result;
          }
        }
      });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        this._proc = null;
        // 임시 파일 정리
        try { unlinkSync(tmpFile); } catch { /* ignore */ }

        if (this._aborted) {
          return reject(new Error('Agent aborted by user'));
        }

        // 남은 버퍼 처리
        if (buffer.trim()) {
          const event = parseStreamLine(buffer);
          if (event) {
            this.handleEvent(event);
            if (event.type === 'result' && event.result) {
              resultText = event.result;
            }
          }
        }

        if (code !== 0 && !resultText) {
          reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 500)}`));
        } else {
          resolve(resultText);
        }
      });

      proc.on('error', (err) => {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        reject(new Error(`Failed to spawn claude: ${err.message}`));
      });

      // 10 min timeout
      setTimeout(() => {
        proc.kill('SIGTERM');
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        reject(new Error('Agent timed out after 30 minutes'));
      }, 1_800_000);
    });
  }

  handleEvent(event) {
    if (!this.onEvent) return;

    switch (event.type) {
      case 'system':
        this.onEvent({
          type: 'system',
          message: `Session initialized (${event.model || 'claude'})`,
        });
        break;

      case 'assistant': {
        const msg = event.message;
        if (!msg?.content) break;

        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            this.onEvent({ type: 'text', text: block.text });
          } else if (block.type === 'tool_use') {
            this.onEvent({
              type: 'tool_use',
              tool: block.name,
              input: this.summarizeToolInput(block.name, block.input),
            });
          }
        }
        break;
      }

      case 'rate_limit_event': {
        const info = event.rate_limit_info;
        if (info) {
          this.onEvent({
            type: 'rate_limit',
            rateLimitType: info.rateLimitType,
            status: info.status,
            resetsAt: info.resetsAt,
            percentUsed: info.percentUsed,
          });
        }
        break;
      }

      case 'result': {
        const usage = event.usage || {};
        this.onEvent({
          type: 'result',
          duration: event.duration_ms,
          cost: event.total_cost_usd,
          turns: event.num_turns,
          usage: {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cacheRead: usage.cache_read_input_tokens || 0,
            cacheCreation: usage.cache_creation_input_tokens || 0,
          },
          modelUsage: event.modelUsage || {},
        });
        break;
      }
    }
  }

  summarizeToolInput(tool, input) {
    if (!input) return '';
    switch (tool) {
      case 'Read': return input.file_path || '';
      case 'Write': return input.file_path || '';
      case 'Edit': return input.file_path || '';
      case 'Glob': return input.pattern || '';
      case 'Grep': return `"${input.pattern || ''}" in ${input.path || '.'}`;
      case 'Bash': return (input.command || '').slice(0, 100);
      case 'Agent': return input.description || '';
      default: return JSON.stringify(input).slice(0, 80);
    }
  }
}
