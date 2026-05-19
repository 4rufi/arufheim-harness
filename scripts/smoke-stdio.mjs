import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { parseJsonc } from "../dist/init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "harness.config.json");
const distPath = path.join(repoRoot, "dist", "index.js");
const smokeTimeout = setTimeout(() => {
  fail("Smoke timeout.");
}, 15_000);

try {
  await smokeDefaultRepo();
  await smokeMissingRawConfig();
  await smokeSecurityBoundaries();
  smokeJsoncParser();
  console.log("Smoke OK");
} finally {
  clearTimeout(smokeTimeout);
}

async function smokeDefaultRepo() {
  await withharness(
    {
      cwd: repoRoot,
      args: ["--config", configPath],
      name: "harness-smoke-default",
    },
    async ({ client, stderr }) => {
      const { resources } = await client.listResources();
      const resourceUris = resources.map((resource) => resource.uri);
      assert(
        resourceUris.includes("harness://config/raw"),
        `Missing raw config resource. Saw: ${resourceUris.join(", ")}`,
      );
      assert(
        resourceUris.includes("harness://config/resolved"),
        `Missing resolved config resource. Saw: ${resourceUris.join(", ")}`,
      );
      assert(
        resourceUris.includes("harness://logs/main"),
        `Missing log resource. Saw: ${resourceUris.join(", ")}`,
      );

      const rawConfig = await client.readResource({
        uri: "harness://config/raw",
      });
      const rawConfigContent = getTextResource(
        rawConfig,
        "Raw config resource",
      );
      assert(
        rawConfigContent._meta?.exists === true,
        `Expected raw config to exist.\n${JSON.stringify(rawConfigContent._meta)}`,
      );
      assert(
        rawConfigContent.text.includes('"allowedCommands"'),
        `Raw config resource does not look like harness.config.json.\n${rawConfigContent.text}`,
      );

      const configResult = await client.readResource({
        uri: "harness://config/resolved",
      });
      const configText = getTextResource(
        configResult,
        "Resolved config resource",
      ).text;
      assert(
        configText.includes('"allowedCommands"'),
        `Resolved config resource does not look like harness.config.json.\n${configText}`,
      );

      const logResult = await client.readResource({
        uri: "harness://logs/main",
      });
      const logContent = getTextResource(logResult, "Log resource");
      assert(
        typeof logContent._meta?.exists === "boolean",
        `Log resource did not report exists metadata.\n${JSON.stringify(logContent._meta)}`,
      );

      assert(
        stderr.includes("harness MCP ready"),
        `Missing readiness banner.\nstderr:\n${stderr}`,
      );
      assert(
        stderr.includes(`config: ${configPath}`),
        `Missing config path banner.\nstderr:\n${stderr}`,
      );
      assert(
        stderr.includes(`repo: ${repoRoot}`),
        `Missing repo path banner.\nstderr:\n${stderr}`,
      );
    },
  );
}

