/**
 * Base Agent - Uses real Claude Code via `claude -p`
 * Each agent can read/write files, run bash, use all tools
 */
export class BaseAgent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.icon = config.icon;
    this.capabilities = config.capabilities || [];
    this.systemPrompt = config.systemPrompt;
    this.cli = config.cli;
  }

  async execute(idea, previousOutput, project) {
    const prompt = this.buildPrompt(idea, previousOutput);

    // 작업 디렉토리를 시스템 프롬프트에 명시적으로 주입
    const workDir = this.cli.workDir;
    const fullSystemPrompt = `${this.systemPrompt}

CRITICAL: Your working directory is "${workDir}".
ALL file operations (Read, Write, Edit, Glob, Bash) MUST use this directory.
When reading files, use absolute paths starting with "${workDir}".
When creating files, create them inside "${workDir}".
When running bash commands, run them in "${workDir}".
DO NOT work outside this directory.`;

    const response = await this.cli.run(prompt, fullSystemPrompt);
    return response;
  }

  buildPrompt(idea, previousOutput) {
    throw new Error('Subclass must implement buildPrompt');
  }
}
