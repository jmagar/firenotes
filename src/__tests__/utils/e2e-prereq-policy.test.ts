import { describe, expect, it, vi } from 'vitest';
import {
  shouldFailOnMissingPrerequisites,
  skipWithPrerequisiteMessage,
} from '../e2e/helpers';

describe('e2e prerequisite policy', () => {
  it('enables strict mode when explicitly requested', () => {
    vi.stubEnv('AXON_E2E_STRICT_PREREQS', '1');
    vi.stubEnv('AXON_E2E_ALLOW_SKIPS', undefined);
    vi.stubEnv('CI', undefined);

    expect(shouldFailOnMissingPrerequisites()).toBe(true);
  });

  it('enables strict mode by default in CI', () => {
    vi.stubEnv('AXON_E2E_STRICT_PREREQS', undefined);
    vi.stubEnv('AXON_E2E_ALLOW_SKIPS', undefined);
    vi.stubEnv('CI', 'true');

    expect(shouldFailOnMissingPrerequisites()).toBe(true);
  });

  it('allows skips in CI when explicitly opted out', () => {
    vi.stubEnv('AXON_E2E_STRICT_PREREQS', undefined);
    vi.stubEnv('AXON_E2E_ALLOW_SKIPS', '1');
    vi.stubEnv('CI', 'true');

    expect(shouldFailOnMissingPrerequisites()).toBe(false);
  });

  it('throws in strict mode when prerequisites are missing', () => {
    vi.stubEnv('AXON_E2E_STRICT_PREREQS', '1');
    vi.stubEnv('AXON_E2E_ALLOW_SKIPS', undefined);
    vi.stubEnv('CI', undefined);

    expect(() => skipWithPrerequisiteMessage('No API credentials')).toThrow(
      '[E2E strict prerequisites] No API credentials'
    );
  });

  it('logs and returns true in lenient mode when prerequisites are missing', () => {
    vi.stubEnv('AXON_E2E_STRICT_PREREQS', undefined);
    vi.stubEnv('AXON_E2E_ALLOW_SKIPS', '1');
    vi.stubEnv('CI', 'true');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(skipWithPrerequisiteMessage('No API credentials')).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('Skipping: No API credentials');

    logSpy.mockRestore();
  });
});
