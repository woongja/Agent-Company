/**
 * Message Bus - Inter-agent communication system
 * Inspired by ruflo's swarm coordination patterns
 */
import { randomUUID } from 'crypto';

export class MessageBus {
  constructor() {
    this.messages = [];
    this.subscribers = new Map();
    this.projectMemory = new Map();
  }

  subscribe(agentId, callback) {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
    }
    this.subscribers.get(agentId).push(callback);
  }

  publish(from, to, content, type = 'task') {
    const message = {
      id: randomUUID(),
      from,
      to,
      content,
      type,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(message);

    const subs = this.subscribers.get(to) || [];
    for (const cb of subs) {
      cb(message);
    }

    // broadcast to 'all' subscribers
    const allSubs = this.subscribers.get('all') || [];
    for (const cb of allSubs) {
      cb(message);
    }

    return message;
  }

  storeMemory(key, value) {
    this.projectMemory.set(key, {
      value,
      updatedAt: new Date().toISOString(),
    });
  }

  getMemory(key) {
    return this.projectMemory.get(key)?.value ?? null;
  }

  getAllMessages() {
    return [...this.messages];
  }

  getMessagesByProject(projectId) {
    return this.messages.filter(
      (m) => m.content?.projectId === projectId || m.projectId === projectId
    );
  }

  clear() {
    this.messages = [];
    this.projectMemory.clear();
  }
}
