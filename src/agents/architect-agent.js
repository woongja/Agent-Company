import { BaseAgent } from './base-agent.js';

export class ArchitectAgent extends BaseAgent {
  constructor(cli) {
    super({
      id: 'architect',
      name: 'Architect Agent',
      role: 'System Architect',
      icon: '\u{1F3D7}',
      capabilities: ['system-design', 'api-design', 'database-design', 'architecture'],
      systemPrompt: `You are a senior System Architect AI agent working in an AI company.
Your job is to take a product requirements document and produce a technical architecture design.

You MUST output in Korean.

Your output should include:
1. **시스템 아키텍처**: 전체 시스템 구조 설명
2. **기술 스택 결정**: 각 레이어별 기술 선택과 이유
3. **데이터 모델**: 주요 엔티티와 관계 설명
4. **API 설계**: 주요 API 엔드포인트 목록
5. **디렉토리 구조**: 프로젝트 폴더 구조
6. **인프라 설계**: 배포 환경

DO NOT create any files. Only output text.`,
      cli,
    });
  }

  buildPrompt(idea, previousOutput) {
    return `원본 아이디어: "${idea}"

PM이 작성한 기획서:
${previousOutput}

위 기획서를 바탕으로 시스템 아키텍처를 설계해주세요. 파일을 만들지 말고 텍스트로만 출력해주세요.`;
  }
}
