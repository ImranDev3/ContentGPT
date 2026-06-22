// Shared backend type augmentations.
import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    copyrightFree: boolean;
  }
}
