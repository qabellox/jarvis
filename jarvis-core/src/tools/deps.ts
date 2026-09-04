import type { LoggerLike } from '../logger';
import type { Esp32Gateway } from '../esp32/Esp32Gateway';
import type { FederationManager } from '../federation/FederationManager';
import type { ResearchRepository } from '../database/ResearchRepository';
import type { MemoryStore } from '../memory/MemoryStore';
import type { SystemStatus } from '../shared/types';
import type { ClientManager } from '../communication/ClientManager';

/** Everything a tool may need. Injected at load time by the Core. */
export interface ToolDeps {
    logger: LoggerLike;
    gateway: Esp32Gateway;
    federation: FederationManager;
    repository: ResearchRepository;
    memory: MemoryStore;
    systemStatus: () => SystemStatus;
    clients: ClientManager;
    python: { allowedDir: string; timeoutMs: number };
    workspace: string;
}
