import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedHermessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import {
  COMMAND_MAX_BUFFER_BYTES,
  COMMAND_TIMEOUT_MS,
  assertAllowedCommand,
  toErrorResult,
  toSuccessResult,
  tokenizeCommand
} from "../safety.js";

const execFileAsync = promisify(execFile);

export function registerRunCommandTool(
  server: McpServer,
  config: ResolvedHermessConfig,
  logger: JsonlLogger
): void {
  server.registerTool(
    "run_command",
    {
      title: "Run Command",
      description: "Run an allowlisted command inside the repository.",
      inputSchema: {
        command: z.string().min(1).describe("Exact command present in allowedCommands")
      }
    },
    async ({ command }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "run_command",
        input: { command }
      });

      try {
        assertAllowedCommand(command, config.allowedCommands);
        const [file, ...args] = tokenizeCommand(command);

        try {
          const { stdout, stderr } = await execFileAsync(file, args, {
            cwd: config.repoPath,
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: COMMAND_MAX_BUFFER_BYTES
          });

          const result = {
            command,
            stdout,
            stderr,
            exitCode: 0
          };

          await logger.log("tool_call_finished", {
            tool: "run_command",
            ok: true,
            durationMs: Date.now() - startedAt,
            exitCode: 0
          });

          return toSuccessResult(result);
        } catch (error) {
          const result = normalizeExecError(command, error);
          await logger.log("tool_call_finished", {
            tool: "run_command",
            ok: false,
            durationMs: Date.now() - startedAt,
            exitCode: result.exitCode
          });
          return toErrorResult(buildCommandFailureMessage(result), result);
        }
      } catch (error) {
        const message = toErrorMessage(error);
        await logger.log("tool_call_finished", {
          tool: "run_command",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message
        });
        return toErrorResult(message);
      }
    }
  );
}

function normalizeExecError(command: string, error: unknown) {
  if (isExecError(error)) {
    return {
      command,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : error.message,
      exitCode: typeof error.code === "number" ? error.code : -1,
      timedOut: error.killed === true
    };
  }

  return {
    command,
    stdout: "",
    stderr: toErrorMessage(error),
    exitCode: -1
  };
}

function buildCommandFailureMessage(
  result: ReturnType<typeof normalizeExecError>
): string {
  if (result.timedOut) {
    return `Command timed out after ${COMMAND_TIMEOUT_MS}ms.`;
  }

  if (typeof result.exitCode === "number" && result.exitCode >= 0) {
    return `Command exited with code ${result.exitCode}.`;
  }

  return "Command execution failed.";
}

function isExecError(
  error: unknown
): error is Error & { stdout?: string; stderr?: string; code?: string | number; killed?: boolean } {
  return error instanceof Error;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