async function smokeMissingRawConfig() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-missing-"),
  );
  try {
    await withharness(
      {
        cwd: tempRoot,
        args: ["--repo-path", tempRoot],
        name: "harness-smoke-missing-config",
      },
      async ({ client }) => {
        const rawConfig = await client.readResource({
          uri: "harness://config/raw",
        });
        const rawConfigContent = getTextResource(
          rawConfig,
          "Raw config resource without file",
        );
        assert(
          rawConfigContent.text === "",
          `Expected empty raw config when file is missing.\n${rawConfigContent.text}`,
        );
        assert(
          rawConfigContent._meta?.exists === false,
          `Expected exists=false for missing raw config.\n${JSON.stringify(rawConfigContent._meta)}`,
        );
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeSecurityBoundaries() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-security-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const outsidePath = path.join(tempRoot, "outside");

  try {
    await mkdir(repoPath, { recursive: true });
    await mkdir(outsidePath, { recursive: true });
    await writeFile(
      path.join(repoPath, "harness.config.json"),
      JSON.stringify(
        {
          allowedCommands: ["ls missing-target"],
          ignored: ["node_modules/**", ".git/**", "dist/**", ".harness/**"],
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      path.join(repoPath, "inside.txt"),
      "needle inside\n",
      "utf8",
    );
    await writeFile(
      path.join(outsidePath, "secret.txt"),
      "needle outside\n",
      "utf8",
    );
    await symlink(outsidePath, path.join(repoPath, "leak"));

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-security",
      },
      async ({ client }) => {
        const readLeak = await client.callTool({
          name: "read_file",
          arguments: { path: "leak/secret.txt" },
        });
        assert(
          readLeak.isError === true,
          "Symlink escape should fail in read_file.",
        );
        assert(
          JSON.stringify(readLeak.structuredContent).includes(
            "Blocked path traversal attempt",
          ),
          `Unexpected read_file error payload.\n${JSON.stringify(readLeak, null, 2)}`,
        );

        const escapedList = await client.callTool({
          name: "list_files",
          arguments: { pattern: "../outside/secret.txt" },
        });
        assert(
          escapedList.isError === true,
          "Parent glob escape should fail in list_files.",
        );
        assert(
          JSON.stringify(escapedList.structuredContent).includes(
            "cannot traverse outside repoPath",
          ),
          `Unexpected list_files error payload.\n${JSON.stringify(escapedList, null, 2)}`,
        );

        const normalList = await client.callTool({
          name: "list_files",
          arguments: {},
        });
        const listedFiles = normalList.structuredContent?.files ?? [];
        assert(
          !listedFiles.includes("leak/secret.txt"),
          `Symlinked external file leaked through list_files.\n${JSON.stringify(normalList, null, 2)}`,
        );

        const searchResult = await client.callTool({
          name: "search_repo",
          arguments: { query: "needle" },
        });
        const matches = searchResult.structuredContent?.matches ?? [];
        assert(
          matches.some((match) => match.path === "inside.txt"),
          `search_repo did not find the in-repo file.\n${JSON.stringify(searchResult, null, 2)}`,
        );
        assert(
          matches.every((match) => match.path !== "leak/secret.txt"),
          `search_repo leaked a symlinked file outside the repo.\n${JSON.stringify(searchResult, null, 2)}`,
        );

        const failedCommand = await client.callTool({
          name: "run_command",
          arguments: { command: "ls missing-target" },
        });
        assert(
          failedCommand.isError === true,
          "run_command should surface non-zero exit codes as MCP errors.",
        );
        assert(
          failedCommand.structuredContent?.exitCode !== 0,
          `run_command failure did not preserve exitCode.\n${JSON.stringify(failedCommand, null, 2)}`,
        );
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function smokeJsoncParser() {
  const parsed = parseJsonc(`{
    // comment should disappear
    "url": "https://example.com/a//b",
    "text": "/* keep this inside the string */",
    "items": [1, 2,],
    "nested": {
      "value": "still // here",
    },
  }`);

  assert(
    parsed.url === "https://example.com/a//b",
    `parseJsonc mangled URL strings.\n${JSON.stringify(parsed, null, 2)}`,
  );
  assert(
    parsed.text === "/* keep this inside the string */",
    `parseJsonc mangled block comment markers inside strings.\n${JSON.stringify(parsed, null, 2)}`,
  );
  assert(
    Array.isArray(parsed.items) && parsed.items.length === 2,
    `parseJsonc did not tolerate trailing commas.\n${JSON.stringify(parsed, null, 2)}`,
  );
  assert(
    parsed.nested?.value === "still // here",
    `parseJsonc mangled nested string values.\n${JSON.stringify(parsed, null, 2)}`,
  );
}

async function withharness(options, run) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [distPath, ...options.args],
    cwd: options.cwd,
    stderr: "pipe",
  });
  let stderr = "";
  const stderrStream = transport.stderr;

  if (stderrStream) {
    stderrStream.on("data", (chunk) => {
      stderr += chunk.toString();
    });
  }

  const client = new Client(
    {
      name: options.name,
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  );

  try {
    await client.connect(transport);
    await run({ client, stderr });
  } finally {
    await client.close().catch(() => {});
  }
}

function getTextResource(result, label) {
  const content =
    result.contents[0] && "text" in result.contents[0]
      ? result.contents[0]
      : null;

  assert(content !== null, `${label} did not return text content.`);
  return content;
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  clearTimeout(smokeTimeout);
  console.error(message);
  process.exit(1);
}
