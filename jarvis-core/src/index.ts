import * as os from 'node:os';
import { Channels } from './shared/protocol';
import type { SystemStatus, ToolCallRecord } from './shared/types';
import { toJarvisError } from './utils/errors';
import { epochMs } from './utils/time';
import { ConfigService } from './config';
import { Logger } from './logger';
import { SqliteResearchRepository } from './database/SqliteResearchRepository';
import { MemoryStore } from './memory/MemoryStore';
import { NodeRegistry } from './esp32/NodeRegistry';
import { FederationManager } from './federation/FederationManager';
import { Esp32Gateway } from './esp32/Esp32Gateway';
import { FleetSimulator } from './esp32/FleetSimulator';
import { DeepSeekClient } from './agent/DeepSeekClient';
import { ToolRegistry } from './agent/ToolRegistry';
import { loadTools } from './tools';
import { AgentRuntime } from './agent/AgentRuntime';
import { ClientManager } from './communication/ClientManager';
import { CoreServer } from './communication/server';
import type { CoreApi } from './communication/api';
import { Scheduler } from './autonomy/Scheduler';
import { ProactiveMonitor } from './autonomy/ProactiveMonitor';
import { SelfImprovement } from './autonomy/SelfImprovement';
import { TelemetryService } from './autonomy/TelemetryService';

/**
 * JARVIS Core — composition root.
 *
 * The standalone "brain" service. Owns the agent runtime, tool registry,
 * ESP32 gateway, federation core, memory and research database, and exposes
 * everything to every client over WebSocket + REST.
 */
async function main(): Promise<void> {
    const configService = new ConfigService();
    const config = configService.load();
    const startedAt = epochMs();

    const logger = new Logger('info', config.dataDir);
    logger.info('core', `Booting JARVIS Core v${config.version}`);

    // ---- persistence ------------------------------------------------------
    const repository = new SqliteResearchRepository(config.dataDir);
    await repository.init();
    const memory = new MemoryStore(config.dataDir);
    memory.init();

    // ---- body (ESP32 fleet + federation) -----------------------------------
    const nodeRegistry = new NodeRegistry(logger);
    const federation = new FederationManager(config.fl.algorithm, logger, repository);
    await federation.init();
    const gateway = new Esp32Gateway(
        config.server.host,
        config.server.esp32Port,
        logger,
        nodeRegistry,
        federation,
        config.autonomy.nodeTimeoutMs
    );

    // ---- brain (agent + tools) --------------------------------------------
    const clientManager = new ClientManager();
    const toolRegistry = new ToolRegistry();
    toolRegistry.registerAll(
        loadTools({
            logger,
            gateway,
            federation,
            repository,
            memory,
            clients: clientManager,
            python: config.python,
            workspace: config.workspace,
            systemStatus: () => systemStatus()
        })
    );

    const deepseek = configService.hasDeepSeekKey()
        ? new DeepSeekClient(config.deepseek.apiKey, config.deepseek.model, config.deepseek.baseUrl, logger)
        : null;

    const agent = new AgentRuntime(logger, repository, memory, toolRegistry, {
        maxToolIterations: config.fl.maxToolIterations,
        client: deepseek
    });

    // ---- api façade --------------------------------------------------------
    const systemStatus = (): SystemStatus => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const load = Array.isArray(os.loadavg()) ? (os.loadavg()[0] ?? 0) : 0;
        return {
            version: config.version,
            platform: `${process.platform}-${process.arch}`,
            uptimeSeconds: Math.floor((epochMs() - startedAt) / 1000),
            nodeCount: nodeRegistry.connectedCount(),
            activeSessions: agent.activeCount(),
            federationActive: federation.getStatus().active,
            wsPort: config.server.wsPort,
            httpPort: config.server.httpPort,
            cpuUsage: Math.min(100, Math.round(load * 100)),
            memoryMb: { total: Math.round(totalMem / 1048576), free: Math.round(freeMem / 1048576) },
            connectedClients: clientManager.countByType()
        };
    };

    const api: CoreApi = {
        config,
        logger,
        repository,
        memory,
        registry: nodeRegistry,
        federation,
        gateway,
        tools: toolRegistry,
        agent,
        clients: clientManager,
        startedAt,
        systemStatus,
        toolLog: (limit: number): Promise<ToolCallRecord[]> => repository.getRecentToolCalls(limit)
    };

    // ---- real-time event wiring --------------------------------------------
    nodeRegistry.subscribe((node) =>
        clientManager.broadcast(Channels.NodeUpdate, { kind: 'status', node })
    );
    federation.subscribe((status) =>
        clientManager.broadcast(Channels.FederationUpdate, { status })
    );
    logger.subscribe((entry) => {
        clientManager.broadcast(Channels.Log, entry);
        void repository.recordLog(entry).catch(() => undefined);
    });

    // ---- servers -----------------------------------------------------------
    const server = new CoreServer(
        api,
        logger,
        clientManager,
        config.server.host,
        config.server.wsPort,
        config.server.httpPort
    );
    await gateway.start();
    await server.start();

    // ---- autonomy -----------------------------------------------------------
    const scheduler = new Scheduler(logger);
    const monitor = new ProactiveMonitor(api, logger);
    const selfImprovement = new SelfImprovement(api, logger);
    scheduler.schedule(config.autonomy.proactiveCron, 'proactive-monitor', () => monitor.run());
    scheduler.schedule(config.autonomy.reflectionCron, 'self-reflection', () => selfImprovement.reflect());

    const telemetry = new TelemetryService(logger, repository, nodeRegistry, federation, systemStatus);
    telemetry.start();

    const fleetSimulator = new FleetSimulator(nodeRegistry, federation, logger, config.demo);
    fleetSimulator.start();

    logger.info(
        'core',
        `JARVIS Core online | WS :${config.server.wsPort} | REST :${config.server.httpPort} | ${deepseek ? 'DeepSeek armed' : 'DEMO mode'} | ${toolRegistry.names().length} tools`
    );

    // ---- graceful shutdown ---------------------------------------------------
    const shutdown = (): void => {
        logger.info('core', 'Shutting down JARVIS Core');
        scheduler.stop();
        telemetry.stop();
        fleetSimulator.stop();
        server.stop();
        gateway.stop();
        repository.dispose();
        memory.dispose();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    const jarvisError = toJarvisError(error);
    console.error(`[jarvis-core] fatal: ${jarvisError.message}`);
    process.exit(1);
});
