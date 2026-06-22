#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { runConfigCommand } from "./config-command.js";
import { runDoctor } from "./doctor.js";
import {
  evaluateHarnessHealth,
  formatHealthBrief,
  recordRuntimeClientVerification,
} from "./health.js";
import { runHelp } from "./help.js";
import { runAgent } from "./agent.js";
import {
  initTarget,
  isGlobalInit,
  isUpdateInit,
  readInitRepoPath,
  runInit,
} from "./init.js";
import { JsonlLogger } from "./logger.js";
import { runRepair } from "./repair.js";
import { registerRepoResources } from "./resources/repo-resources.js";
import { runSimulate } from "./simulate.js";
import { runSetup } from "./setup.js";
import { runStatus } from "./status.js";
import { registerHarnessStatusTool } from "./tools/harness-status.js";
import { registerHarnessLoopEventTool } from "./tools/harness-loop-event.js";
import { registerHarnessLoopStatusTool } from "./tools/harness-loop-status.js";
import { registerHarnessMetricsTool } from "./tools/harness-metrics.js";
import { registerHarnessUpdateTool } from "./tools/harness-update.js";
import { registerInboxTools } from "./tools/inbox.js";
import { registerListFilesTool } from "./tools/list-files.js";
import { registerReadFileTool } from "./tools/read-file.js";
import { registerRunCommandTool } from "./tools/run-command.js";
import { registerSearchRepoTool } from "./tools/search-repo.js";
import { registerMemoryTools } from "./tools/memory.js";
import { registerProgressTools } from "./tools/progress.js";
import { registerWriteFileTool } from "./tools/write-file.js";
import { runTui } from "./tui.js";
import { HARNESS_VERSION } from "./version.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv[0] === "init" || argv[0] === "--init") {
    const initArgv = argv.slice(1);
    const repoPath = readInitRepoPath(initArgv);
    const global = isGlobalInit(initArgv);
    const update = isUpdateInit(initArgv);
    const forceManagedGlobal = initArgv.includes("--force-managed-global");
    const target = initTarget(initArgv);
    await runInit({ repoPath, global, update, forceManagedGlobal, target });
    return;
  }

  if (argv[0] === "doctor") {
    const repoPath = readInitRepoPath(argv.slice(1));
    await runDoctor(repoPath, { json: argv.includes("--json") });
    return;
  }

  if (argv[0] === "setup") {
    await runSetup(argv.slice(1));
    return;
  }

  if (argv[0] === "repair") {
    await runRepair(argv.slice(1));
    return;
  }

  if (argv[0] === "status") {
    await runStatus(argv.slice(1));
    return;
  }

  if (argv[0] === "simulate") {
    await runSimulate(argv.slice(1));
    return;
  }

  if (argv[0] === "agent") {
    const config = await loadConfig({ argv: argv.slice(1) });
    await runAgent(argv.slice(1), config);
    return;
  }

  if (argv[0] === "config") {
    await runConfigCommand(argv.slice(1));
    return;
  }

  if (argv[0] === "tui") {
    await runTui();
    return;
  }

  if (
    argv[0] === "help" ||
    argv[0] === "--help" ||
    argv[0] === "-h" ||
    (argv.length === 0 && process.stdin.isTTY)
  ) {
    runHelp();
    return;
  }

  if (argv.length > 0 && !argv[0].startsWith("-")) {
    process.stderr.write(
      `Unknown command: ${argv[0]}\nRun 'arufheim-harness help' for usage.\n`,
    );
    process.exit(1);
  }

  const config = await loadConfig();
  const logger = new JsonlLogger(config.repoPath);

  await logger.log("server_started", {
    configPath: config.configPath,
    configScope: config.configScope,
    clientId: config.clientId,
    repoPath: config.repoPath,
    allowedCommands: config.allowedCommands,
    ignored: config.ignored,
  });

  if (config.clientId) {
    try {
      await recordRuntimeClientVerification({
        repoPath: config.repoPath,
        clientId: config.clientId,
        configScope: config.configScope,
      });
    } catch (error) {
      await logger.log("client_verification_failed", {
        clientId: config.clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const health = await evaluateHarnessHealth(config.repoPath);

  console.error(
    [
      "harness MCP ready",
      `config: ${config.configPath}`,
      `config_scope: ${config.configScope}`,
      `repo: ${config.repoPath}`,
      `client: ${config.clientId ?? "unknown"}`,
      `layout: ${health.workflow_layout}`,
      `health: ${formatHealthBrief(health)}`,
      `logs: ${logger.logFilePath}`,
    ].join("\n"),
  );

  const server = new McpServer({
    name: "harness",
    version: HARNESS_VERSION,
  });

  registerRepoResources(server, config, logger);
  registerListFilesTool(server, config, logger);
  registerReadFileTool(server, config, logger);
  registerWriteFileTool(server, config, logger);
  registerSearchRepoTool(server, config, logger);
  registerRunCommandTool(server, config, logger);
  registerHarnessStatusTool(server, config, logger);
  registerHarnessLoopStatusTool(server, config, logger);
  registerHarnessLoopEventTool(server, config, logger);
  registerHarnessMetricsTool(server, config, logger);
  registerHarnessUpdateTool(server, config, logger);
  registerInboxTools(server);
  registerMemoryTools(server);
  registerProgressTools(server, config, logger);

  process.on("SIGINT", () => {
    void logger
      .log("server_stopped", { signal: "SIGINT" })
      .finally(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    void logger
      .log("server_stopped", { signal: "SIGTERM" })
      .finally(() => process.exit(0));
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
