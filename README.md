# Agent Company

5명의 AI 에이전트가 근무하는 가상 회사입니다.
아이디어를 입력하면 기획부터 테스트까지 자동으로 진행하여 **실제 동작하는 프로젝트**를 만들어냅니다.

> Powered by [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude -p`)

## Pipeline

```
아이디어 입력
    │
    ▼
┌─────────┐
│   PM    │  기획서(PRD) 작성
└────┬────┘
     ▼
┌─────────┐
│Architect│  시스템 아키텍처 설계
└────┬────┘
     ▼
┌─────────┐◄──── 피드백 (점수 < 70) ────┐
│Developer│  실제 코드 구현 (파일 생성)   │
└────┬────┘                              │
     ▼                                   │
┌─────────┐                              │
│Reviewer │  코드 리뷰 + 점수 채점 ──────┘
└────┬────┘  (70점 이상 통과, 최대 3라운드)
     ▼
┌─────────┐
│ Tester  │  테스트 작성 및 실행
└────┬────┘
     ▼
  REPORT.md 생성
```

## 주요 특징

- **실제 파일 생성** — API 텍스트 출력이 아닌, Claude Code가 직접 파일을 만들고 코드를 실행합니다
- **Developer ⇄ Reviewer 피드백 루프** — 코드 품질이 기준 점수(70/100)를 넘을 때까지 자동 수정
- **실시간 웹 대시보드** — 에이전트 활동, 도구 사용, 토큰/비용을 실시간으로 시각화
- **중단 & 재개** — 실행 중 중단 가능, checkpoint에서 이어하기 지원
- **작업 폴더 지정** — 원하는 폴더에서 직접 작업 가능
- **REPORT.md 자동 생성** — 프로젝트 완료 시 전체 과정이 마크다운 보고서로 저장

## 요구사항

- **Node.js** >= 20
- **Claude Code** CLI 설치 및 로그인 완료

```bash
# Claude Code 설치 (아직 안 했다면)
npm install -g @anthropic-ai/claude-code
claude login
```

## 설치 및 실행

```bash
git clone https://github.com/woongja/Agent-company.git
cd agent-company
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속

## 사용법

### 기본 사용

1. 아이디어를 입력합니다 (예: `실시간 채팅 앱 만들어줘`)
2. 실행 버튼 클릭
3. 5명의 에이전트가 순서대로 작업을 수행합니다
4. 완료되면 `output/` 폴더에 실제 프로젝트 + `REPORT.md`가 생성됩니다

### 작업 폴더 지정

드롭다운에서 기존 output 폴더를 선택하거나, 새 프로젝트를 자동 생성할 수 있습니다.

### 중단 & 재개

- 실행 중 **⏹ 중단** 버튼으로 즉시 중단
- 이전 프로젝트 목록(📁)에서 **▶ 이어하기**로 실패 지점부터 재개

### 이전 프로젝트 확인

📁 버튼 클릭 → 완료/실패한 프로젝트 목록 → 클릭하면 REPORT.md 내용 확인

## 웹 대시보드
<img width="2558" height="1267" alt="image" src="https://github.com/user-attachments/assets/3556f566-dad1-4222-87e7-19cee17b3a90" />

```
┌─────────────────────────────────────────────────────────┐
│  Agent Company                            Claude Code   │
├─────────────────────────────────────────────────────────┤
│ AC#2.0 | 5h:42% ▓▓▓░░ | tokens: 12k in 2k out | $0.8 │
├──────────┬──────────────────────────┬───────────────────┤
│ Agents   │     Agent Output         │  Live Activity    │
│          │                          │                   │
│ PM ✅    │  채팅 형태로             │  Read file.js     │
│ Arch ✅  │  에이전트 출력 표시       │  Write api.ts     │
│ Dev 🟡   │                          │  Bash npm install │
│ Rev ⬜   │                          │  Edit bug.ts      │
│ Test ⬜  │                          │                   │
└──────────┴──────────────────────────┴───────────────────┘
```

- **왼쪽** — 에이전트 상태 (대기/작업중/완료) + 도구 사용 내역
- **가운데** — 에이전트 출력 (기획서, 설계서, 코드, 리뷰, 테스트 결과)
- **오른쪽** — Read, Write, Bash 등 도구 사용 실시간 로그
- **상단 바** — 레이트리밋, 토큰, 비용, 세션 시간

## 프로젝트 구조

```
agent-company/
├── public/
│   └── index.html              # 웹 대시보드 (싱글 HTML)
├── src/
│   ├── agents/
│   │   ├── base-agent.js       # 에이전트 공통 인터페이스
│   │   ├── pm-agent.js         # 📋 기획 (PRD 작성)
│   │   ├── architect-agent.js  # 🏗️ 설계 (아키텍처)
│   │   ├── developer-agent.js  # 💻 개발 (파일 생성)
│   │   ├── reviewer-agent.js   # 🔍 리뷰 (점수 + 피드백)
│   │   └── tester-agent.js     # 🧪 테스트 (실행)
│   ├── core/
│   │   ├── claude-cli.js       # Claude Code CLI 래퍼 (stream-json)
│   │   ├── message-bus.js      # 에이전트 간 메시지 버스
│   │   └── pipeline.js         # 실행 파이프라인 + 피드백 루프
│   └── server/
│       └── index.js            # Express + WebSocket 서버
├── output/                     # 생성된 프로젝트들
│   └── project-xxxxx/
│       ├── (생성된 파일들)
│       ├── checkpoint.json     # 중단 시 체크포인트
│       └── REPORT.md           # 완료 시 보고서
├── package.json
└── README.md
```

## 설정

| 환경변수 | 기본값   | 설명      |
| -------- | -------- | --------- |
| `PORT` | `3000` | 서버 포트 |

파이프라인 설정은 `src/core/pipeline.js`에서 변경:

```js
const PASS_SCORE = 70;   // 리뷰 통과 점수 (0-100)
const MAX_ROUNDS = 3;    // 최대 리뷰 라운드
```

에이전트 타임아웃은 `src/core/claude-cli.js`에서 변경:

```js
}, 1_800_000);  // 30분 (밀리초)
```

## API

| Method        | Endpoint                       | 설명                                      |
| ------------- | ------------------------------ | ----------------------------------------- |
| `POST`      | `/api/projects`              | 새 프로젝트 시작 (`{ idea, workDir? }`) |
| `POST`      | `/api/projects/abort`        | 실행 중인 프로젝트 중단                   |
| `POST`      | `/api/projects/resume/:name` | 실패한 프로젝트 재개                      |
| `GET`       | `/api/history`               | 이전 프로젝트 목록                        |
| `GET`       | `/api/history/:name`         | 프로젝트 REPORT.md 조회                   |
| `GET`       | `/api/folders`               | output 폴더 목록                          |
| `GET`       | `/api/health`                | 서버 상태                                 |
| `WebSocket` | `/`                          | 실시간 이벤트 스트림                      |
