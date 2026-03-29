import { BaseAgent } from './base-agent.js';

export class DeveloperAgent extends BaseAgent {
  constructor(cli, outputDir) {
    super({
      id: 'developer',
      name: 'Developer Agent',
      role: 'Full-Stack Developer',
      icon: '\u{1F4BB}',
      capabilities: ['code-generation', 'implementation', 'file-creation', 'bug-fixing'],
      systemPrompt: `You are a senior Full-Stack Developer AI agent working in an AI company.
Your job is to take an architecture design and ACTUALLY BUILD the project.

You MUST:
- Create real files using the Write tool
- Write production-ready code
- Create package.json, config files, source code
- Set up the project structure as designed by the architect
- Install dependencies if needed

You MUST output explanations in Korean, but code in English.
After creating all files, output a summary of what you created.

IMPORTANT: Create all files inside the project output directory that will be provided.`,
      cli,
    });
    this.outputDir = outputDir;
  }

  buildPrompt(idea, previousOutput) {
    return `원본 아이디어: "${idea}"

Architect가 설계한 아키텍처:
${previousOutput}

위 아키텍처를 바탕으로 "${this.outputDir}" 디렉토리에 실제 프로젝트를 구현해주세요.

반드시:
1. 필요한 디렉토리와 파일을 실제로 생성해주세요
2. package.json 등 설정 파일도 만들어주세요
3. 핵심 소스 코드를 작성해주세요
4. 완료 후 어떤 파일들을 만들었는지 요약해주세요`;
  }

  buildFixPrompt(idea, feedback, round) {
    return `원본 아이디어: "${idea}"

코드 리뷰어가 ${round}차 리뷰에서 다음 피드백을 주었습니다:
${feedback}

"${this.outputDir}" 디렉토리의 기존 코드를 읽고, 위 피드백을 반영하여 수정해주세요.

반드시:
1. "${this.outputDir}" 디렉토리의 기존 파일들을 먼저 읽어주세요
2. 피드백에서 지적된 이슈를 하나씩 수정해주세요 (Edit 도구 사용)
3. 새 파일이 필요하면 추가해주세요
4. 수정한 내용을 요약해주세요`;
  }
}
