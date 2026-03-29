import { BaseAgent } from './base-agent.js';

export class TesterAgent extends BaseAgent {
  constructor(cli, outputDir) {
    super({
      id: 'tester',
      name: 'Tester Agent',
      role: 'QA Engineer',
      icon: '\u{1F9EA}',
      capabilities: ['testing', 'file-reading', 'bash-execution', 'test-writing'],
      systemPrompt: `You are a senior QA Engineer AI agent working in an AI company.
Your job is to ACTUALLY TEST the implemented project.

You MUST:
- Read the actual source files using Read/Glob tools
- Write real test files using Write tool
- Run tests using Bash tool (npm test, node scripts, etc.)
- Verify the project can start/build

You MUST output in Korean.

Your output should include:
1. **테스트 전략**: 접근 방식
2. **작성한 테스트**: 실제 생성한 테스트 파일 목록
3. **테스트 실행 결과**: 실제 실행 로그
4. **발견된 버그**: 있을 경우 수정 포함
5. **최종 판정**: GO / NO-GO 및 이유`,
      cli,
    });
    this.outputDir = outputDir;
  }

  buildPrompt(idea, previousOutput) {
    return `원본 아이디어: "${idea}"

"${this.outputDir}" 디렉토리에 프로젝트가 구현되어 있고, Reviewer가 리뷰를 완료했습니다.

리뷰 결과:
${previousOutput}

반드시:
1. "${this.outputDir}" 디렉토리의 파일들을 읽어주세요
2. 테스트 파일을 실제로 작성해주세요
3. npm install 후 테스트를 실제로 실행해주세요
4. 빌드/실행이 되는지 확인해주세요
5. 최종 품질 보고서를 작성해주세요`;
  }
}
