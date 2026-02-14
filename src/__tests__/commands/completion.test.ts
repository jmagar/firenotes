import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/completion-helpers', () => ({
  detectShell: vi.fn(() => 'zsh'),
  getShellRcPath: vi.fn((shell: string) => `/tmp/.${shell}rc`),
}));

import { createCompletionCommand } from '../../commands/completion';

describe('completion command output formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders install output with title/summary block', async () => {
    const command = createCompletionCommand();

    await command.parseAsync(['node', 'test', 'install', 'zsh'], {
      from: 'node',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Completion Install for zsh')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('state: script generated')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('firecrawl completion script zsh >> /tmp/.zshrc')
    );
  });

  it('renders uninstall output with title/summary block', async () => {
    const command = createCompletionCommand();

    await command.parseAsync(['node', 'test', 'uninstall', 'bash'], {
      from: 'node',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Completion Uninstall for bash')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('state: manual removal required')
    );
  });

  it('keeps script subcommand as raw script output', async () => {
    const command = createCompletionCommand();

    await command.parseAsync(['node', 'test', 'script', 'fish'], {
      from: 'node',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('# firecrawl CLI fish completion')
    );
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Completion Install for')
    );
  });
});
