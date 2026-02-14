/**
 * Commander.js module augmentation for container injection.
 *
 * Centralized here to avoid duplicate `declare module` blocks
 * scattered across command files (previously in index.ts and batch.ts).
 */

import type { IContainer } from '../container/types';

declare module 'commander' {
  interface Command {
    _container?: IContainer;
  }
}
