/**
 * Test type definitions
 * Types used in test files for type safety
 */

import type { IContainer } from '../container/types';

/**
 * Command wrapper that exposes container for testing
 * This type is compatible with Commander.Command but provides access to _container
 */
export interface CommandWithContainer {
  _container?: IContainer;
  parseAsync(
    argv: string[],
    options?: { from: 'node' | 'user' }
  ): Promise<void>;
  exitOverride(): this;
  name(): string;
}
