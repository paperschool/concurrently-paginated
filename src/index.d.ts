import type {
  ConcurrentlyCommandInput,
  ConcurrentlyOptions,
  CloseEvent,
} from "concurrently";
import type { Readable, Writable } from "node:stream";

export interface PaginatedOptions {
  concurrently?: Partial<ConcurrentlyOptions>;
  formatJsonLogs?: boolean;
  input?: Readable & { isTTY?: boolean; setRawMode?: (enabled: boolean) => void };
  jqCommand?: string;
  maxBufferLines?: number;
  output?: Writable & { columns?: number; isTTY?: boolean; rows?: number };
}

export declare function runPaginated(
  commands: ConcurrentlyCommandInput[],
  options?: PaginatedOptions,
): Promise<CloseEvent[]>;

export default runPaginated;