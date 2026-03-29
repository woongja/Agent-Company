/**
 * Pipeline - Sequential agent execution with Developer ⇄ Reviewer feedback loop
 * Supports resume from checkpoint on failure
 *
 * Flow:
 *   PM → Architect → Developer → Reviewer
 *                       ↑            ↓
 *                       └── feedback ─┘  (score < threshold → loop back)
 *                                        (score >= threshold → Tester)
 */
import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ReviewerAgent } from '../agents/reviewer-agent.js';

const PASS_SCORE = 70;
const MAX_ROUNDS = 3;

const STAGES = [
  { id: 'pm', name: 'PM Agent', label: '기획', icon: '\u{1F4CB}' },
  { id: 'architect', name: 'Architect Agent', label: '설계', icon: '\u{1F3D7}\uFE0F' },
  { id: 'developer', name: 'Developer Agent', label: '개발', icon: '\u{1F4BB}' },
  { id: 'reviewer', name: 'Reviewer Agent', label: '리뷰', icon: '\u{1F50D}' },
  { id: 'tester', name: 'Tester Agent', label: '테스트', icon: '\u{1F9EA}' },
];

export class Pipeline {
  constructor(messageBus, agents, onUpdate, outputDir) {
    this.messageBus = messageBus;
    this.agents = agents;
    this.onUpdate = onUpdate;
    this.outputDir = outputDir;
    this.projects = new Map();
    this._aborted = false;
  }

  /**
   * 모든 에이전트 즉시 중단
   */
  abort() {
    this._aborted = true;
    for (const agent of this.agents.values()) {
      if (agent.cli && typeof agent.cli.abort === 'function') {
        agent.cli.abort();
      }
    }
  }

  getStages() {
    return STAGES;
  }

