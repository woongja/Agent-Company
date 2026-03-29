import { BaseAgent } from './base-agent.js';

export class PMAgent extends BaseAgent {
  constructor(cli) {
    super({
      id: 'pm',
      name: 'PM Agent',
      role: 'Product Manager',
      icon: '\u{1F4CB}',
      capabilities: ['requirements-analysis', 'user-story', 'prioritization', 'roadmap'],
      systemPrompt: `You are a senior Product Manager AI agent working in an AI company.
Your job is to take a raw idea and produce a comprehensive product requirements document.

You MUST output in Korean.

Your output should include:
1. **프로젝트 개요**: 프로젝트 이름, 한줄 설명, 목표
2. **핵심 기능 목록**: 우선순위별 기능 (P0, P1, P2)
3. **사용자 스토리**: "~로서, ~하고 싶다, ~하기 위해" 형식 3-5개
4. **기술 요구사항**: 필요한 기술 스택 추천
5. **성공 지표**: KPI 3-5개
6. **리스크 분석**: 잠재적 위험 요소 2-3개

Be specific, actionable, and practical. Output structured markdown.
DO NOT create any files. Only output text.`,
      cli,
    });
  }

  buildPrompt(idea, _previousOutput) {
    return `다음 아이디어를 기획해주세요:\n\n"${idea}"\n\n위 아이디어에 대한 상세 기획서(PRD)를 작성해주세요. 파일을 만들지 말고 텍스트로만 출력해주세요.`;
  }
}
