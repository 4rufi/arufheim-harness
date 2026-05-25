import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import { enforcePermissionPolicy } from "../policy.js";
import { recordCommandCall, recordToolCall } from "../session-metrics.js";
import {
  COMMAND_MAX_BUFFER_BYTES,
  COMMAND_TIMEOUT_MS,
  assertAllowedCommand,
  toErrorResult,
  toSuccessResult,
  tokenizeCommand,
} from "../safety.js";

const execFileAsync = promisify(execFile);

export function registerRunCommandTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "run_command",
    {
      title: "Run Command",
      description: "Run an allowlisted command inside the repository.",
      inputSchema: {
        command: z
          .string()
          .min(1)
          .describe("Exact command present in allowedCommands"),
        max_lines: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe(
            "Max output lines to return (default: 100). Lower = fewer tokens.",
          ),
      },
    },
    async ({ command, max_lines = 100 }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "run_command");

      await logger.log("tool_call_started", {
        tool: "run_command",
        input: { command, max_lines },
      });

      try {
        enforcePermissionPolicy(config.permissionPolicy, "run_command", "R3");
        assertAllowedCommand(command, config.allowedCommands);
        const [file, ...args] = tokenizeCommand(command);

        try {
          const { stdout, stderr } = await execFileAsync(file, args, {
            cwd: config.repoPath,
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: COMMAND_MAX_BUFFER_BYTES,
          });

          const truncStdout = truncateLines(stdout, max_lines);
          const truncStderr = truncateLines(stderr, max_lines);

          const result = {
            command,
            stdout: truncStdout.text,
            stderr: truncStderr.text,
            exitCode: 0,
            ...(truncStdout.omitted > 0 && {
              stdoutOmitted: truncStdout.omitted,
            }),
            ...(truncStderr.omitted > 0 && {
              stderrOmitted: truncStderr.omitted,
            }),
          };
          await recordCommandCall(
            config.repoPath,
            Buffer.byteLength(result.stdout + result.stderr, "utf8"),
          );

          await logger.log("tool_call_finished", {
            tool: "run_command",
            ok: true,
            durationMs: Date.now() - startedAt,
            exitCode: 0,
          });

          return toSuccessResult(result);
        } catch (error) {
          const raw = normalizeExecError(command, error);
          const truncStdout = truncateLines(raw.stdout, max_lines);
          const truncStderr = truncateLines(raw.stderr, max_lines);
          const result = {
            ...raw,
            stdout: truncStdout.text,
            stderr: truncStderr.text,
            ...(truncStdout.omitted > 0 && {
              stdoutOmitted: truncStdout.omitted,
            }),
            ...(truncStderr.omitted > 0 && {
              stderrOmitted: truncStderr.omitted,
            }),
          };
          await logger.log("tool_call_finished", {
            tool: "run_command",
            ok: false,
            durationMs: Date.now() - startedAt,
            exitCode: result.exitCode,
          });
          return toErrorResult(buildCommandFailureMessage(result), result);
        }
      } catch (error) {
        const message = toErrorMessage(error);
        await logger.log("tool_call_finished", {
          tool: "run_command",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}

function normalizeExecError(command: string, error: unknown) {
  if (isExecError(error)) {
    return {
      command,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : error.message,
      exitCode: typeof error.code === "number" ? error.code : -1,
      timedOut: error.killed === true,
    };
  }

  return {
    command,
    stdout: "",
    stderr: toErrorMessage(error),
    exitCode: -1,
  };
}

function buildCommandFailureMessage(
  result: ReturnType<typeof normalizeExecError>,
): string {
  if (result.timedOut) {
    return `Command timed out after ${COMMAND_TIMEOUT_MS}ms.`;
  }

  if (typeof result.exitCode === "number" && result.exitCode >= 0) {
    return `Command exited with code ${result.exitCode}.`;
  }

  return "Command execution failed.";
}

function isExecError(error: unknown): error is Error & {
  stdout?: string;
  stderr?: string;
  code?: string | number;
  killed?: boolean;
} {
  return error instanceof Error;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncateLines(
  text: string,
  maxLines: number,
): { text: string; omitted: number } {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return { text, omitted: 0 };
  return {
    text:
      lines.slice(0, maxLines).join("\n") +
      `\n[+${lines.length - maxLines} líneas omitidas]`,
    omitted: lines.length - maxLines,
  };
}
