import { afterEach, describe, expect, it } from 'vitest';
import {
  __doctorDebugTestables,
  hasDoctorDebugBackendConfigured,
} from '../../commands/doctor-debug';

const ORIGINAL_ENV = { ...process.env };

describe('doctor-debug backend selection', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns false when neither ASK_CLI nor OpenAI fallback is configured', () => {
    delete process.env.ASK_CLI;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    expect(hasDoctorDebugBackendConfigured()).toBe(false);
  });

  it('returns true when ASK_CLI is configured', () => {
    process.env.ASK_CLI = 'gemini-3-flash-preview';
    expect(hasDoctorDebugBackendConfigured()).toBe(true);
  });

  it('returns true when OpenAI fallback is fully configured', () => {
    delete process.env.ASK_CLI;
    process.env.OPENAI_BASE_URL = 'https://example.com/v1';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    expect(hasDoctorDebugBackendConfigured()).toBe(true);
  });

  it('formats debug header with style guide sections', () => {
    const lines = __doctorDebugTestables.formatDoctorDebugHeader(
      'claude (claude-3-7-sonnet)',
      {
        timestamp: '2026-02-13T19:42:10.000Z',
        overallStatus: 'failed',
        summary: { pass: 2, warn: 1, fail: 1 },
        checks: [],
      },
      { aiTimeout: 180000 }
    );
    const output = lines.join('\n');
    expect(output).toContain('Doctor Debug Chat');
    expect(output).toContain('Legend:');
    expect(output).toContain('Filters: ai_timeout_ms=180000');
    expect(output).toContain('As of (EST):');
  });
});
