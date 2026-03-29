import { BaseAgent } from './base-agent.js';

export class ReviewerAgent extends BaseAgent {
  constructor(cli, outputDir) {
    super({
      id: 'reviewer',
      name: 'Reviewer Agent',
      role: 'Code Reviewer',
      icon: '\u{1F50D}',
      capabilities: ['code-review', 'file-reading', 'quality-analysis', 'scoring'],
      systemPrompt: `You are a senior Code Reviewer AI agent working in an AI company.
Your job is to ACTUALLY READ the implemented code files and give a quality score with feedback.

You MUST:
- Use the Read tool to read the actual source files
- Use Glob to find all created files
- Analyze real code quality, security, structure
- DO NOT fix code yourself. Give feedback for the Developer to fix.

You MUST output in Korean.

CRITICAL: You must include a score line in EXACTLY this format at the very end:
SCORE: [number]/100

Your review should include:
1. **전체 평가**: 코드 품질 종합 점수 (/100)
2. **잘된 점**: 좋은 패턴, 구조 등
3. **개선 필요 사항**: 구체적인 피드백 (파일명, 라인, 어떻게 고쳐야 하는지)
4. **보안 이슈**: 잠재적 보안 문제
5. **최종 피드백**: Developer에게 전달할 구체적 수정 요청

SCORE: [number]/100`,
      cli,
    });
    this.outputDir = outputDir;
  }

  buildPrompt(idea, previousOutput) {
    return `원본 아이디어: "${idea}"

Developer가 "${this.outputDir}" 디렉토리에 프로젝트를 구현했습니다.

이전 단계 요약:
${previousOutput}

반드시:
1. "${this.outputDir}" 디렉토리의 모든 파일을 Glob으로 찾고 Read로 읽어주세요
2. 실제 코드를 분석해서 피드백을 주세요
3. 코드를 직접 수정하지 말고, Developer에게 전달할 구체적 수정 사항을 작성해주세요
4. 반드시 마지막에 SCORE: [점수]/100 형식으로 점수를 매겨주세요`;
  }

  buildFeedbackPrompt(idea, feedback, round) {
    return `원본 아이디어: "${idea}"

이것은 ${round}차 코드 리뷰입니다.
Developer가 이전 피드백을 반영하여 코드를 수정했습니다.

"${this.outputDir}" 디렉토리의 코드를 다시 리뷰해주세요.

이전 피드백:
${feedback}

반드시:
1. "${this.outputDir}" 디렉토리의 모든 파일을 다시 Glob으로 찾고 Read로 읽어주세요
2. 이전 피드백이 제대로 반영되었는지 확인해주세요
3. 새로운 이슈가 있는지 확인해주세요
4. 반드시 마지막에 SCORE: [점수]/100 형식으로 점수를 매겨주세요`;
  }

  /**
   * Parse SCORE: XX/100 from reviewer output
   */
  static parseScore(output) {
    const match = output.match(/SCORE:\s*(\d+)\s*\/\s*100/i);
    return match ? parseInt(match[1], 10) : null;
  }
}