  /**
   * 체크포인트 저장 - 각 스테이지 완료 시 호출
   */
  saveCheckpoint(project) {
    if (!this.outputDir) return;
    const cpPath = join(this.outputDir, 'checkpoint.json');
    const data = {
      ...this.serializeProject(project),
      savedAt: new Date().toISOString(),
    };
    writeFileSync(cpPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 체크포인트 로드
   */
  static loadCheckpoint(outputDir) {
    const cpPath = join(outputDir, 'checkpoint.json');
    if (!existsSync(cpPath)) return null;
    try {
      return JSON.parse(readFileSync(cpPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  async startProject(idea) {
    const projectId = randomUUID();
    const project = {
      id: projectId,
      idea,
      status: 'running',
      currentStage: 0,
      stages: STAGES.map((s) => ({
        ...s,
        status: 'pending',
        output: null,
        startedAt: null,
        completedAt: null,
        reviewRounds: [],
      })),
      createdAt: new Date().toISOString(),
      completedAt: null,
      finalOutput: null,
    };

    this.projects.set(projectId, project);
    this.broadcast(project, 'project_started');

    try {
      await this.runPipeline(project, 0); // startFrom = 0
    } catch (err) {
      project.status = 'failed';
      project.error = err.message;
      this.saveCheckpoint(project);
      this.broadcast(project, 'project_failed');
    }

    return project;
  }

  /**
   * 실패한 프로젝트를 체크포인트에서 재개
   */
  async resumeProject(checkpoint) {
    const project = {
      id: checkpoint.id || randomUUID(),
      idea: checkpoint.idea,
      status: 'running',
      currentStage: 0,
      stages: checkpoint.stages.map((s) => ({ ...s })),
      createdAt: checkpoint.createdAt,
      completedAt: null,
      finalOutput: null,
    };

    this.projects.set(project.id, project);

    // 완료된 마지막 스테이지 다음부터 재개
    let resumeFrom = 0;
    for (let i = 0; i < project.stages.length; i++) {
      if (project.stages[i].status === 'completed') {
        resumeFrom = i + 1;
      }
    }

    // reviewer(3) 도중 실패했으면 reviewer(3)부터 재개
    // developer(2) 완료 후 실패했으면 reviewer(3)부터
    this.broadcast(project, 'project_started');

    this.broadcastRaw({
      event: 'project_resumed',
      resumeFrom,
      resumeStage: STAGES[resumeFrom]?.label || 'unknown',
      completedStages: resumeFrom,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.runPipeline(project, resumeFrom);
    } catch (err) {
      project.status = 'failed';
      project.error = err.message;
      this.saveCheckpoint(project);
      this.broadcast(project, 'project_failed');
    }

    return project;
  }

  async runPipeline(project, startFrom = 0) {
    let pmOutput = project.stages[0].output || '';
    let archOutput = project.stages[1].output || '';
    let devOutput = project.stages[2].output || '';
    let reviewOutput = project.stages[3].output || '';

    // Stage 0: PM
    if (startFrom <= 0) {
      pmOutput = await this.runStage(project, 0, project.idea);
    }

    // Stage 1: Architect
    if (startFrom <= 1) {
      archOutput = await this.runStage(project, 1, pmOutput);
    }

    // Stage 2: Developer (initial build)
    if (startFrom <= 2) {
      devOutput = await this.runStage(project, 2, archOutput);
    }

    // Stage 3: Reviewer ⇄ Developer loop
    if (startFrom <= 3) {
      reviewOutput = await this.runReviewLoop(project, devOutput);
    }

    // Stage 4: Tester
    if (startFrom <= 4) {
      await this.runStage(project, 4, reviewOutput);
    }

    project.status = 'completed';
    project.completedAt = new Date().toISOString();
    project.finalOutput = project.stages[4].output;
    this.saveCheckpoint(project);
    this.broadcast(project, 'project_completed');
  }

  async runStage(project, stageIndex, input) {
    if (this._aborted) throw new Error('Pipeline aborted by user');

    const stage = project.stages[stageIndex];
    project.currentStage = stageIndex;
    stage.status = 'running';
    stage.startedAt = new Date().toISOString();
    this.broadcast(project, 'stage_started');

    const agent = this.agents.get(stage.id);
    if (!agent) throw new Error(`Agent not found: ${stage.id}`);

    this.messageBus.publish('pipeline', stage.id, {
      projectId: project.id,
      idea: project.idea,
      stageIndex,
    });

    const result = await agent.execute(project.idea, input, project);

    stage.output = result;
    stage.status = 'completed';
    stage.completedAt = new Date().toISOString();

    this.messageBus.publish(stage.id, 'pipeline', {
      projectId: project.id,
      result,
      stageIndex,
    }, 'result');

    this.broadcast(project, 'stage_completed');
    this.messageBus.storeMemory(`${project.id}:${stage.id}`, result);
    this.saveCheckpoint(project);

    return result;
  }

  async runReviewLoop(project, devOutput) {
    const reviewerStage = project.stages[3];
    const developerStage = project.stages[2];
    const reviewer = this.agents.get('reviewer');
    const developer = this.agents.get('developer');

    let round = 1;
    let lastReviewOutput = '';

    while (round <= MAX_ROUNDS) {
      if (this._aborted) throw new Error('Pipeline aborted by user');

      // --- Reviewer ---
      project.currentStage = 3;
      reviewerStage.status = 'running';
      reviewerStage.startedAt = new Date().toISOString();
      this.broadcast(project, 'stage_started');

      this.messageBus.publish('pipeline', 'reviewer', { projectId: project.id, round });

      let reviewInput;
      if (round === 1) {
        reviewInput = await reviewer.execute(project.idea, devOutput, project);
      } else {
        const prompt = reviewer.buildFeedbackPrompt(project.idea, lastReviewOutput, round);
        reviewInput = await reviewer.cli.run(prompt, reviewer.systemPrompt);
      }

      lastReviewOutput = reviewInput;

      const score = ReviewerAgent.parseScore(reviewInput);
      reviewerStage.reviewRounds.push({ round, score, feedback: reviewInput });
      reviewerStage.output = reviewInput;
      reviewerStage.status = 'completed';
      reviewerStage.completedAt = new Date().toISOString();

      this.messageBus.publish('reviewer', 'pipeline', {
        projectId: project.id, round, score,
        passed: score !== null && score >= PASS_SCORE,
      }, 'review_result');

      this.broadcast(project, 'stage_completed');
      this.saveCheckpoint(project);

      this.broadcastRaw({
        event: 'review_score',
        round, score,
        passed: score !== null && score >= PASS_SCORE,
        maxRounds: MAX_ROUNDS, passScore: PASS_SCORE,
        timestamp: new Date().toISOString(),
      });

      if (score !== null && score >= PASS_SCORE) {
        this.broadcastRaw({ event: 'review_passed', round, score, timestamp: new Date().toISOString() });
        break;
      }

      if (round >= MAX_ROUNDS) {
        this.broadcastRaw({ event: 'review_max_rounds', round, score, timestamp: new Date().toISOString() });
        break;
      }

      // --- Developer fixes ---
      this.broadcastRaw({
        event: 'review_feedback_loop',
        round, score, nextRound: round + 1,
        timestamp: new Date().toISOString(),
      });

      project.currentStage = 2;
      developerStage.status = 'running';
      developerStage.startedAt = new Date().toISOString();
      this.broadcast(project, 'stage_started');

      this.messageBus.publish('pipeline', 'developer', { projectId: project.id, round, type: 'fix' });

      const fixPrompt = developer.buildFixPrompt(project.idea, lastReviewOutput, round);
      devOutput = await developer.cli.run(fixPrompt, developer.systemPrompt);

      developerStage.output = devOutput;
      developerStage.status = 'completed';
      developerStage.completedAt = new Date().toISOString();

      this.messageBus.publish('developer', 'pipeline', {
        projectId: project.id, round, type: 'fix_complete',
      }, 'result');

      this.broadcast(project, 'stage_completed');
      this.saveCheckpoint(project);

      round++;
    }

    return lastReviewOutput;
  }

  broadcast(project, event) {
    if (this.onUpdate) {
      this.onUpdate({
        event,
        project: this.serializeProject(project),
        timestamp: new Date().toISOString(),
      });
    }
  }

  broadcastRaw(data) {
    if (this.onUpdate) {
      this.onUpdate(data);
    }
  }

  serializeProject(project) {
    return {
      id: project.id,
      idea: project.idea,
      status: project.status,
      currentStage: project.currentStage,
      stages: project.stages.map((s) => ({
        ...s,
        reviewRounds: s.reviewRounds || [],
      })),
      createdAt: project.createdAt,
      completedAt: project.completedAt,
      error: project.error,
    };
  }

  getProject(id) {
    const p = this.projects.get(id);
    return p ? this.serializeProject(p) : null;
  }

  getAllProjects() {
    return Array.from(this.projects.values()).map((p) => this.serializeProject(p));
  }
}
