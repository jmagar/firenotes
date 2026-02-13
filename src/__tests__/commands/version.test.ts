import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/auth', () => ({
  isAuthenticated: vi.fn(),
}));

import { handleVersionCommand } from '../../commands/version';
import { isAuthenticated } from '../../utils/auth';

describe('version command output formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renders title and summary lines', () => {
    handleVersionCommand();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('firecrawl Version')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/version: v\d+\.\d+\.\d+/)
    );
  });

  it('shows auth status when requested', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);

    handleVersionCommand({ authStatus: true });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('✓ authenticated')
    );
  });
});
