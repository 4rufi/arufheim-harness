#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { isGlobalInit, readInitRepoPath, runInit } from "./init.js";
import { JsonlLogger } from "./logger.js";
import { registerRepoResources } from "./resources/repo-resources.js";
import { registerListFilesTool } from "./tools/list-files.js";
import { registerReadFileTool } from "./tools/read-file.js";
import { registerRunCommandTool } from "./tools/run-command.js";
import { registerSearchRepoTool } from "./tools/search-repo.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv[0] === "init" || argv[0] === "--init") {
    const initArgv = argv.slice(1);
    const repoPath = readInitRepoPath(initArgv);
    const global = isGlobalInit(initArgv);
    await runInit({ repoPath, global });
    return;
  }

  const config = await loadConfig();
  const logger = new JsonlLogger(config.repoPath);

  await logger.log("server_started", {
    configPath: config.configPath,
    repoPath: config.repoPath,
    allowedCommands: config.allowedCommands,
    ignored: config.ignored,
  });

  console.error(
    [
      "harness MCP ready",
      `config: ${config.configPath}`,
      `repo: ${config.repoPath}`,
      `logs: ${logger.logFilePath}`,
    ].join("\n"),
  );

  const server = new McpServer({
    name: "harness",
    version: "0.1.0",
  });

  registerRepoResources(server, config, logger);
  registerListFilesTool(server, config, logger);
  registerReadFileTool(server, config, logger);
  registerSearchRepoTool(server, config, logger);
  registerRunCommandTool(server, config, logger);

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
