import {
  mkdtemp,
  mkdir,
  readdir,
  realpath,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { loadConfig } from "../dist/config.js";
import { parseJsonc } from "../dist/init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "harness.config.json");
const distPath = path.join(repoRoot, "dist", "index.js");
const smokeXdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-smoke-xdg-"));
process.env.XDG_CONFIG_HOME = smokeXdgHome;
const smokeManagedShimPath = path.join(
  smokeXdgHome,
  "arufheim-harness",
  "bin",
  process.platform === "win32" ? "arufheim-harness.cmd" : "arufheim-harness",
);
const harnessVersion = JSON.parse(
  await readFile(path.join(repoRoot, "package.json"), "utf8"),
).version;
const DEFAULT_CURRENT_MD = `# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a \`history.md\`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** _ninguna_
- **Inicio:** _—_
- **Agente:** _—_

## Plan

_—_

## Bitácora

_—_

## Próximo paso

_—_
`;
const DEFAULT_HISTORY_MD = `# Bitácora histórica (append-only)

> Cada vez que se cierra una sesión, su resumen se añade aquí.
> No edites entradas anteriores. Solo añades al final.

---
`;
const smokeTimeout = setTimeout(() => {
  fail("Smoke timeout.");
}, 30_000);

const seededManagedRuntime = spawnSync(
  process.execPath,
  [distPath, "setup", "--global-runtime"],
  {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: smokeXdgHome,
    },
  },
);
if (seededManagedRuntime.status !== 0) {
  throw new Error(
    `Failed to seed managed runtime for smoke.\nstdout:\n${seededManagedRuntime.stdout}\nstderr:\n${seededManagedRuntime.stderr}`,
  );
}

try {
  await smokeDefaultRepo();
  await smokeBriefMinimalAndResponseMetrics();
  await smokeMissingRawConfig();
  await smokeInvalidExplicitRepoConfig();
  await smokeGlobalFallbackRequiresRepoBinding();
  await smokeSecurityBoundaries();
  await smokeWorkflowConcurrencyAndReadRanges();
  await smokeSddWorkflowCloseValidation();
  await smokeLoopEngineeringContract();
  await smokeSimulateFlows();
  await smokeLegacyRootCompatibility();
  await smokeWorkflowHiddenLayout();
  await smokeSetupAndRepair();
  await smokeTestingPolicyAndHeadroom();
  await smokeRelativeRepoPathStatusFallback();
  await smokeStatusBriefRefreshesStaleHealth();
  await smokeCodexOnlySetupContract();
  await smokeThinMigrationExecution();
  await smokeRepoScopedManagedUpdate();
  await smokeGlobalPreferredRepoScopedBindings();
  await smokeAssumedGlobalBindings();
  await smokeGlobalInvalidConfigPreservation();
  await smokeGlobalInvalidConfigForceRecovery();
  await smokeInitScaffold();
  await smokeExistingAgentsUpgrade();
  await smokeConfigCommandMutations();
  await smokeReleasePublishGate();
  await smokeManagedRuntimeSharedDocs();
  smokeCliSurfaces();
  smokeJsoncParser();
  console.log("Smoke OK");
} finally {
  clearTimeout(smokeTimeout);
  await rm(smokeXdgHome, { recursive: true, force: true });
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
        resourceUris.includes("harness://health"),
        `Missing health resource. Saw: ${resourceUris.join(", ")}`,
      );
      assert(
        resourceUris.includes("harness://loop/active"),
        `Missing active loop resource. Saw: ${resourceUris.join(", ")}`,
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

      const healthResult = await client.readResource({
        uri: "harness://health",
      });
      const healthText = getTextResource(healthResult, "Health resource").text;
      const health = JSON.parse(healthText);
      assert(
        Array.isArray(health.alerts) &&
          typeof health.binding_status?.state === "string" &&
          typeof health.client_verification?.vscode?.state === "string" &&
          typeof health.doctor_summary?.status === "string",
        `Health resource did not expose the expected summary fields.\n${healthText}`,
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
      assert(
        stderr.includes("layout: hidden") && stderr.includes("health:"),
        `Missing layout/health banner.\nstderr:\n${stderr}`,
      );
      assert(
        stderr.includes("config_scope: repo") &&
          stderr.includes("client: unknown"),
        `Missing config_scope/client banner.\nstderr:\n${stderr}`,
      );

      const statusResult = await client.callTool({
        name: "harness_status",
        arguments: {},
      });
      assert(
        statusResult.isError !== true,
        `harness_status failed on repo-root workflow layout.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        typeof statusResult.structuredContent?.archived_features_count ===
          "number" &&
          statusResult.structuredContent.archived_features_count >= 1,
        `harness_status did not parse feature_list.json correctly.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        statusResult.structuredContent?.repo_path === repoRoot,
        `harness_status did not expose repo_path.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        statusResult.structuredContent?.config_path === configPath,
        `harness_status did not expose config_path.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        statusResult.structuredContent?.config_scope === "repo",
        `harness_status did not expose config_scope.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        statusResult.structuredContent?.workflow_layout === "hidden",
        `harness_status did not expose workflow_layout.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        Array.isArray(statusResult.structuredContent?.alerts),
        `harness_status did not expose alerts.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        typeof statusResult.structuredContent?.binding_status?.state === "string",
        `harness_status did not expose binding_status.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        typeof statusResult.structuredContent?.client_verification?.vscode?.state ===
          "string",
        `harness_status did not expose client_verification.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        typeof statusResult.structuredContent?.client_readiness?.vscode?.state ===
          "string",
        `harness_status did not expose client_readiness.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        typeof statusResult.structuredContent?.doctor_summary?.status === "string",
        `harness_status did not expose doctor_summary.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        "last_verified_at" in (statusResult.structuredContent ?? {}),
        `harness_status did not expose last_verified_at.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        typeof statusResult.structuredContent?.degraded_mode === "boolean",
        `harness_status did not expose degraded_mode.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        String(statusResult.structuredContent?.startup_brief ?? "").includes(
          `repo=${repoRoot}`,
        ),
        `startup_brief did not include repo identity.\n${JSON.stringify(statusResult, null, 2)}`,
      );
      assert(
        String(statusResult.structuredContent?.startup_brief ?? "").includes(
          "health=",
        ),
        `startup_brief did not include health summary.\n${JSON.stringify(statusResult, null, 2)}`,
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

async function smokeBriefMinimalAndResponseMetrics() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-brief-minimal-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await seedHiddenWorkflowRepo(repoPath);

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-brief-minimal",
      },
      async ({ client }) => {
        const statusResult = await client.callTool({
          name: "harness_status",
          arguments: { mode: "brief_minimal" },
        });
        assert(
          statusResult.isError !== true,
          `harness_status brief_minimal failed.\n${JSON.stringify(statusResult, null, 2)}`,
        );
        const snapshot = statusResult.structuredContent ?? {};
        assert(
          snapshot.repo_path === repoPath &&
            snapshot.config_scope === "repo" &&
            typeof snapshot.startup_brief === "string" &&
            snapshot.startup_brief.includes(`repo=${repoPath}`) &&
            typeof snapshot.doctor_summary?.status === "string",
          `brief_minimal did not expose the minimal startup contract.\n${JSON.stringify(statusResult, null, 2)}`,
        );
        assert(
          !("client_readiness" in snapshot) &&
            !("client_verification" in snapshot) &&
            !("binding_status" in snapshot) &&
            !("pending_count" in snapshot),
          `brief_minimal leaked rich startup fields.\n${JSON.stringify(statusResult, null, 2)}`,
        );

        const metrics = JSON.parse(
          await readFile(
            path.join(repoPath, ".harness", "metrics", "session.json"),
            "utf8",
          ),
        );
        assert(
          metrics.response_output_bytes_by_surface?.["tool:harness_status:brief_minimal"] >
            0 &&
            metrics.response_output_tokens_by_surface?.[
              "tool:harness_status:brief_minimal"
            ] > 0,
          `session metrics did not record harness_status brief_minimal output.\n${JSON.stringify(metrics, null, 2)}`,
        );
      },
    );

    const statusJson = spawnSync(
      process.execPath,
      [distPath, "status", "--repo-path", repoPath, "--brief-minimal", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      statusJson.status === 0,
      `status --brief-minimal --json failed.\nstdout:\n${statusJson.stdout}\nstderr:\n${statusJson.stderr}`,
    );
    const statusSnapshot = JSON.parse(statusJson.stdout);
    assert(
      statusSnapshot.repo_path === repoPath &&
        statusSnapshot.config_scope === "repo" &&
        typeof statusSnapshot.startup_brief === "string" &&
        statusSnapshot.startup_brief.includes(`repo=${repoPath}`) &&
        typeof statusSnapshot.doctor_summary?.status === "string" &&
        !("client_readiness" in statusSnapshot) &&
        !("binding_status" in statusSnapshot),
      `status --brief-minimal --json did not expose the minimal startup contract.\n${statusJson.stdout}`,
    );

    const statusText = spawnSync(
      process.execPath,
      [distPath, "status", "--repo-path", repoPath, "--brief-minimal"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      statusText.status === 0 &&
        statusText.stdout.includes(`repo=${repoPath}`) &&
        !statusText.stdout.includes("activation:"),
      `status --brief-minimal did not emit the expected minimal text output.\nstdout:\n${statusText.stdout}\nstderr:\n${statusText.stderr}`,
    );

    const metrics = JSON.parse(
      await readFile(
        path.join(repoPath, ".harness", "metrics", "session.json"),
        "utf8",
      ),
    );
    assert(
      metrics.response_output_bytes_by_surface?.[
        "cli:status:brief_minimal:json"
      ] > 0 &&
        metrics.response_output_bytes_by_surface?.[
          "cli:status:brief_minimal:text"
        ] > 0 &&
        metrics.response_output_tokens > 0 &&
        metrics.estimated_local_tokens >= metrics.response_output_tokens,
      `session metrics did not record CLI brief_minimal output.\n${JSON.stringify(metrics, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeInvalidExplicitRepoConfig() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-invalid-config-"),
  );
  try {
    await writeFile(
      path.join(tempRoot, "harness.config.json"),
      JSON.stringify(
        {
          allowedCommands: 5,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const invalidConfig = spawnSync(
      process.execPath,
      [distPath, "--repo-path", tempRoot],
      {
        cwd: tempRoot,
        encoding: "utf8",
        timeout: 5_000,
      },
    );

    assert(
      invalidConfig.status !== 0,
      `Expected explicit --repo-path with invalid config to fail closed.\nstdout:\n${invalidConfig.stdout}\nstderr:\n${invalidConfig.stderr}`,
    );
    assert(
      /expected array|zod|invalid/i.test(
        `${invalidConfig.stdout}\n${invalidConfig.stderr}`,
      ),
      `Invalid explicit config did not surface a parse/schema error.\nstdout:\n${invalidConfig.stdout}\nstderr:\n${invalidConfig.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeGlobalFallbackRequiresRepoBinding() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-global-binding-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const xdgHome = path.join(tempRoot, "xdg");
  const globalConfigDir = path.join(xdgHome, "arufheim-harness");

  try {
    await mkdir(repoPath, { recursive: true });
    await mkdir(globalConfigDir, { recursive: true });
    await writeFile(
      path.join(globalConfigDir, "harness.config.json"),
      JSON.stringify({ version: 1 }, null, 2) + "\n",
      "utf8",
    );

    let failed = false;
    let message = "";
    try {
      await loadConfig({
        cwd: repoPath,
        argv: [],
        env: {
          ...process.env,
          XDG_CONFIG_HOME: xdgHome,
        },
      });
    } catch (error) {
      failed = true;
      message = error instanceof Error ? error.message : String(error);
    }

    assert(
      failed,
      "Expected loadConfig to fail closed when only a global fallback config is available.",
    );
    assert(
      /explicit repo binding|repo-local harness\.config\.json/i.test(message),
      `Global fallback failure did not explain the missing repo binding.\n${message}`,
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
    await symlink(
      path.join(outsidePath, "secret.txt"),
      path.join(repoPath, "write-leak.txt"),
    );

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

        const escapedSearch = await client.callTool({
          name: "search_repo",
          arguments: {
            query: "needle",
            include: "../outside/**/*.txt",
          },
        });
        assert(
          escapedSearch.isError === true,
          "Parent glob escape should fail in search_repo.",
        );
        assert(
          JSON.stringify(escapedSearch.structuredContent).includes(
            "cannot traverse outside repoPath",
          ),
          `Unexpected search_repo error payload.\n${JSON.stringify(escapedSearch, null, 2)}`,
        );

        const normalWrite = await client.callTool({
          name: "write_file",
          arguments: { path: "written.txt", content: "inside write\n" },
        });
        assert(
          normalWrite.isError !== true,
          `write_file failed for a normal in-repo file.\n${JSON.stringify(normalWrite, null, 2)}`,
        );

        const writeLeak = await client.callTool({
          name: "write_file",
          arguments: { path: "write-leak.txt", content: "should fail\n" },
        });
        assert(
          writeLeak.isError === true,
          "write_file should reject a symlinked target that points outside the repo.",
        );
        assert(
          JSON.stringify(writeLeak.structuredContent).includes(
            "Blocked symlink escape attempt",
          ),
          `Unexpected write_file error payload.\n${JSON.stringify(writeLeak, null, 2)}`,
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

async function smokeWorkflowConcurrencyAndReadRanges() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-concurrency-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await seedHiddenWorkflowRepo(repoPath);

    const largeLines = Array.from({ length: 14_000 }, (_, index) => {
      return `line ${String(index + 1).padStart(5, "0")} ${"x".repeat(12)}`;
    });
    await writeFile(
      path.join(repoPath, "large.txt"),
      largeLines.join("\n") + "\n",
      "utf8",
    );

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-concurrency",
      },
      async ({ client }) => {
        const addResults = await Promise.all(
          Array.from({ length: 5 }, (_, index) =>
            client.callTool({
              name: "harness_add",
              arguments: {
                name: `concurrent-${index + 1}`,
                description: `feature ${index + 1}`,
              },
            }),
          ),
        );

        const addedIds = addResults.map(
          (result) => result.structuredContent?.added?.id,
        );
        assert(
          new Set(addedIds).size === 5,
          `Concurrent harness_add calls produced duplicate ids.\n${JSON.stringify(addResults, null, 2)}`,
        );

        const featureListRaw = await readFile(
          path.join(repoPath, ".harness", "feature_list.json"),
          "utf8",
        );
        const featureList = JSON.parse(featureListRaw);
        assert(
          Array.isArray(featureList.features) && featureList.features.length === 6,
          `Concurrent harness_add calls lost features.\n${featureListRaw}`,
        );

        const lateRange = await client.callTool({
          name: "read_file",
          arguments: {
            path: "large.txt",
            start_line: 13_990,
            end_line: 13_992,
          },
        });
        assert(
          lateRange.isError !== true,
          `read_file failed for late-line range.\n${JSON.stringify(lateRange, null, 2)}`,
        );
        assert(
          lateRange.structuredContent?.content.includes("line 13990") &&
            lateRange.structuredContent?.content.includes("line 13992"),
          `read_file returned the wrong late-line slice.\n${JSON.stringify(lateRange, null, 2)}`,
        );
        assert(
          lateRange.structuredContent?.startLine === 13_990 &&
            lateRange.structuredContent?.endLine === 13_992,
          `read_file did not preserve the requested logical range.\n${JSON.stringify(lateRange, null, 2)}`,
        );

        const truncatedRange = await client.callTool({
          name: "read_file",
          arguments: {
            path: "large.txt",
            start_line: 1,
            end_line: 14_000,
          },
        });
        assert(
          truncatedRange.structuredContent?.truncatedBySize === true,
          `Expected read_file to truncate a huge selected range.\n${JSON.stringify(truncatedRange, null, 2)}`,
        );
        assert(
          truncatedRange.structuredContent?.endLine === 14_000 &&
            typeof truncatedRange.structuredContent?.previewEndLine === "number",
          `read_file did not preserve logical endLine when truncating.\n${JSON.stringify(truncatedRange, null, 2)}`,
        );

        const invertedRange = await client.callTool({
          name: "read_file",
          arguments: {
            path: "large.txt",
            start_line: 20,
            end_line: 10,
          },
        });
        assert(
          invertedRange.isError === true,
          `Expected read_file to reject inverted ranges.\n${JSON.stringify(invertedRange, null, 2)}`,
        );
        assert(
          JSON.stringify(invertedRange.structuredContent).includes(
            "Invalid line range",
          ),
          `read_file returned the wrong error for an inverted range.\n${JSON.stringify(invertedRange, null, 2)}`,
        );
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeSddWorkflowCloseValidation() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-sdd-close-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const featureName = "hidden-sdd-alpha";

  try {
    await seedHiddenSddRepo(repoPath, featureName);

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-sdd-close",
      },
      async ({ client }) => {
        const missingSpec = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "spec_ready" },
        });
        assert(
          missingSpec.isError === true,
          `Expected harness_update to reject SDD transitions without specs.\n${JSON.stringify(missingSpec, null, 2)}`,
        );
        assert(
          JSON.stringify(missingSpec.structuredContent).includes(
            `specs/${featureName}/requirements.md`,
          ),
          `Missing-spec error did not point to the spec folder.\n${JSON.stringify(missingSpec, null, 2)}`,
        );

        await writeSddSpecFiles(repoPath, featureName);

        const markSpecReady = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "spec_ready" },
        });
        assert(
          markSpecReady.structuredContent?.updated?.status === "spec_ready",
          `harness_update did not enter spec_ready after specs were added.\n${JSON.stringify(markSpecReady, null, 2)}`,
        );

        const markInProgress = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "in_progress" },
        });
        assert(
          markInProgress.structuredContent?.updated?.status === "in_progress",
          `harness_update did not enter in_progress after specs were added.\n${JSON.stringify(markInProgress, null, 2)}`,
        );

        const missingEvidence = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "done" },
        });
        assert(
          missingEvidence.isError === true,
          `Expected harness_update to reject closing SDD features without evidence.\n${JSON.stringify(missingEvidence, null, 2)}`,
        );
        assert(
          JSON.stringify(missingEvidence.structuredContent).includes(
            `.harness/progress/impl_${featureName}.md`,
          ),
          `Missing-evidence error did not point to the implementation artifact.\n${JSON.stringify(missingEvidence, null, 2)}`,
        );

        await writeFile(
          path.join(repoPath, ".harness", "progress", `impl_${featureName}.md`),
          "# Implementación\n\n- R1 -> spec presente\n- R2 -> evidencia presente\n",
          "utf8",
        );
        await writeFile(
          path.join(repoPath, ".harness", "progress", `review_${featureName}.md`),
          "# Review\n\n- [x] Checklist completa\n\nAPROBADO\n",
          "utf8",
        );

        const closeFeature = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "done" },
        });
        assert(
          closeFeature.structuredContent?.updated?.status === "done",
          `harness_update did not close the SDD feature after evidence was added.\n${JSON.stringify(closeFeature, null, 2)}`,
        );
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeLoopEngineeringContract() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-loop-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const featureName = "loop-alpha";

  try {
    await seedHiddenSddRepo(repoPath, featureName);
    await writeSddSpecFiles(repoPath, featureName);

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-loop",
      },
      async ({ client }) => {
        const markSpecReady = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "spec_ready" },
        });
        assert(
          markSpecReady.structuredContent?.updated?.status === "spec_ready",
          `loop smoke did not enter spec_ready.\n${JSON.stringify(markSpecReady, null, 2)}`,
        );

        const markInProgress = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "in_progress" },
        });
        assert(
          markInProgress.structuredContent?.updated?.status === "in_progress",
          `loop smoke did not enter in_progress.\n${JSON.stringify(markInProgress, null, 2)}`,
        );

        const seededLoop = await readSingleLoopFile(repoPath);
        assert(
          seededLoop.phase === "plan" &&
            seededLoop.attempt_index === 1 &&
            seededLoop.next_actor === "leader",
          `loop file was not seeded in plan phase.\n${JSON.stringify(seededLoop, null, 2)}`,
        );

        const loopStatus = await client.callTool({
          name: "harness_loop_status",
          arguments: { feature_id: 1 },
        });
        assert(
          loopStatus.structuredContent?.exists === true &&
            loopStatus.structuredContent?.loop_summary?.phase === "plan",
          `harness_loop_status did not expose the seeded plan loop.\n${JSON.stringify(loopStatus, null, 2)}`,
        );

        const minimalStatus = await client.callTool({
          name: "harness_status",
          arguments: { mode: "brief_minimal" },
        });
        const startupBrief = minimalStatus.structuredContent?.startup_brief ?? "";
        assert(
          String(startupBrief).includes("loop=plan:a1"),
          `brief_minimal did not expose the compact loop signal.\n${JSON.stringify(minimalStatus, null, 2)}`,
        );

        const loopResource = await client.readResource({
          uri: "harness://loop/active",
        });
        const loopResourceContent = JSON.parse(
          getTextResource(loopResource, "Loop resource").text,
        );
        assert(
          loopResourceContent.exists === true &&
            loopResourceContent.loop_summary?.phase === "plan",
          `harness://loop/active did not reflect the seeded loop.\n${JSON.stringify(loopResourceContent, null, 2)}`,
        );

        const planEvent = await client.callTool({
          name: "harness_loop_event",
          arguments: {
            feature_id: 1,
            phase: "plan",
            actor: "leader",
            outcome: "success",
            summary: "plan ready",
            progress_delta: "meaningful",
          },
        });
        assert(
          planEvent.structuredContent?.loop_summary?.phase === "execute",
          `plan event did not move the loop to execute.\n${JSON.stringify(planEvent, null, 2)}`,
        );

        const executeEvent = await client.callTool({
          name: "harness_loop_event",
          arguments: {
            feature_id: 1,
            phase: "execute",
            actor: "implementer",
            outcome: "success",
            summary: "first attempt implemented",
            verification: "unit tests added",
            progress_delta: "meaningful",
          },
        });
        assert(
          executeEvent.structuredContent?.loop_summary?.phase === "verify",
          `execute event did not move the loop to verify.\n${JSON.stringify(executeEvent, null, 2)}`,
        );

        const verifyFailed = await client.callTool({
          name: "harness_loop_event",
          arguments: {
            feature_id: 1,
            phase: "verify",
            actor: "leader",
            outcome: "verification_failed",
            summary: "tests still red",
            verification: "npm test",
            error_signature: "tests:red",
            progress_delta: "none",
          },
        });
        assert(
          verifyFailed.structuredContent?.loop_summary?.phase === "analyze",
          `verify failure did not move the loop to analyze.\n${JSON.stringify(verifyFailed, null, 2)}`,
        );

        const invalidRetry = await client.callTool({
          name: "harness_loop_event",
          arguments: {
            feature_id: 1,
            phase: "route_back",
            actor: "leader",
            outcome: "retry",
            summary: "retry same path",
            error_signature: "tests:red",
            progress_delta: "none",
          },
        });
        assert(
          invalidRetry.isError === true &&
            JSON.stringify(invalidRetry.structuredContent).includes("strategy_delta"),
          `Equivalent retry without strategy_delta should fail.\n${JSON.stringify(invalidRetry, null, 2)}`,
        );

        const validRetry = await client.callTool({
          name: "harness_loop_event",
          arguments: {
            feature_id: 1,
            phase: "route_back",
            actor: "leader",
            outcome: "retry",
            summary: "narrow failing surface",
            error_signature: "tests:red",
            progress_delta: "none",
            strategy_delta: "narrow failing test scope and isolate CLI snapshot",
            next_actor: "implementer",
          },
        });
        assert(
          validRetry.structuredContent?.loop_summary?.phase === "execute" &&
            validRetry.structuredContent?.loop_summary?.attempt_index === 2,
          `Valid route-back did not increment the attempt.\n${JSON.stringify(validRetry, null, 2)}`,
        );

        const richStatus = await client.callTool({
          name: "harness_status",
          arguments: { mode: "brief_only" },
        });
        assert(
          richStatus.structuredContent?.loop_summary?.attempt_index === 2 &&
            richStatus.structuredContent?.loop_summary?.phase === "execute",
          `brief_only did not expose loop_summary.\n${JSON.stringify(richStatus, null, 2)}`,
        );
      },
    );

    const loopPath = await readSingleLoopFilePath(repoPath);
    await rm(loopPath, { force: true });

    const doctorBeforeRepair = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorBeforeRepair.status !== 0 &&
        doctorBeforeRepair.stdout.includes("loop.active.missing"),
      `doctor should fail when an in-progress feature loses its loop file.\nstdout:\n${doctorBeforeRepair.stdout}\nstderr:\n${doctorBeforeRepair.stderr}`,
    );

    const setupUpdate = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath, "--update"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setupUpdate.status === 0,
      `setup --update should reseed a missing active loop.\nstdout:\n${setupUpdate.stdout}\nstderr:\n${setupUpdate.stderr}`,
    );
    await readSingleLoopFile(repoPath);

    await rm(await readSingleLoopFilePath(repoPath), { force: true });
    const repair = spawnSync(
      process.execPath,
      [distPath, "repair", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      repair.status === 0,
      `repair should reseed a missing active loop.\nstdout:\n${repair.stdout}\nstderr:\n${repair.stderr}`,
    );
    await readSingleLoopFile(repoPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeSimulateFlows() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-simulate-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const sessionPath = path.join(repoPath, ".harness", "metrics", "session.json");

  try {
    await mkdir(repoPath, { recursive: true });

    const setup = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath, "--clients", "codex"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setup.status === 0,
      `simulate smoke setup failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );

    const beforeStartupMetrics = (await fileExists(sessionPath))
      ? await readFile(sessionPath, "utf8")
      : null;
    const startupSimulation = spawnSync(
      process.execPath,
      [distPath, "simulate", "--repo-path", repoPath, "--flow", "startup", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      startupSimulation.status === 0,
      `simulate startup failed.\nstdout:\n${startupSimulation.stdout}\nstderr:\n${startupSimulation.stderr}`,
    );
    const startupPayload = JSON.parse(startupSimulation.stdout);
    assert(
      Array.isArray(startupPayload.flows) &&
        startupPayload.flows.length === 1 &&
        startupPayload.flows[0].flow === "startup" &&
        startupPayload.flows[0].steps[0].surface ===
          "cli:status:brief_minimal:json" &&
        startupPayload.flows[0].total_tokens > 0,
      `simulate startup did not return the expected flow payload.\n${startupSimulation.stdout}`,
    );
    const afterStartupMetrics = (await fileExists(sessionPath))
      ? await readFile(sessionPath, "utf8")
      : null;
    assert(
      afterStartupMetrics === beforeStartupMetrics,
      "simulate startup should not mutate .harness/metrics/session.json.",
    );

    const featureListPath = path.join(repoPath, ".harness", "feature_list.json");
    const featureDoc = JSON.parse(await readFile(featureListPath, "utf8"));
    featureDoc.features = [
      {
        id: 1,
        name: "loop_probe",
        description: "simulate loop flow",
        status: "in_progress",
      },
    ];
    await writeJson(featureListPath, featureDoc, true);

    const repair = spawnSync(
      process.execPath,
      [distPath, "repair", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      repair.status === 0,
      `simulate loop repair failed.\nstdout:\n${repair.stdout}\nstderr:\n${repair.stderr}`,
    );

    const beforeLoopMetrics = (await fileExists(sessionPath))
      ? await readFile(sessionPath, "utf8")
      : null;
    const loopSimulation = spawnSync(
      process.execPath,
      [
        distPath,
        "simulate",
        "--repo-path",
        repoPath,
        "--flow",
        "loop,triage",
        "--json",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      loopSimulation.status === 0,
      `simulate loop/triage failed.\nstdout:\n${loopSimulation.stdout}\nstderr:\n${loopSimulation.stderr}`,
    );
    const loopPayload = JSON.parse(loopSimulation.stdout);
    const loopFlow = loopPayload.flows.find((flow) => flow.flow === "loop");
    const triageFlow = loopPayload.flows.find((flow) => flow.flow === "triage");
    assert(
      loopFlow &&
        loopFlow.steps.some(
          (step) =>
            step.surface === "tool:harness_loop_status:json" &&
            step.detail === "plan:a1",
        ) &&
        loopFlow.total_tokens > startupPayload.flows[0].total_tokens,
      `simulate loop did not reflect the active loop payload.\n${loopSimulation.stdout}`,
    );
    assert(
      triageFlow &&
        triageFlow.steps.some((step) => step.surface === "cli:doctor:json") &&
        triageFlow.total_tokens > loopFlow.total_tokens,
      `simulate triage did not include the expected richer surfaces.\n${loopSimulation.stdout}`,
    );
    const afterLoopMetrics = (await fileExists(sessionPath))
      ? await readFile(sessionPath, "utf8")
      : null;
    assert(
      afterLoopMetrics === beforeLoopMetrics,
      "simulate loop/triage should not mutate .harness/metrics/session.json.",
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeWorkflowHiddenLayout() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-workflow-hidden-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await seedHiddenWorkflowRepo(repoPath);

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-workflow-hidden",
      },
      async ({ client }) => {
        const initialStatus = await client.callTool({
          name: "harness_status",
          arguments: { mode: "brief_only" },
        });
        assert(
          initialStatus.structuredContent?.pending_count === 1,
          `harness_status did not parse hidden feature_list.json.\n${JSON.stringify(initialStatus, null, 2)}`,
        );
        assert(
          initialStatus.structuredContent?.inbox_count === 1,
          `harness_status should exclude README.md from inbox_count.\n${JSON.stringify(initialStatus, null, 2)}`,
        );
        assert(
          initialStatus.structuredContent?.next_step === "(sin plan activo)",
          `harness_status did not ignore the hidden-layout placeholder.\n${JSON.stringify(initialStatus, null, 2)}`,
        );

        const hiddenInbox = await client.callTool({
          name: "inbox_list",
          arguments: {},
        });
        const hiddenInboxEntries = JSON.parse(firstText(hiddenInbox));
        assert(
          hiddenInboxEntries.length === 1 &&
            hiddenInboxEntries[0].name === "hidden-task.md",
          `inbox_list did not use the hidden inbox layout.\n${JSON.stringify(hiddenInbox, null, 2)}`,
        );
        assert(
          !firstText(hiddenInbox).includes("README.md"),
          `inbox_list leaked reserved inbox files.\n${JSON.stringify(hiddenInbox, null, 2)}`,
        );
        const reservedInboxFile = await client.callTool({
          name: "inbox_consume",
          arguments: { filename: "README.md" },
        });
        assert(
          reservedInboxFile.isError === true,
          `inbox_consume should reject reserved inbox files.\n${JSON.stringify(reservedInboxFile, null, 2)}`,
        );

        const addFeature = await client.callTool({
          name: "harness_add",
          arguments: {
            name: "hidden-beta",
            description: "hidden feature",
          },
        });
        assert(
          addFeature.structuredContent?.added?.id === 2,
          `harness_add failed on the hidden workflow layout.\n${JSON.stringify(addFeature, null, 2)}`,
        );

        const setNextStep = await client.callTool({
          name: "progress_next_step",
          arguments: { content: "Review hidden workflow." },
        });
        assert(
          setNextStep.isError !== true,
          `progress_next_step failed on hidden layout.\n${JSON.stringify(setNextStep, null, 2)}`,
        );

        const markSpecReady = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "spec_ready" },
        });
        assert(
          markSpecReady.structuredContent?.updated?.status === "spec_ready",
          `harness_update failed on hidden layout.\n${JSON.stringify(markSpecReady, null, 2)}`,
        );

        const finalStatus = await client.callTool({
          name: "harness_status",
          arguments: {},
        });
        assert(
          finalStatus.structuredContent?.next_step ===
            "Review hidden workflow.",
          `harness_status did not report the hidden-layout next step.\n${JSON.stringify(finalStatus, null, 2)}`,
        );
        assert(
          finalStatus.structuredContent?.spec_ready_features?.length === 1,
          `harness_status did not report hidden spec_ready features.\n${JSON.stringify(finalStatus, null, 2)}`,
        );

        const featureListRaw = await readFile(
          path.join(repoPath, ".harness", "feature_list.json"),
          "utf8",
        );
        const featureList = JSON.parse(featureListRaw);
        assert(
          !Array.isArray(featureList) && Array.isArray(featureList.features),
          "Hidden workflow repo did not preserve the object feature_list shape.",
        );
        assert(
          featureList.features.length === 2 &&
            featureList.features[0].status === "spec_ready",
          `Hidden feature_list.json was not updated as expected.\n${featureListRaw}`,
        );
      },
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeLegacyRootCompatibility() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-workflow-legacy-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await seedLegacyRootRepo(repoPath);

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath],
        name: "harness-smoke-workflow-legacy",
      },
      async ({ client }) => {
        const initialStatus = await client.callTool({
          name: "harness_status",
          arguments: { mode: "brief_only" },
        });
        assert(
          initialStatus.structuredContent?.pending_count === 1,
          `harness_status did not parse legacy root feature_list.json.\n${JSON.stringify(initialStatus, null, 2)}`,
        );
        assert(
          initialStatus.structuredContent?.next_step === "(sin plan activo)",
          `harness_status did not ignore the legacy placeholder.\n${JSON.stringify(initialStatus, null, 2)}`,
        );

        const addFeature = await client.callTool({
          name: "harness_add",
          arguments: {
            name: "legacy-beta",
            description: "legacy feature",
          },
        });
        assert(
          addFeature.structuredContent?.added?.id === 2,
          `harness_add failed on legacy root layout.\n${JSON.stringify(addFeature, null, 2)}`,
        );

        const markInProgress = await client.callTool({
          name: "harness_update",
          arguments: { id: 1, status: "in_progress" },
        });
        assert(
          markInProgress.structuredContent?.updated?.status === "in_progress",
          `harness_update failed on legacy root layout.\n${JSON.stringify(markInProgress, null, 2)}`,
        );
      },
    );

    const doctorBefore = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorBefore.status === 0,
      `doctor should accept compatible legacy repos.\nstdout:\n${doctorBefore.stdout}\nstderr:\n${doctorBefore.stderr}`,
    );
    assert(
      doctorBefore.stdout.includes("compatible pero desactualizado"),
      `doctor did not warn about legacy layout.\n${doctorBefore.stdout}`,
    );

    const update = spawnSync(
      process.execPath,
      [distPath, "init", "--repo-path", repoPath, "--update"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      update.status === 0,
      `init --update failed on legacy repo.\nstdout:\n${update.stdout}\nstderr:\n${update.stderr}`,
    );

    const migratedFeatureListRaw = await readFile(
      path.join(repoPath, ".harness", "feature_list.json"),
      "utf8",
    );
    const migratedFeatureList = JSON.parse(migratedFeatureListRaw);
    assert(
      !Array.isArray(migratedFeatureList) &&
        Array.isArray(migratedFeatureList.features) &&
        migratedFeatureList.features.length === 2,
      `legacy migration did not normalize feature_list.json.\n${migratedFeatureListRaw}`,
    );

    const doctorAfter = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorAfter.status === 0,
      `doctor failed after migrating legacy repo.\nstdout:\n${doctorAfter.stdout}\nstderr:\n${doctorAfter.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeInitScaffold() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-init-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await mkdir(repoPath, { recursive: true });
    const repoRealPath = await realpath(repoPath);

    const init = spawnSync(
      process.execPath,
      [distPath, "init", "--repo-path", repoPath, "--layout", "full"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      init.status === 0,
      `init command failed.\nstdout:\n${init.stdout}\nstderr:\n${init.stderr}`,
    );

    const shimStatus = spawnSync(
      smokeManagedShimPath,
      ["status", "--repo-path", repoPath, "--brief-minimal", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          XDG_CONFIG_HOME: smokeXdgHome,
        },
      },
    );
    assert(
      shimStatus.status === 0,
      `Managed global shim did not boot outside the repo.\nstdout:\n${shimStatus.stdout}\nstderr:\n${shimStatus.stderr}`,
    );
    const shimSnapshot = JSON.parse(shimStatus.stdout);
    assert(
      (shimSnapshot.repo_path === repoPath ||
        shimSnapshot.repo_path === repoRealPath) &&
        shimSnapshot.runtime_status?.state === "ok" &&
        shimSnapshot.runtime_status?.runtime_artifact?.kind === "global_bundle",
      `Managed global shim returned an unexpected status payload.\n${shimStatus.stdout}`,
    );

    const launcherStatus = spawnSync(
      process.execPath,
      [
        path.join(repoPath, ".harness", "runtime", "launch-global-runtime.mjs"),
        "status",
        "--repo-path",
        ".",
        "--brief-minimal",
        "--json",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          XDG_CONFIG_HOME: smokeXdgHome,
        },
      },
    );
    assert(
      launcherStatus.status === 0,
      `Repo-scoped launcher did not boot against the managed runtime.\nstdout:\n${launcherStatus.stdout}\nstderr:\n${launcherStatus.stderr}`,
    );
    const launcherSnapshot = JSON.parse(launcherStatus.stdout);
    assert(
      (launcherSnapshot.repo_path === repoPath ||
        launcherSnapshot.repo_path === repoRealPath) &&
        launcherSnapshot.runtime_status?.state === "ok" &&
        launcherSnapshot.runtime_status?.runtime_artifact?.kind === "global_bundle",
      `Repo-scoped launcher returned an unexpected status payload.\n${launcherStatus.stdout}`,
    );

    const requiredFiles = [
      ".harness/feature_list.json",
      ".harness/feature_history.json",
      ".harness/progress/README.md",
      ".harness/progress/current.md",
      ".harness/progress/history.md",
      ".harness/inbox/README.md",
      ".harness-docs/architecture.md",
      ".harness-docs/conventions.md",
      ".harness-docs/specs.md",
      ".harness-docs/specs_policy.md",
      ".harness-docs/verification.md",
      ".harness-docs/model_interface.md",
      ".harness-docs/context_manager.md",
      ".harness-docs/execution_engine.md",
      ".harness-docs/memory_system.md",
      ".harness-docs/orchestration.md",
      ".harness-docs/tool_catalog.md",
      ".harness-docs/observation_policy.md",
      ".harness-docs/loop_contract.md",
      ".harness-docs/planning_model.md",
      ".harness-docs/budgets.md",
      ".harness-docs/contract_versions.md",
      ".harness-docs/frontend_adapters.md",
      "CHECKPOINTS.md",
      "init.sh",
      "AGENTS.md",
      "CLAUDE.md",
      "CODEX.md",
      ".mcp.json",
      ".codex/config.toml",
      ".claude/commands/harness.md",
      ".claude/agents/leader.md",
      ".opencode/opencode.json",
      ".opencode/commands/harness.md",
      ".github/copilot-instructions.md",
      ".github/prompts/leader.prompt.md",
      ".vscode/mcp.json",
    ];

    for (const relativePath of requiredFiles) {
      const absolutePath = path.join(repoPath, relativePath);
      const content = await readFile(absolutePath, "utf8");
      assert(
        content.length > 0,
        `Scaffolded file is empty: ${relativePath}`,
      );
    }

    const repoInitScript = await readFile(path.join(repoPath, "init.sh"), "utf8");
    assert(
      repoInitScript.includes("ARUFHEIM_HARNESS_ENTRY") &&
        repoInitScript.includes("arufheim-harness doctor --repo-path .") &&
        repoInitScript.includes("no intenta descargar el harness vía npx") &&
        !repoInitScript.includes("npx --yes arufheim-harness doctor --repo-path ."),
      `Scaffolded init.sh still depends on implicit npx fallback.\n${repoInitScript}`,
    );

    const featureListRaw = await readFile(
      path.join(repoPath, ".harness", "feature_list.json"),
      "utf8",
    );
    const featureList = JSON.parse(featureListRaw);
    assert(
      !Array.isArray(featureList) && Array.isArray(featureList.features),
      `init did not scaffold object-shaped .harness/feature_list.json.\n${featureListRaw}`,
    );

    const featureHistoryRaw = await readFile(
      path.join(repoPath, ".harness", "feature_history.json"),
      "utf8",
    );
    const featureHistory = JSON.parse(featureHistoryRaw);
    assert(
      Array.isArray(featureHistory.archived_features),
      `init did not scaffold feature_history.json correctly.\n${featureHistoryRaw}`,
    );

    const agentsText = await readFile(path.join(repoPath, "AGENTS.md"), "utf8");
    assert(
      agentsText.includes(".harness/progress/current.md") &&
        agentsText.includes(".harness/feature_list.json") &&
        agentsText.includes("<!-- harness-agents-managed:start -->") &&
        agentsText.includes("<!-- harness-agents-managed:end -->"),
      `AGENTS.md did not point to the canonical hidden workflow paths.\n${agentsText}`,
    );

    const leaderPrompt = await readFile(
      path.join(repoPath, ".github", "prompts", "leader.prompt.md"),
      "utf8",
    );
    assert(
      leaderPrompt.includes("mcp_arufheim-harness_harness_status") &&
        leaderPrompt.includes("mcp_arufheim-harness_harness_loop_status") &&
        leaderPrompt.includes("mcp_arufheim-harness_harness_loop_event") &&
        leaderPrompt.includes('mode: "brief_minimal"') &&
        leaderPrompt.includes("startup_brief") &&
        leaderPrompt.includes(".harness/feature_list.json"),
      `Leader prompt does not use the canonical hidden workflow layout.\n${leaderPrompt}`,
    );

    const opencodeConfig = await readFile(
      path.join(repoPath, ".opencode", "opencode.json"),
      "utf8",
    );
    assert(
      opencodeConfig.includes('"$schema": "https://opencode.ai/config.json"') &&
        opencodeConfig.includes('"arufheim-harness"') &&
        opencodeConfig.includes('"permission"') &&
        opencodeConfig.includes('"--repo-path"') &&
        opencodeConfig.includes('"--client"') &&
        opencodeConfig.includes('"opencode"'),
      `OpenCode scaffold is missing schema, MCP or permission policy.\n${opencodeConfig}`,
    );

    const opencodeCommand = await readFile(
      path.join(repoPath, ".opencode", "commands", "harness.md"),
      "utf8",
    );
    assert(
      opencodeCommand.includes("harness_status") &&
        opencodeCommand.includes("harness_loop_status") &&
        opencodeCommand.includes("startup_brief") &&
        opencodeCommand.includes(".harness/progress/current.md"),
      `OpenCode command does not use the compact startup contract.\n${opencodeCommand}`,
    );

    const claudeInstructions = await readFile(
      path.join(repoPath, "CLAUDE.md"),
      "utf8",
    );
    assert(
      claudeInstructions.includes("harness_status") &&
        claudeInstructions.includes("harness_loop_status") &&
        claudeInstructions.includes('mode: "brief_minimal"') &&
        claudeInstructions.includes("startup_brief"),
      `CLAUDE.md does not point to the compact startup flow.\n${claudeInstructions}`,
    );

    const claudeProjectMcp = JSON.parse(
      await readFile(path.join(repoPath, ".mcp.json"), "utf8"),
    );
    assert(
      Array.isArray(claudeProjectMcp.mcpServers?.["arufheim-harness"]?.args) &&
        claudeProjectMcp.mcpServers["arufheim-harness"].args.includes(
          "--repo-path",
        ) &&
        claudeProjectMcp.mcpServers["arufheim-harness"].args.includes(
          "--client",
        ) &&
        claudeProjectMcp.mcpServers["arufheim-harness"].args.includes(
          "claude-code",
        ),
      `.mcp.json does not bind arufheim-harness explicitly to the repo.\n${JSON.stringify(claudeProjectMcp, null, 2)}`,
    );

    const codexInstructions = await readFile(
      path.join(repoPath, "CODEX.md"),
      "utf8",
    );
    assert(
      codexInstructions.includes("harness_status") &&
        codexInstructions.includes("harness_loop_status") &&
        codexInstructions.includes('mode: "brief_minimal"') &&
      codexInstructions.includes("startup_brief") &&
        codexInstructions.includes("repo_path") &&
        codexInstructions.includes("config_scope") &&
        codexInstructions.includes("./init.sh") &&
        codexInstructions.includes("AGENTS.md") &&
        !codexInstructions.includes(".claude/agents/leader.md") &&
        codexInstructions.includes("## Cierre"),
      `CODEX.md does not point to the compact startup and close flow.\n${codexInstructions}`,
    );

    const codexConfig = await readFile(
      path.join(repoPath, ".codex", "config.toml"),
      "utf8",
    );
    assert(
      codexConfig.includes("[mcp_servers.arufheim-harness]") &&
        codexConfig.includes("--repo-path") &&
        codexConfig.includes("--client") &&
        codexConfig.includes("codex"),
      `.codex/config.toml does not bind arufheim-harness explicitly to the repo.\n${codexConfig}`,
    );

    const specsDoc = await readFile(
      path.join(repoPath, ".harness-docs", "specs.md"),
      "utf8",
    );
    assert(
      specsDoc.includes("spec_summary.md"),
      `.harness-docs/specs.md does not mention spec_summary.md.\n${specsDoc}`,
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctor.status === 0,
      `doctor failed on freshly initialized repo.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeCodexOnlySetupContract() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-codex-only-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });
    const vscodeGlobalPath = globalClientConfigPath(homePath, "vscode");
    const claudeDesktopGlobalPath = globalClientConfigPath(
      homePath,
      "claude-desktop",
    );
    const claudeCodeGlobalPath = globalClientConfigPath(homePath, "claude-code");
    await mkdir(path.dirname(vscodeGlobalPath), { recursive: true });
    await mkdir(path.dirname(claudeDesktopGlobalPath), { recursive: true });
    await mkdir(path.dirname(claudeCodeGlobalPath), { recursive: true });
    await writeFile(
      vscodeGlobalPath,
      JSON.stringify(
        {
          servers: {
            "arufheim-harness": {
              command: "npx",
              args: [
                "arufheim-harness",
                "--repo-path",
                "${workspaceFolder}",
                "--client",
                "vscode",
              ],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      claudeDesktopGlobalPath,
      JSON.stringify(
        {
          mcpServers: {
            "arufheim-harness": {
              command: "npx",
              args: [
                "arufheim-harness",
                "--repo-path",
                ".",
                "--client",
                "claude-desktop",
              ],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      claudeCodeGlobalPath,
      JSON.stringify(
        {
          mcpServers: {
            "arufheim-harness": {
              command: "npx",
              args: [
                "arufheim-harness",
                "--repo-path",
                ".",
                "--client",
                "claude-code",
              ],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    const env = {
      ...process.env,
      HOME: homePath,
    };

    const setup = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath, "--clients", "codex"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      setup.status === 0,
      `codex-only setup failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );
    assert(
      setup.stdout.includes("setup summary") &&
        setup.stdout.includes("health: degraded") &&
        setup.stdout.includes("Codex"),
      `codex-only setup did not emit expected summary.\n${setup.stdout}`,
    );

    for (const relativePath of [
      "AGENTS.md",
      "CODEX.md",
      "harness.config.json",
      ".codex/config.toml",
      ".harness/feature_list.json",
    ]) {
      const content = await readFile(path.join(repoPath, relativePath), "utf8");
      assert(
        content.length > 0,
        `codex-only setup produced empty file: ${relativePath}`,
      );
    }

    assert(
      !(await fileExists(path.join(repoPath, "CHECKPOINTS.md"))),
      "codex-only setup should stay thin by default and omit CHECKPOINTS.md.",
    );
    assert(
      !(await fileExists(path.join(repoPath, "init.sh"))),
      "codex-only setup should stay thin by default and omit repo-local init.sh.",
    );

    assert(
      !(await fileExists(path.join(repoPath, ".claude", "agents", "leader.md"))),
      "codex-only setup should not scaffold Claude agent files.",
    );

    const codexInstructions = await readFile(
      path.join(repoPath, "CODEX.md"),
      "utf8",
    );
    assert(
      codexInstructions.includes("harness_status") &&
        codexInstructions.includes("arufheim-harness verify --repo-path .") &&
        codexInstructions.includes("AGENTS.md") &&
        !codexInstructions.includes(".claude/agents/leader.md"),
      `codex-only CODEX.md still points to Claude-only flow.\n${codexInstructions}`,
    );

    const configDoc = JSON.parse(
      await readFile(path.join(repoPath, "harness.config.json"), "utf8"),
    );
    assert(
      configDoc.scaffold?.layout === "thin" &&
      JSON.stringify(configDoc.scaffold?.localClients) ===
        JSON.stringify(["codex"]),
      `codex-only setup did not persist scaffold.localClients.\n${JSON.stringify(configDoc, null, 2)}`,
    );

    const repoVerify = spawnSync(process.execPath, [distPath, "verify", "--repo-path", repoPath], {
      cwd: repoPath,
      encoding: "utf8",
      env,
    });
    assert(
      repoVerify.status === 0,
      `verify failed in codex-only repo.\nstdout:\n${repoVerify.stdout}\nstderr:\n${repoVerify.stderr}`,
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      doctor.status === 0,
      `doctor failed on codex-only repo.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
    const snapshot = JSON.parse(doctor.stdout);
    assert(
      ["ok", "degraded"].includes(snapshot.doctor_summary?.status) &&
        snapshot.runtime_status?.runtime_source?.kind === "workspace_dev" &&
        snapshot.client_verification?.codex?.state === "verified",
      `doctor did not leave codex-only repo healthy.\n${doctor.stdout}`,
    );
    assert(
      snapshot.alerts.every(
        (alert) =>
          !String(alert.code).startsWith("client.claude.") &&
          !String(alert.code).startsWith("bindings.global.claude_desktop") &&
          !String(alert.code).startsWith("client.copilot.") &&
          !String(alert.code).startsWith("client.opencode."),
      ),
      `doctor still warns about omitted clients in codex-only repo.\n${doctor.stdout}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeThinMigrationExecution() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-thin-migrate-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });
    const env = {
      ...process.env,
      HOME: homePath,
    };

    const setup = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath, "--layout", "full"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      setup.status === 0,
      `full setup before migration failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );

    const migrate = spawnSync(
      process.execPath,
      [distPath, "migrate", "--to", "thin", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      migrate.status === 0,
      `real thin migration failed.\nstdout:\n${migrate.stdout}\nstderr:\n${migrate.stderr}`,
    );
    assert(
      migrate.stdout.includes("to: thin") &&
        migrate.stdout.includes("prune:"),
      `thin migration summary did not look correct.\n${migrate.stdout}`,
    );

    assert(
      !(await fileExists(path.join(repoPath, ".harness-docs", "verification.md"))),
      "thin migration should prune managed .harness-docs assets.",
    );
    assert(
      !(await fileExists(path.join(repoPath, "CHECKPOINTS.md"))),
      "thin migration should prune managed CHECKPOINTS.md.",
    );
    assert(
      !(await fileExists(path.join(repoPath, "init.sh"))),
      "thin migration should prune managed repo-local init.sh.",
    );
    assert(
      await fileExists(path.join(repoPath, "AGENTS.md")) &&
        await fileExists(path.join(repoPath, "CODEX.md")),
      "thin migration should preserve thin wrappers.",
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      doctor.status === 0,
      `doctor failed after thin migration.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
    const snapshot = JSON.parse(doctor.stdout);
    assert(
      snapshot.scaffold_layout === "thin" &&
        ["ok", "degraded"].includes(snapshot.doctor_summary?.status) &&
        snapshot.runtime_status?.runtime_source?.kind === "workspace_dev",
      `doctor did not report a healthy thin repo after migration.\n${doctor.stdout}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeRepoScopedManagedUpdate() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-managed-update-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await mkdir(repoPath, { recursive: true });

    const setup = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoPath,
        "--clients",
        "claude,codex,copilot,opencode",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setup.status === 0,
      `managed-update setup failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );

    await writeFile(
      path.join(repoPath, "CODEX.md"),
      `# Instrucciones para Codex

## Protocolo de arranque

1. Llama \`harness_status\`
2. Ejecuta \`./init.sh\`
3. Aplica el flujo definido en \`.claude/agents/leader.md\`
`,
      "utf8",
    );
    await writeFile(
      path.join(repoPath, ".codex", "config.toml"),
      `[mcp_servers.arufheim-harness]
command = "npx"
args = ["--yes", "arufheim-harness", "--repo-path", "."]
cwd = "."
`,
      "utf8",
    );
    await writeFile(
      path.join(repoPath, ".vscode", "mcp.json"),
      JSON.stringify(
        {
          servers: {
            "arufheim-harness": {
              type: "stdio",
              command: "npx",
              args: ["arufheim-harness", "--repo-path", "${workspaceFolder}"],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      path.join(repoPath, ".mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            "arufheim-harness": {
              command: "npx",
              args: ["--yes", "arufheim-harness", "--repo-path", "."],
              cwd: ".",
              env: {},
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      path.join(repoPath, ".opencode", "opencode.json"),
      JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          mcp: {
            "arufheim-harness": {
              type: "local",
              command: ["npx", "arufheim-harness", "--repo-path", "."],
              enabled: true,
            },
          },
          permission: {
            "*": "ask",
            read: "allow",
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const update = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoPath,
        "--update",
        "--clients",
        "claude,codex,copilot,opencode",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      update.status === 0,
      `managed-update setup --update failed.\nstdout:\n${update.stdout}\nstderr:\n${update.stderr}`,
    );

    const codexInstructions = await readFile(
      path.join(repoPath, "CODEX.md"),
      "utf8",
    );
    assert(
      codexInstructions.includes("AGENTS.md") &&
        !codexInstructions.includes(".claude/agents/leader.md"),
      `setup --update did not reconcile CODEX.md.\n${codexInstructions}`,
    );

    const codexConfig = await readFile(
      path.join(repoPath, ".codex", "config.toml"),
      "utf8",
    );
    assert(
      codexConfig.includes('"--client", "codex"'),
      `setup --update did not reconcile .codex/config.toml.\n${codexConfig}`,
    );

    const claudeProjectConfig = await readFile(
      path.join(repoPath, ".mcp.json"),
      "utf8",
    );
    assert(
      claudeProjectConfig.includes('"--client"') &&
        claudeProjectConfig.includes('"claude-code"'),
      `setup --update did not reconcile .mcp.json.\n${claudeProjectConfig}`,
    );

    const vscodeConfig = await readFile(
      path.join(repoPath, ".vscode", "mcp.json"),
      "utf8",
    );
    assert(
      vscodeConfig.includes('"--client"') &&
        vscodeConfig.includes('"vscode"'),
      `setup --update did not reconcile .vscode/mcp.json.\n${vscodeConfig}`,
    );

    const opencodeConfig = await readFile(
      path.join(repoPath, ".opencode", "opencode.json"),
      "utf8",
    );
    assert(
      opencodeConfig.includes('"--client"') &&
        opencodeConfig.includes('"opencode"'),
      `setup --update did not reconcile .opencode/opencode.json.\n${opencodeConfig}`,
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctor.status === 0,
      `doctor should be healthy after managed update reconcile.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
    const snapshot = JSON.parse(doctor.stdout);
    assert(
      ["ok", "degraded"].includes(snapshot.doctor_summary?.status) &&
        snapshot.runtime_status?.runtime_source?.kind === "workspace_dev",
      `doctor still reported managed binding drift after setup --update.\n${doctor.stdout}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeExistingAgentsUpgrade() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-agents-upgrade-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await mkdir(repoPath, { recursive: true });
    await writeFile(
      path.join(repoPath, "AGENTS.md"),
      "# AGENTS.md\n\nContexto custom del repo.\n",
      "utf8",
    );

    const init = spawnSync(
      process.execPath,
      [distPath, "init", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      init.status === 0,
      `init failed on repo with existing AGENTS.md.\nstdout:\n${init.stdout}\nstderr:\n${init.stderr}`,
    );

    const preservedAgents = await readFile(path.join(repoPath, "AGENTS.md"), "utf8");
    assert(
      preservedAgents.includes("Contexto custom del repo.") &&
        !preservedAgents.includes("<!-- harness-agents-managed:start -->"),
      `init should preserve an existing AGENTS.md without injecting managed content.\n${preservedAgents}`,
    );

    const doctorBefore = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorBefore.status === 0,
      `doctor should degrade, not fail, when AGENTS.md lacks the managed block.\nstdout:\n${doctorBefore.stdout}\nstderr:\n${doctorBefore.stderr}`,
    );
    const before = JSON.parse(doctorBefore.stdout);
    assert(
      before.doctor_summary?.status === "degraded" &&
        before.alerts.some((alert) => alert.code === "scaffold.agents.managed"),
      `doctor did not warn about the unmanaged AGENTS.md.\n${doctorBefore.stdout}`,
    );

    const setup = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setup.status === 0,
      `setup failed to reconcile an existing AGENTS.md.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );

    const upgradedAgents = await readFile(path.join(repoPath, "AGENTS.md"), "utf8");
    assert(
      upgradedAgents.includes("Contexto custom del repo.") &&
        upgradedAgents.includes("<!-- harness-agents-managed:start -->") &&
        upgradedAgents.includes("<!-- harness-agents-managed:end -->") &&
        upgradedAgents.includes(".harness/progress/current.md") &&
        upgradedAgents.includes(".harness/feature_list.json"),
      `setup did not append the managed AGENTS.md block safely.\n${upgradedAgents}`,
    );

    const doctorAfter = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorAfter.status === 0,
      `doctor failed after reconciling AGENTS.md.\nstdout:\n${doctorAfter.stdout}\nstderr:\n${doctorAfter.stderr}`,
    );
    const after = JSON.parse(doctorAfter.stdout);
    assert(
      !after.alerts.some((alert) => alert.code === "scaffold.agents.managed"),
      `doctor still reports AGENTS.md unmanaged after setup reconciliation.\n${doctorAfter.stdout}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeSetupAndRepair() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-setup-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });

    const setup = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoPath,
        "--clients",
        "claude,codex,copilot,opencode",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setup.status === 0,
      `setup command failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );
    assert(
      setup.stdout.includes("setup summary") &&
        setup.stdout.includes("health: degraded"),
      `setup did not emit the expected summary.\n${setup.stdout}`,
    );

    const doctorAfterSetup = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorAfterSetup.status === 0,
      `doctor should be green after setup.\nstdout:\n${doctorAfterSetup.stdout}\nstderr:\n${doctorAfterSetup.stderr}`,
    );
    const setupSnapshot = JSON.parse(doctorAfterSetup.stdout);
    assert(
      setupSnapshot.client_verification?.vscode?.state === "verified" &&
        setupSnapshot.client_verification?.claude_code?.state === "verified" &&
        setupSnapshot.client_verification?.codex?.state === "verified" &&
        setupSnapshot.client_verification?.opencode?.state === "verified" &&
        setupSnapshot.client_readiness?.vscode?.state === "verified" &&
        setupSnapshot.client_readiness?.claude_code?.state === "verified" &&
        setupSnapshot.client_readiness?.codex?.state === "verified" &&
        setupSnapshot.client_readiness?.opencode?.state === "verified",
      `setup did not pre-verify deterministic repo-scoped bindings.\n${doctorAfterSetup.stdout}`,
    );

    const setupAgain = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setupAgain.status === 0,
      `setup should be idempotent.\nstdout:\n${setupAgain.stdout}\nstderr:\n${setupAgain.stderr}`,
    );

    await rm(path.join(repoPath, ".harness", "progress", "current.md"), {
      force: true,
    });

    const doctorBeforeRepair = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorBeforeRepair.status !== 0,
      `doctor --json should fail on missing managed scaffold.\nstdout:\n${doctorBeforeRepair.stdout}\nstderr:\n${doctorBeforeRepair.stderr}`,
    );
    const before = JSON.parse(doctorBeforeRepair.stdout);
    assert(
      before.alerts.some((alert) => alert.code === "workflow.current"),
      `doctor --json did not report the missing managed scaffold.\n${doctorBeforeRepair.stdout}`,
    );
    assert(
      before.diagnostics.every((diagnostic) =>
        [
          "code",
          "severity",
          "blocking",
          "message",
          "detected_at",
          "fix_available",
        ].every((key) => key in diagnostic),
      ),
      `doctor --json did not expose the structured diagnostic contract.\n${doctorBeforeRepair.stdout}`,
    );

    const setupUpdate = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath, "--update"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setupUpdate.status === 0,
      `setup --update command failed.\nstdout:\n${setupUpdate.stdout}\nstderr:\n${setupUpdate.stderr}`,
    );
    assert(
      setupUpdate.stdout.includes("update: forced"),
      `setup --update did not expose forced reconcile mode.\n${setupUpdate.stdout}`,
    );

    await rm(path.join(repoPath, ".harness", "progress", "current.md"), {
      force: true,
    });

    const repair = spawnSync(
      process.execPath,
      [distPath, "repair", "--repo-path", repoPath],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      repair.status === 0,
      `repair command failed.\nstdout:\n${repair.stdout}\nstderr:\n${repair.stderr}`,
    );
    assert(
      repair.stdout.includes("repair summary"),
      `repair did not emit the expected summary.\n${repair.stdout}`,
    );

    const doctorAfterRepair = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctorAfterRepair.status === 0,
      `doctor --json failed after repair.\nstdout:\n${doctorAfterRepair.stdout}\nstderr:\n${doctorAfterRepair.stderr}`,
    );
    const after = JSON.parse(doctorAfterRepair.stdout);
    assert(
      !after.alerts.some((alert) => alert.code === "workflow.current"),
      `repair did not restore the missing managed scaffold.\n${doctorAfterRepair.stdout}`,
    );
    assert(
      typeof after.last_verified_at === "string" &&
        after.last_verified_at.length > 0,
      `doctor did not persist last_verified_at after repair.\n${doctorAfterRepair.stdout}`,
    );

    const globalSetup = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--global",
        "--clients",
        "claude,codex,copilot",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      globalSetup.status === 0,
      `setup --global command failed.\nstdout:\n${globalSetup.stdout}\nstderr:\n${globalSetup.stderr}`,
    );
    assert(
      globalSetup.stdout.includes("activation") &&
        globalSetup.stdout.includes("Manual check") &&
        globalSetup.stdout.includes("configured_needs_activation"),
      `setup --global did not emit activation guidance.\n${globalSetup.stdout}`,
    );

    const vscodeGlobalPath = globalClientConfigPath(homePath, "vscode");
    const claudeDesktopGlobalPath = globalClientConfigPath(
      homePath,
      "claude-desktop",
    );
    const claudeCodeGlobalPath = globalClientConfigPath(homePath, "claude-code");
    const codexGlobalPath = globalClientConfigPath(homePath, "codex");

    await mkdir(path.dirname(vscodeGlobalPath), { recursive: true });
    await mkdir(path.dirname(claudeDesktopGlobalPath), { recursive: true });
    await mkdir(path.dirname(claudeCodeGlobalPath), { recursive: true });
    await mkdir(path.dirname(codexGlobalPath), { recursive: true });

    await writeFile(
      vscodeGlobalPath,
      JSON.stringify(
        {
          servers: {
            "arufheim-harness": {
              type: "stdio",
              command: "npx",
              args: ["arufheim-harness", "--repo-path", "/tmp/otro-repo"],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      claudeDesktopGlobalPath,
      JSON.stringify(
        {
          mcpServers: {
            "arufheim-harness": {
              command: "npx",
              args: ["arufheim-harness", "--repo-path", "/tmp/otro-repo"],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      claudeCodeGlobalPath,
      JSON.stringify(
        {
          mcpServers: {
            "arufheim-harness": {
              command: "npx",
              args: ["arufheim-harness", "--repo-path", "/tmp/otro-repo"],
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await writeFile(
      codexGlobalPath,
      [
        "[mcp_servers.arufheim-harness]",
        'command = "npx"',
        'args = ["--yes", "arufheim-harness", "--repo-path", "/tmp/otro-repo"]',
        'cwd = "/tmp/otro-repo"',
        "",
      ].join("\n"),
      "utf8",
    );

    const globalRepair = spawnSync(
      process.execPath,
      [
        distPath,
        "repair",
        "--global",
        "--clients",
        "claude,codex,copilot",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      globalRepair.status === 0,
      `repair --global failed.\nstdout:\n${globalRepair.stdout}\nstderr:\n${globalRepair.stderr}`,
    );
    assert(
      globalRepair.stdout.includes("activation") &&
        globalRepair.stdout.includes("Manual check") &&
        globalRepair.stdout.includes("configured_needs_activation"),
      `repair --global did not emit activation guidance.\n${globalRepair.stdout}`,
    );

    const vscodeGlobalRaw = await readFile(vscodeGlobalPath, "utf8");
    const vscodeGlobal = JSON.parse(vscodeGlobalRaw);
    assert(
      vscodeGlobal.servers?.["arufheim-harness"]?.args?.includes(
        "${workspaceFolder}",
      ) &&
        vscodeGlobal.servers?.["arufheim-harness"]?.args?.includes(
          "--client",
        ) &&
        vscodeGlobal.servers?.["arufheim-harness"]?.args?.includes("vscode"),
      `repair --global did not normalize VS Code binding.\n${vscodeGlobalRaw}`,
    );

    const claudeDesktopRaw = await readFile(claudeDesktopGlobalPath, "utf8");
    const claudeDesktop = JSON.parse(claudeDesktopRaw);
    assert(
      claudeDesktop.mcpServers?.["arufheim-harness"]?.args?.includes(".") &&
        claudeDesktop.mcpServers?.["arufheim-harness"]?.args?.includes(
          "--client",
        ) &&
        claudeDesktop.mcpServers?.["arufheim-harness"]?.args?.includes(
          "claude-desktop",
        ),
      `repair --global did not normalize Claude Desktop binding.\n${claudeDesktopRaw}`,
    );

    const claudeCodeRaw = await readFile(claudeCodeGlobalPath, "utf8");
    const claudeCode = JSON.parse(claudeCodeRaw);
    assert(
      claudeCode.mcpServers?.["arufheim-harness"]?.args?.includes(".") &&
        claudeCode.mcpServers?.["arufheim-harness"]?.args?.includes(
          "--client",
        ) &&
        claudeCode.mcpServers?.["arufheim-harness"]?.args?.includes(
          "claude-code",
        ),
      `repair --global did not normalize Claude Code binding.\n${claudeCodeRaw}`,
    );

    const codexGlobalRaw = await readFile(codexGlobalPath, "utf8");
    assert(
      codexGlobalRaw.includes('"--repo-path", "."') &&
        codexGlobalRaw.includes('"--client", "codex"') &&
        codexGlobalRaw.includes('cwd = "."'),
      `repair --global did not normalize Codex binding.\n${codexGlobalRaw}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeTestingPolicyAndHeadroom() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-testing-head-"),
  );
  const repoDetected = path.join(tempRoot, "repo-detected");
  const repoJsFallback = path.join(tempRoot, "repo-js-fallback");
  const repoNonJs = path.join(tempRoot, "repo-non-js");

  try {
    await mkdir(repoDetected, { recursive: true });
    await writeJson(
      path.join(repoDetected, "package.json"),
      {
        name: "repo-detected",
        packageManager: "pnpm@10.33.4",
        scripts: {
          "test:unit": "vitest run",
          smoke: "node smoke.mjs",
        },
      },
      true,
    );

    const setupDetected = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoDetected,
        "--layout",
        "full",
        "--clients",
        "claude,codex,copilot,opencode",
      ],
      {
        cwd: repoDetected,
        encoding: "utf8",
      },
    );
    assert(
      setupDetected.status === 0,
      `setup failed on repo with detectable testing guidance.\nstdout:\n${setupDetected.stdout}\nstderr:\n${setupDetected.stderr}`,
    );

    const detectedConfigRaw = await readFile(
      path.join(repoDetected, "harness.config.json"),
      "utf8",
    );
    const detectedConfig = JSON.parse(detectedConfigRaw);
    assert(
      detectedConfig.testing?.fastCommand === "pnpm test:unit" &&
        detectedConfig.testing?.integrationCommand === "pnpm smoke",
      `setup did not persist detected testing guidance.\n${detectedConfigRaw}`,
    );
    assert(
      Array.isArray(detectedConfig.allowedCommands) &&
        detectedConfig.allowedCommands.includes("pnpm test:unit"),
      `setup did not merge fastCommand into allowedCommands.\n${detectedConfigRaw}`,
    );

    const detectedVerification = await readFile(
      path.join(repoDetected, ".harness-docs", "verification.md"),
      "utf8",
    );
    assert(
      detectedVerification.includes("Policy TDD parcial") &&
        detectedVerification.includes("pnpm test:unit") &&
        detectedVerification.includes("No conviertas el tooling en un preflight universal"),
      `setup did not propagate TDD/testing guidance to verification.md.\n${detectedVerification}`,
    );

    const detectedImplementerPrompt = await readFile(
      path.join(repoDetected, ".github", "prompts", "implementer.prompt.md"),
      "utf8",
    );
    assert(
      detectedImplementerPrompt.includes("## Red -> Green Evidence") &&
        detectedImplementerPrompt.includes("head_<name>.md") &&
        detectedImplementerPrompt.includes("No hagas preflight de versiones o binarios"),
      `setup did not propagate TDD/headroom guidance to implementer prompt.\n${detectedImplementerPrompt}`,
    );

    const detectedCodex = await readFile(
      path.join(repoDetected, "CODEX.md"),
      "utf8",
    );
    assert(
      detectedCodex.includes("head_<feature>.md") &&
        detectedCodex.includes("unit`, `contract` o `smoke`"),
      `setup did not propagate headroom/testing guidance to CODEX.md.\n${detectedCodex}`,
    );

    await writeJson(
      path.join(repoDetected, ".harness", "feature_list.json"),
      {
        project: "testing-headroom",
        description: "testing guidance smoke",
        rules: {
          one_feature_at_a_time: true,
          require_green_init_to_close: true,
          require_approved_spec_to_implement: true,
          valid_status: [
            "pending",
            "spec_ready",
            "in_progress",
            "done",
            "blocked",
          ],
          sdd_required_when: 'feature has "sdd": true',
          scope_field: "optional",
        },
        features: [
          {
            id: 1,
            name: "contract_snapshot_policy",
            description: "Ajusta doctor status json contract",
            status: "in_progress",
            sdd: true,
          },
        ],
      },
      true,
    );
    await mkdir(path.join(repoDetected, "specs", "contract_snapshot_policy"), {
      recursive: true,
    });
    await writeFile(
      path.join(
        repoDetected,
        "specs",
        "contract_snapshot_policy",
        "spec_summary.md",
      ),
      "Goal: estabilizar doctor/status json contract\n",
      "utf8",
    );
    await writeFile(
      path.join(
        repoDetected,
        "specs",
        "contract_snapshot_policy",
        "requirements.md",
      ),
      "- R1. doctor expone output estable\n- R2. status expone output estable\n",
      "utf8",
    );
    await writeFile(
      path.join(
        repoDetected,
        "specs",
        "contract_snapshot_policy",
        "tasks.md",
      ),
      "- [ ] T1 (R2) ajustar output\n- [x] T2 (R1) cubrir doctor\n",
      "utf8",
    );

    const repairDetected = spawnSync(
      process.execPath,
      [distPath, "repair", "--repo-path", repoDetected],
      {
        cwd: repoDetected,
        encoding: "utf8",
      },
    );
    assert(
      repairDetected.status === 0,
      `repair failed to refresh headroom on active feature.\nstdout:\n${repairDetected.stdout}\nstderr:\n${repairDetected.stderr}`,
    );

    const headSummary = await readFile(
      path.join(
        repoDetected,
        ".harness",
        "progress",
        "head_contract_snapshot_policy.md",
      ),
      "utf8",
    );
    assert(
      headSummary.includes("requirements_focus: R2") &&
        headSummary.includes("test_layer: contract") &&
        headSummary.includes("fast_command: pnpm test:unit"),
      `repair did not refresh head_<feature>.md with testing/loop guidance.\n${headSummary}`,
    );

    await mkdir(repoJsFallback, { recursive: true });
    await writeJson(
      path.join(repoJsFallback, "package.json"),
      {
        name: "repo-js-fallback",
        packageManager: "pnpm@10.33.4",
      },
      true,
    );
    const setupJsFallback = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoJsFallback,
        "--layout",
        "full",
        "--clients",
        "claude,codex,copilot,opencode",
      ],
      {
        cwd: repoJsFallback,
        encoding: "utf8",
      },
    );
    assert(
      setupJsFallback.status === 0,
      `setup failed on JS fallback repo.\nstdout:\n${setupJsFallback.stdout}\nstderr:\n${setupJsFallback.stderr}`,
    );
    const jsFallbackVerification = await readFile(
      path.join(repoJsFallback, ".harness-docs", "verification.md"),
      "utf8",
    );
    assert(
      /Vitest/.test(jsFallbackVerification),
      `JS/TS fallback did not recommend Vitest.\n${jsFallbackVerification}`,
    );

    await mkdir(repoNonJs, { recursive: true });
    await writeFile(
      path.join(repoNonJs, "pyproject.toml"),
      "[project]\nname = \"repo-non-js\"\nversion = \"0.1.0\"\n",
      "utf8",
    );
    const setupNonJs = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoNonJs,
        "--layout",
        "full",
        "--clients",
        "claude,codex,copilot,opencode",
      ],
      {
        cwd: repoNonJs,
        encoding: "utf8",
      },
    );
    assert(
      setupNonJs.status === 0,
      `setup failed on non-JS repo.\nstdout:\n${setupNonJs.stdout}\nstderr:\n${setupNonJs.stderr}`,
    );
    const nonJsVerification = await readFile(
      path.join(repoNonJs, ".harness-docs", "verification.md"),
      "utf8",
    );
    assert(
      nonJsVerification.includes("suite rápida nativa del stack") &&
        !/Vitest/.test(nonJsVerification),
      `Non-JS fallback should stay neutral instead of forcing Vitest.\n${nonJsVerification}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeRelativeRepoPathStatusFallback() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-relative-status-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await mkdir(repoPath, { recursive: true });
    const canonicalRepoPath = await realpath(repoPath);

    const setup = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", ".", "--clients", "codex"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      setup.status === 0,
      `setup with relative --repo-path failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", ".", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      doctor.status === 0,
      `doctor failed after relative-path setup.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
    const doctorSnapshot = JSON.parse(doctor.stdout);
    assert(
      doctorSnapshot.repo_path === canonicalRepoPath &&
        doctorSnapshot.client_verification?.codex?.state === "verified",
      `relative repo_path still left Codex stale or non-absolute.\n${doctor.stdout}`,
    );

    const statusJson = spawnSync(
      process.execPath,
      [distPath, "status", "--repo-path", ".", "--brief", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      statusJson.status === 0,
      `status --brief --json failed.\nstdout:\n${statusJson.stdout}\nstderr:\n${statusJson.stderr}`,
    );
    const statusSnapshot = JSON.parse(statusJson.stdout);
    assert(
      statusSnapshot.repo_path === canonicalRepoPath &&
        typeof statusSnapshot.startup_brief === "string" &&
        statusSnapshot.startup_brief.includes(`repo=${canonicalRepoPath}`) &&
        statusSnapshot.client_verification?.codex?.state === "verified" &&
        statusSnapshot.client_readiness?.codex?.state === "verified",
      `status fallback did not expose the expected brief snapshot.\n${statusJson.stdout}`,
    );

    const statusBrief = spawnSync(
      process.execPath,
      [distPath, "status", "--repo-path", ".", "--brief"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      statusBrief.status === 0 &&
        statusBrief.stdout.includes(`repo=${canonicalRepoPath}`) &&
        statusBrief.stdout.includes("activation:"),
      `status --brief did not emit the startup brief.\nstdout:\n${statusBrief.stdout}\nstderr:\n${statusBrief.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeAssumedGlobalBindings() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-global-assumed-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });

    const localSetup = spawnSync(
      process.execPath,
      [distPath, "setup", "--repo-path", repoPath, "--clients", "claude"],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      localSetup.status === 0,
      `local setup for assumed binding smoke failed.\nstdout:\n${localSetup.stdout}\nstderr:\n${localSetup.stderr}`,
    );
    await rm(path.join(repoPath, ".mcp.json"), { force: true });

    const globalSetup = spawnSync(
      process.execPath,
      [distPath, "setup", "--global", "--clients", "claude-desktop"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      globalSetup.status === 0,
      `global setup for assumed binding smoke failed.\nstdout:\n${globalSetup.stdout}\nstderr:\n${globalSetup.stderr}`,
    );
    assert(
      globalSetup.stdout.includes("Claude Desktop") &&
        globalSetup.stdout.includes("configured_needs_activation") &&
        globalSetup.stdout.includes("harness_status"),
      `global setup did not explain the manual validation path.\n${globalSetup.stdout}`,
    );

    const claudeDesktopGlobalPath = globalClientConfigPath(
      homePath,
      "claude-desktop",
    );
    const claudeDesktopGlobal = JSON.parse(
      await readFile(claudeDesktopGlobalPath, "utf8"),
    );
    assert(
      claudeDesktopGlobal.mcpServers?.["arufheim-harness"]?.args?.includes(
        "--client",
      ) &&
        claudeDesktopGlobal.mcpServers?.["arufheim-harness"]?.args?.includes(
          "claude-desktop",
        ),
      `global Claude Desktop binding did not include --client.\n${JSON.stringify(claudeDesktopGlobal, null, 2)}`,
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      doctor.status === 0,
      `doctor should degrade, not fail, on assumed global bindings.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
    const snapshot = JSON.parse(doctor.stdout);
    assert(
      snapshot.doctor_summary?.status === "degraded" &&
        snapshot.binding_status?.state === "global_assumed" &&
        snapshot.binding_status?.global?.claude_desktop?.state === "assumed" &&
        snapshot.client_verification?.claude_desktop?.state === "configured" &&
        snapshot.client_readiness?.claude_desktop?.state ===
          "configured_needs_activation" &&
        snapshot.alerts.some(
          (alert) => alert.code === "bindings.global.claude_desktop.unambiguous",
        ),
      `doctor did not expose the assumed global binding warning.\n${doctor.stdout}`,
    );

    await withharness(
      {
        cwd: repoPath,
        args: ["--repo-path", repoPath, "--client", "claude-desktop"],
        env: {
          ...process.env,
          HOME: homePath,
        },
        name: "harness-smoke-claude-desktop-verified",
      },
      async ({ client }) => {
        const statusResult = await client.callTool({
          name: "harness_status",
          arguments: { mode: "brief_only" },
        });
        assert(
          statusResult.structuredContent?.binding_status?.global?.claude_desktop
            ?.state === "verified" &&
            statusResult.structuredContent?.client_verification?.claude_desktop
              ?.state === "verified" &&
            statusResult.structuredContent?.client_readiness?.claude_desktop
              ?.state === "verified",
          `runtime startup did not promote the assumed Claude Desktop binding.\n${JSON.stringify(statusResult, null, 2)}`,
        );
      },
    );

    const verifiedDoctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      verifiedDoctor.status === 0,
      `doctor should stay green after runtime verification.\nstdout:\n${verifiedDoctor.stdout}\nstderr:\n${verifiedDoctor.stderr}`,
    );
    const verifiedSnapshot = JSON.parse(verifiedDoctor.stdout);
    assert(
      verifiedSnapshot.doctor_summary?.status === "degraded" &&
        verifiedSnapshot.binding_status?.state === "global_fallback" &&
        verifiedSnapshot.binding_status?.global?.claude_desktop?.state ===
          "verified" &&
        verifiedSnapshot.client_verification?.claude_desktop?.state ===
          "verified" &&
        verifiedSnapshot.client_readiness?.claude_desktop?.state ===
          "verified" &&
        !verifiedSnapshot.alerts.some(
          (alert) => alert.code === "bindings.global.claude_desktop.unambiguous",
        ),
      `doctor did not promote the assumed global binding after runtime verification.\n${verifiedDoctor.stdout}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeStatusBriefRefreshesStaleHealth() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-status-refresh-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });
    const env = {
      ...process.env,
      HOME: homePath,
    };

    const setup = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--repo-path",
        repoPath,
        "--clients",
        "claude,copilot,codex,opencode",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      setup.status === 0,
      `status refresh setup failed.\nstdout:\n${setup.stdout}\nstderr:\n${setup.stderr}`,
    );

    const firstStatus = spawnSync(
      process.execPath,
      [distPath, "status", "--repo-path", repoPath, "--brief", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      firstStatus.status === 0,
      `initial status --brief --json failed.\nstdout:\n${firstStatus.stdout}\nstderr:\n${firstStatus.stderr}`,
    );
    const firstSnapshot = JSON.parse(firstStatus.stdout);
    assert(
      ["ok", "degraded"].includes(firstSnapshot.doctor_summary?.status) &&
        firstSnapshot.runtime_status?.runtime_source?.kind === "workspace_dev" &&
        firstSnapshot.binding_status?.repo_scoped?.codex === true &&
        firstSnapshot.client_readiness?.codex?.state === "verified",
      `initial status snapshot is not healthy before breaking the binding.\n${firstStatus.stdout}`,
    );

    await rm(path.join(repoPath, ".codex", "config.toml"), { force: true });

    const refreshedStatus = spawnSync(
      process.execPath,
      [distPath, "status", "--repo-path", repoPath, "--brief", "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      refreshedStatus.status === 0,
      `refreshed status --brief --json failed.\nstdout:\n${refreshedStatus.stdout}\nstderr:\n${refreshedStatus.stderr}`,
    );
    const refreshedSnapshot = JSON.parse(refreshedStatus.stdout);
    const persistedHealth = JSON.parse(
      await readFile(
        path.join(repoPath, ".harness", "metrics", "health.json"),
        "utf8",
      ),
    );
    assert(
      persistedHealth.verified_by === "status" &&
        persistedHealth.binding_status?.repo_scoped?.codex === false,
      `status --brief did not refresh the persisted health snapshot.\n${JSON.stringify(persistedHealth, null, 2)}`,
    );

    const doctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env,
      },
    );
    assert(
      doctor.status === 0,
      `doctor failed after breaking repo-scoped Codex binding.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
    );
    const doctorSnapshot = JSON.parse(doctor.stdout);

    assert(
      refreshedSnapshot.doctor_summary?.status ===
        doctorSnapshot.doctor_summary?.status &&
        refreshedSnapshot.binding_status?.repo_scoped?.codex ===
          doctorSnapshot.binding_status?.repo_scoped?.codex &&
        refreshedSnapshot.client_verification?.codex?.state ===
          doctorSnapshot.client_verification?.codex?.state &&
        refreshedSnapshot.client_readiness?.codex?.state ===
          doctorSnapshot.client_readiness?.codex?.state &&
        refreshedSnapshot.doctor_summary?.status !== "ok" &&
        refreshedSnapshot.binding_status?.repo_scoped?.codex === false,
      `status --brief reused stale health after the repo-scoped Codex binding changed.\nstatus:\n${refreshedStatus.stdout}\ndoctor:\n${doctor.stdout}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeGlobalPreferredRepoScopedBindings() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-global-preferred-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const outsidePath = path.join(tempRoot, "outside");
  const weakMarkerPath = path.join(tempRoot, "weak-marker");
  const legacyRepoPath = path.join(tempRoot, "legacy-repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });
    await mkdir(outsidePath, { recursive: true });
    await mkdir(weakMarkerPath, { recursive: true });
    await writeJson(path.join(weakMarkerPath, "feature_list.json"), [], true);
    await mkdir(legacyRepoPath, { recursive: true });
    await seedLegacyRootRepo(legacyRepoPath);

    const globalOnly = spawnSync(
      process.execPath,
      [distPath, "setup", "--global", "--clients", "claude-code,codex,copilot"],
      {
        cwd: outsidePath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      globalOnly.status === 0,
      `global setup outside a harness repo failed.\nstdout:\n${globalOnly.stdout}\nstderr:\n${globalOnly.stderr}`,
    );
    assert(
      globalOnly.stdout.includes("repo_context: none") &&
        globalOnly.stdout.includes("repo_scoped_preferred: skipped"),
      `global setup outside a harness repo did not explain that repo-scoped scaffold was skipped.\n${globalOnly.stdout}`,
    );
    assert(
      !(await fileExists(path.join(outsidePath, ".mcp.json"))) &&
        !(await fileExists(path.join(outsidePath, ".codex/config.toml"))) &&
        !(await fileExists(path.join(outsidePath, "harness.config.json"))),
      "global setup outside a harness repo should not create repo-local scaffold in an arbitrary cwd.",
    );

    const weakMarkerSetup = spawnSync(
      process.execPath,
      [distPath, "setup", "--global", "--clients", "claude-code,codex,copilot"],
      {
        cwd: weakMarkerPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      weakMarkerSetup.status === 0,
      `global setup with weak marker cwd failed.\nstdout:\n${weakMarkerSetup.stdout}\nstderr:\n${weakMarkerSetup.stderr}`,
    );
    assert(
      weakMarkerSetup.stdout.includes("repo_context: none") &&
        weakMarkerSetup.stdout.includes("repo_scoped_preferred: skipped"),
      `global setup treated a weak marker cwd as a detectable harness repo.\n${weakMarkerSetup.stdout}`,
    );
    assert(
      !(await fileExists(path.join(weakMarkerPath, ".mcp.json"))) &&
        !(await fileExists(path.join(weakMarkerPath, ".codex/config.toml"))) &&
        !(await fileExists(path.join(weakMarkerPath, "harness.config.json"))),
      "global setup should not scaffold repo-local bindings when cwd only has a weak legacy marker.",
    );

    const detectedLegacyRepair = spawnSync(
      process.execPath,
      [distPath, "repair", "--global", "--clients", "claude-code,codex"],
      {
        cwd: legacyRepoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      detectedLegacyRepair.status === 0,
      `global repair on a real legacy repo failed.\nstdout:\n${detectedLegacyRepair.stdout}\nstderr:\n${detectedLegacyRepair.stderr}`,
    );
    assert(
      detectedLegacyRepair.stdout.includes("repo_context: ") &&
        detectedLegacyRepair.stdout.includes("(detected)") &&
        detectedLegacyRepair.stdout.includes(
          "repo_scoped_preferred: claude-code, codex",
        ),
      `global repair did not keep detecting a real legacy repo.\n${detectedLegacyRepair.stdout}`,
    );
    assert(
      await fileExists(path.join(legacyRepoPath, ".mcp.json")) &&
        await fileExists(path.join(legacyRepoPath, ".codex/config.toml")),
      "global repair on a real legacy repo did not scaffold the preferred repo-scoped bindings.",
    );

    const explicitRepoSetup = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--global",
        "--repo-path",
        repoPath,
        "--clients",
        "claude-code,codex,copilot",
      ],
      {
        cwd: outsidePath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      explicitRepoSetup.status === 0,
      `global setup with explicit repo failed.\nstdout:\n${explicitRepoSetup.stdout}\nstderr:\n${explicitRepoSetup.stderr}`,
    );
    assert(
      explicitRepoSetup.stdout.includes("repo_context: ") &&
        explicitRepoSetup.stdout.includes("(explicit)") &&
        explicitRepoSetup.stdout.includes(
          "repo_scoped_preferred: claude-code, codex",
        ),
      `global setup with explicit repo did not report the hybrid scaffold.\n${explicitRepoSetup.stdout}`,
    );
    assert(
      await fileExists(path.join(repoPath, "harness.config.json")) &&
        await fileExists(path.join(repoPath, ".harness/feature_list.json")) &&
        await fileExists(path.join(repoPath, ".mcp.json")) &&
        await fileExists(path.join(repoPath, ".codex/config.toml")),
      "global setup with explicit repo did not scaffold the preferred repo-scoped bindings.",
    );

    const explicitDoctor = spawnSync(
      process.execPath,
      [distPath, "doctor", "--repo-path", repoPath, "--json"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      explicitDoctor.status === 0,
      `doctor should be healthy after hybrid global setup.\nstdout:\n${explicitDoctor.stdout}\nstderr:\n${explicitDoctor.stderr}`,
    );
    const explicitSnapshot = JSON.parse(explicitDoctor.stdout);
    assert(
      ["ok", "degraded"].includes(explicitSnapshot.doctor_summary?.status) &&
        explicitSnapshot.runtime_status?.runtime_source?.kind === "workspace_dev" &&
        explicitSnapshot.client_verification?.claude_code?.state ===
          "verified" &&
        explicitSnapshot.client_verification?.codex?.state === "verified",
      `hybrid global setup did not leave deterministic bindings verified.\n${explicitDoctor.stdout}`,
    );

    await rm(path.join(repoPath, ".mcp.json"), { force: true });
    await rm(path.join(repoPath, ".codex", "config.toml"), { force: true });

    const detectedRepair = spawnSync(
      process.execPath,
      [distPath, "repair", "--global", "--clients", "claude-code,codex"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      detectedRepair.status === 0,
      `global repair with detected repo failed.\nstdout:\n${detectedRepair.stdout}\nstderr:\n${detectedRepair.stderr}`,
    );
    assert(
      detectedRepair.stdout.includes("repo_context: ") &&
        detectedRepair.stdout.includes("(detected)") &&
        detectedRepair.stdout.includes(
          "repo_scoped_preferred: claude-code, codex",
        ),
      `global repair with detected repo did not report the hybrid scaffold.\n${detectedRepair.stdout}`,
    );
    assert(
      await fileExists(path.join(repoPath, ".mcp.json")) &&
        await fileExists(path.join(repoPath, ".codex/config.toml")),
      "global repair with detected repo did not restore the preferred repo-scoped bindings.",
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeGlobalInvalidConfigPreservation() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-global-invalid-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });

    const vscodeGlobalPath = globalClientConfigPath(homePath, "vscode");
    const claudeDesktopGlobalPath = globalClientConfigPath(
      homePath,
      "claude-desktop",
    );
    const codexGlobalPath = globalClientConfigPath(homePath, "codex");

    await mkdir(path.dirname(claudeDesktopGlobalPath), { recursive: true });
    await writeFile(claudeDesktopGlobalPath, "{ invalid json\n", "utf8");

    const blockedSetup = spawnSync(
      process.execPath,
      [distPath, "setup", "--global", "--clients", "claude,copilot"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      blockedSetup.status !== 0,
      `setup --global should fail closed on invalid Claude Desktop config.\nstdout:\n${blockedSetup.stdout}\nstderr:\n${blockedSetup.stderr}`,
    );
    assert(
      blockedSetup.stderr.includes("--force-managed-global"),
      `setup --global did not explain the invalid global config contract.\n${blockedSetup.stderr}`,
    );
    assert(
      !(await fileExists(vscodeGlobalPath)),
      `setup --global should not partially write other client configs when preflight fails.`,
    );
    assert(
      (await readFile(claudeDesktopGlobalPath, "utf8")) === "{ invalid json\n",
      `setup --global should preserve the invalid Claude Desktop config.`,
    );

    await mkdir(path.dirname(codexGlobalPath), { recursive: true });
    await writeFile(codexGlobalPath, "not valid toml\n", "utf8");

    const blockedRepair = spawnSync(
      process.execPath,
      [distPath, "repair", "--global", "--clients", "codex"],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      blockedRepair.status !== 0,
      `repair --global should fail closed on invalid Codex config.\nstdout:\n${blockedRepair.stdout}\nstderr:\n${blockedRepair.stderr}`,
    );
    assert(
      blockedRepair.stderr.includes("Codex global") &&
        blockedRepair.stderr.includes("--force-managed-global"),
      `repair --global did not explain the invalid Codex config contract.\n${blockedRepair.stderr}`,
    );
    assert(
      (await readFile(codexGlobalPath, "utf8")) === "not valid toml\n",
      `repair --global should preserve the invalid Codex config.`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeGlobalInvalidConfigForceRecovery() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-global-force-"),
  );
  const repoPath = path.join(tempRoot, "repo");
  const homePath = path.join(tempRoot, "home");

  try {
    await mkdir(repoPath, { recursive: true });

    const claudeDesktopGlobalPath = globalClientConfigPath(
      homePath,
      "claude-desktop",
    );
    const codexGlobalPath = globalClientConfigPath(homePath, "codex");

    await mkdir(path.dirname(claudeDesktopGlobalPath), { recursive: true });
    await writeFile(claudeDesktopGlobalPath, "{ invalid json\n", "utf8");

    const recoveredSetup = spawnSync(
      process.execPath,
      [
        distPath,
        "setup",
        "--global",
        "--clients",
        "claude-desktop",
        "--force-managed-global",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      recoveredSetup.status === 0,
      `setup --global --force-managed-global should recover invalid Claude Desktop config.\nstdout:\n${recoveredSetup.stdout}\nstderr:\n${recoveredSetup.stderr}`,
    );
    assert(
      recoveredSetup.stdout.includes("invalid_global_recovery: enabled") &&
        recoveredSetup.stdout.includes("recovered_backups: 1"),
      `setup recovery summary did not report the forced recovery.\n${recoveredSetup.stdout}`,
    );

    const recoveredClaudeDesktop = parseJsonc(
      await readFile(claudeDesktopGlobalPath, "utf8"),
    );
    assert(
      recoveredClaudeDesktop?.mcpServers?.["arufheim-harness"]?.args?.includes(
        "claude-desktop",
      ),
      `setup recovery did not regenerate the Claude Desktop harness entry.\n${JSON.stringify(recoveredClaudeDesktop, null, 2)}`,
    );
    const claudeDesktopBackups = (await readdir(path.dirname(claudeDesktopGlobalPath)))
      .filter((fileName) =>
        fileName.startsWith(
          `${path.basename(claudeDesktopGlobalPath)}.arufheim-harness.invalid-backup.`,
        ),
      );
    assert(
      claudeDesktopBackups.length === 1,
      `setup recovery did not create exactly one backup for Claude Desktop.\n${claudeDesktopBackups.join("\n")}`,
    );
    assert(
      (await readFile(
        path.join(path.dirname(claudeDesktopGlobalPath), claudeDesktopBackups[0]),
        "utf8",
      )) === "{ invalid json\n",
      "setup recovery backup does not preserve the original invalid Claude Desktop config.",
    );

    await mkdir(path.dirname(codexGlobalPath), { recursive: true });
    await writeFile(codexGlobalPath, "not valid toml\n", "utf8");

    const recoveredRepair = spawnSync(
      process.execPath,
      [
        distPath,
        "repair",
        "--global",
        "--clients",
        "codex",
        "--force-managed-global",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homePath,
        },
      },
    );
    assert(
      recoveredRepair.status === 0,
      `repair --global --force-managed-global should recover invalid Codex config.\nstdout:\n${recoveredRepair.stdout}\nstderr:\n${recoveredRepair.stderr}`,
    );
    assert(
      recoveredRepair.stdout.includes("invalid_global_recovery: enabled") &&
        recoveredRepair.stdout.includes("recovered_backups: 1"),
      `repair recovery summary did not report the forced recovery.\n${recoveredRepair.stdout}`,
    );
    assert(
      (await readFile(codexGlobalPath, "utf8")).includes(
        '[mcp_servers.arufheim-harness]',
      ),
      "repair recovery did not regenerate the Codex harness section.",
    );
    const codexBackups = (await readdir(path.dirname(codexGlobalPath))).filter(
      (fileName) =>
        fileName.startsWith(
          `${path.basename(codexGlobalPath)}.arufheim-harness.invalid-backup.`,
        ),
    );
    assert(
      codexBackups.length === 1,
      `repair recovery did not create exactly one backup for Codex.\n${codexBackups.join("\n")}`,
    );
    assert(
      (await readFile(
        path.join(path.dirname(codexGlobalPath), codexBackups[0]),
        "utf8",
      )) === "not valid toml\n",
      "repair recovery backup does not preserve the original invalid Codex config.",
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeConfigCommandMutations() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-config-cli-"),
  );
  const repoPath = path.join(tempRoot, "repo");

  try {
    await mkdir(repoPath, { recursive: true });

    const init = spawnSync(process.execPath, [distPath, "config", "init", "--repo"], {
      cwd: repoPath,
      encoding: "utf8",
    });
    assert(
      init.status === 0,
      `config init failed.\nstdout:\n${init.stdout}\nstderr:\n${init.stderr}`,
    );

    const updates = [
      ["permissionPolicy.mode", "always_ask"],
      ["allowedCommands", '["pnpm test","ls"]'],
      ["ignored", '["dist/**",".git/**"]'],
      ["permissionPolicy.allowedTools", '["write_file","run_command"]'],
      ["permissionPolicy.allowedRisk", '["R1","R2"]'],
    ];

    for (const [key, value] of updates) {
      const result = spawnSync(
        process.execPath,
        [distPath, "config", "set", key, value, "--repo"],
        {
          cwd: repoPath,
          encoding: "utf8",
        },
      );
      assert(
        result.status === 0,
        `config set ${key} failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }

    const raw = await readFile(path.join(repoPath, "harness.config.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert(
      parsed.permissionPolicy?.mode === "always_ask",
      `config set did not update permissionPolicy.mode.\n${raw}`,
    );
    assert(
      Array.isArray(parsed.allowedCommands) &&
        parsed.allowedCommands.includes("pnpm test") &&
        parsed.allowedCommands.includes("ls"),
      `config set did not update allowedCommands.\n${raw}`,
    );
    assert(
      Array.isArray(parsed.permissionPolicy?.allowedRisk) &&
        parsed.permissionPolicy.allowedRisk.includes("R1") &&
        parsed.permissionPolicy.allowedRisk.includes("R2"),
      `config set did not update permissionPolicy.allowedRisk.\n${raw}`,
    );

    const invalidRisk = spawnSync(
      process.execPath,
      [
        distPath,
        "config",
        "set",
        "permissionPolicy.allowedRisk",
        '["R9"]',
        "--repo",
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
      },
    );
    assert(
      invalidRisk.status !== 0,
      `Expected config set to reject an invalid risk class.\nstdout:\n${invalidRisk.stdout}\nstderr:\n${invalidRisk.stderr}`,
    );
    assert(
      /R0, R1, R2, R3/.test(`${invalidRisk.stdout}\n${invalidRisk.stderr}`),
      `Invalid-risk error did not mention the accepted risk classes.\nstdout:\n${invalidRisk.stdout}\nstderr:\n${invalidRisk.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeReleasePublishGate() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "harness-smoke-release-publish-"),
  );
  const scriptPath = path.join(repoRoot, "scripts", "release-publish-check.mjs");

  try {
    const validRoot = path.join(tempRoot, "valid");
    await mkdir(validRoot, { recursive: true });
    await writeJson(
      path.join(validRoot, "package.json"),
      {
        name: "fixture",
        version: "9.9.9",
      },
      true,
    );
    await writeFile(
      path.join(validRoot, "CHANGELOG.md"),
      "# Changelog\n\n## Unreleased\n\n## 9.9.9\n\n- fixture release\n",
      "utf8",
    );
    await writeJson(
      path.join(validRoot, "release-readiness.json"),
      {
        version: "9.9.9",
        manual_checks: [
          {
            id: "repo_base",
            label: "Repo base",
            required: true,
            checked: true,
            verified_at: "2026-06-15T00:00:00Z",
            notes: "",
          },
          {
            id: "optional_case",
            label: "Optional case",
            required: false,
            checked: false,
            verified_at: null,
            notes: "",
          },
        ],
      },
      true,
    );

    const valid = spawnSync(
      process.execPath,
      [scriptPath, "--skip-automated", "--root", validRoot],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    assert(
      valid.status === 0 &&
        valid.stdout.includes("[OK] release:publish-check") &&
        valid.stdout.includes("version=9.9.9"),
      `release:publish-check did not pass a valid fixture.\nstdout:\n${valid.stdout}\nstderr:\n${valid.stderr}`,
    );

    const invalidRoot = path.join(tempRoot, "invalid");
    await mkdir(invalidRoot, { recursive: true });
    await writeJson(
      path.join(invalidRoot, "package.json"),
      {
        name: "fixture",
        version: "9.9.9",
      },
      true,
    );
    await writeFile(
      path.join(invalidRoot, "CHANGELOG.md"),
      "# Changelog\n\n## Unreleased\n\n## 9.9.9\n\n- fixture release\n",
      "utf8",
    );
    await writeJson(
      path.join(invalidRoot, "release-readiness.json"),
      {
        version: "9.9.9",
        manual_checks: [
          {
            id: "repo_base",
            label: "Repo base",
            required: true,
            checked: false,
            verified_at: null,
            notes: "",
          },
        ],
      },
      true,
    );

    const invalid = spawnSync(
      process.execPath,
      [scriptPath, "--skip-automated", "--root", invalidRoot],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    assert(
      invalid.status !== 0 &&
        `${invalid.stdout}\n${invalid.stderr}`.includes(
          "Falta cerrar la checklist manual de release",
        ),
      `release:publish-check did not reject a fixture with incomplete manual checks.\nstdout:\n${invalid.stdout}\nstderr:\n${invalid.stderr}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function smokeManagedRuntimeSharedDocs() {
  const docsList = spawnSync(
    smokeManagedShimPath,
    ["docs", "list"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        XDG_CONFIG_HOME: smokeXdgHome,
      },
    },
  );
  assert(
    docsList.status === 0 &&
      docsList.stdout.includes("verification") &&
      docsList.stdout.includes("loop_contract"),
    `Managed runtime docs list failed.\nstdout:\n${docsList.stdout}\nstderr:\n${docsList.stderr}`,
  );

  const docShow = spawnSync(
    smokeManagedShimPath,
    ["docs", "show", "verification"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        XDG_CONFIG_HOME: smokeXdgHome,
      },
    },
  );
  assert(
    docShow.status === 0 && docShow.stdout.includes("# Verificación"),
    `Managed runtime docs show failed.\nstdout:\n${docShow.stdout}\nstderr:\n${docShow.stderr}`,
  );
}

function smokeCliSurfaces() {
  for (const versionArg of ["--version", "-v", "version"]) {
    const version = spawnSync(process.execPath, [distPath, versionArg], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert(
      version.status === 0 && version.stdout.trim() === harnessVersion,
      `${versionArg} did not print the CLI version.\nstdout:\n${version.stdout}\nstderr:\n${version.stderr}`,
    );
    assert(
      !version.stderr.includes("harness MCP ready"),
      `${versionArg} should not start the MCP server.\nstderr:\n${version.stderr}`,
    );
  }

  const help = spawnSync(process.execPath, [distPath, "help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert(
    help.status === 0,
    `help command failed.\nstdout:\n${help.stdout}\nstderr:\n${help.stderr}`,
  );
  assert(
    help.stdout.includes("spec_ready"),
    `help output does not document spec_ready.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("setup") &&
      help.stdout.includes("repair") &&
      help.stdout.includes("status") &&
      help.stdout.includes("simulate") &&
      help.stdout.includes("--json") &&
      help.stdout.includes("--update"),
    `help output does not document the setup/repair/doctor surfaces.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("release:check") &&
      help.stdout.includes("release:publish-check"),
    `help output does not document the release check.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("manual-release-checklist.md") &&
      help.stdout.includes("release-readiness.json") &&
      help.stdout.includes("--force-managed-global") &&
      help.stdout.includes("fallan cerrado"),
    `help output does not document the global validation contract.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("harness_status"),
    `help output is missing MCP tool documentation.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("harness_loop_status") &&
      help.stdout.includes("harness_loop_event"),
    `help output does not document the loop tools.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("--opencode"),
    `help output does not document init --opencode.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("harness://health"),
    `help output does not document the health resource.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("harness://loop/active"),
    `help output does not document the active loop resource.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("permissionPolicy") &&
      help.stdout.includes('["pnpm test","npm test"]'),
    `help output does not document config array usage.\n${help.stdout}`,
  );

  const doctor = spawnSync(
    process.execPath,
    [distPath, "doctor", "--repo-path", repoRoot],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert(
    doctor.status === 0,
    `doctor command failed.\nstdout:\n${doctor.stdout}\nstderr:\n${doctor.stderr}`,
  );
  assert(
    doctor.stdout.includes("workflow layout detectado"),
    `doctor output did not include workflow layout diagnostics.\n${doctor.stdout}`,
  );

  const doctorJson = spawnSync(
    process.execPath,
    [distPath, "doctor", "--repo-path", repoRoot, "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert(
    doctorJson.status === 0,
    `doctor --json failed.\nstdout:\n${doctorJson.stdout}\nstderr:\n${doctorJson.stderr}`,
  );
  const doctorSnapshot = JSON.parse(doctorJson.stdout);
  assert(
    typeof doctorSnapshot.doctor_summary?.status === "string" &&
      Array.isArray(doctorSnapshot.diagnostics),
    `doctor --json did not expose the expected structured snapshot.\n${doctorJson.stdout}`,
  );

  const tui = spawnSync(
    process.execPath,
    [distPath, "tui", "--repo-path", repoRoot],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert(
    tui.status === 0,
    `tui command failed.\nstdout:\n${tui.stdout}\nstderr:\n${tui.stderr}`,
  );
  assert(
    tui.stdout.includes("Features") &&
      tui.stdout.includes("Alerts") &&
      tui.stdout.includes("Inbox") &&
      tui.stdout.includes("Runtime") &&
      tui.stdout.includes("Health") &&
      tui.stdout.includes("Loop"),
    `tui output does not contain the expected sections.\n${tui.stdout}`,
  );
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

function globalClientConfigPath(homePath, client) {
  if (client === "vscode") {
    if (process.platform === "darwin") {
      return path.join(
        homePath,
        "Library/Application Support/Code/User/mcp.json",
      );
    }
    if (process.platform === "win32") {
      return path.join(homePath, "Code/User/mcp.json");
    }
    return path.join(homePath, ".config/Code/User/mcp.json");
  }

  if (client === "claude-desktop") {
    if (process.platform === "darwin") {
      return path.join(
        homePath,
        "Library/Application Support/Claude/claude_desktop_config.json",
      );
    }
    if (process.platform === "win32") {
      return path.join(homePath, "Claude/claude_desktop_config.json");
    }
    return path.join(homePath, ".config/claude/claude_desktop_config.json");
  }

  if (client === "claude-code") {
    return path.join(homePath, ".claude.json");
  }

  return path.join(homePath, ".codex", "config.toml");
}

async function fileExists(filePath) {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function withharness(options, run) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [distPath, ...options.args],
    cwd: options.cwd,
    env: options.env,
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
      version: harnessVersion,
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

async function seedHiddenWorkflowRepo(repoPath) {
  await mkdir(path.join(repoPath, ".harness", "progress"), { recursive: true });
  await mkdir(path.join(repoPath, ".harness", "inbox", "processed"), {
    recursive: true,
  });

  await writeJson(
    path.join(repoPath, "harness.config.json"),
    {
      allowedCommands: [],
      ignored: ["node_modules/**", ".git/**", "dist/**", ".harness/**"],
    },
    true,
  );
  await writeJson(
    path.join(repoPath, ".harness", "feature_list.json"),
    {
      project: "smoke-hidden",
      features: [
        {
          id: 1,
          name: "hidden-alpha",
          description: "hidden workflow feature",
          status: "pending",
        },
      ],
    },
    true,
  );
  await writeJson(path.join(repoPath, ".harness", "feature_history.json"), {
    archived_features: [],
  });
  await writeFile(
    path.join(repoPath, ".harness", "progress", "current.md"),
    DEFAULT_CURRENT_MD,
    "utf8",
  );
  await writeFile(
    path.join(repoPath, ".harness", "progress", "history.md"),
    DEFAULT_HISTORY_MD,
    "utf8",
  );
  await writeFile(
    path.join(repoPath, ".harness", "inbox", "hidden-task.md"),
    "Hidden workflow task\n",
    "utf8",
  );
}

async function seedHiddenSddRepo(repoPath, featureName) {
  await mkdir(path.join(repoPath, ".harness", "progress"), { recursive: true });
  await mkdir(path.join(repoPath, ".harness", "inbox", "processed"), {
    recursive: true,
  });

  await writeJson(
    path.join(repoPath, "harness.config.json"),
    {
      version: 1,
      allowedCommands: [],
      ignored: ["node_modules/**", ".git/**", "dist/**", ".harness/**"],
    },
    true,
  );
  await writeJson(
    path.join(repoPath, ".harness", "feature_list.json"),
    {
      project: "smoke-sdd",
      features: [
        {
          id: 1,
          name: featureName,
          description: "sdd workflow feature",
          sdd: true,
          status: "pending",
        },
      ],
    },
    true,
  );
  await writeJson(path.join(repoPath, ".harness", "feature_history.json"), {
    archived_features: [],
  });
  await writeFile(
    path.join(repoPath, ".harness", "progress", "current.md"),
    DEFAULT_CURRENT_MD,
    "utf8",
  );
  await writeFile(
    path.join(repoPath, ".harness", "progress", "history.md"),
    DEFAULT_HISTORY_MD,
    "utf8",
  );
}

async function writeSddSpecFiles(repoPath, featureName) {
  const specDir = path.join(repoPath, "specs", featureName);
  await mkdir(specDir, { recursive: true });
  await writeFile(path.join(specDir, "requirements.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(specDir, "design.md"), "# Design\n", "utf8");
  await writeFile(path.join(specDir, "tasks.md"), "# Tasks\n", "utf8");
  await writeFile(
    path.join(specDir, "spec_summary.md"),
    "Goal: smoke spec\n",
    "utf8",
  );
}

async function seedLegacyRootRepo(repoPath) {
  await mkdir(path.join(repoPath, "progress"), { recursive: true });
  await mkdir(path.join(repoPath, "inbox", "processed"), { recursive: true });
  await mkdir(path.join(repoPath, "docs"), { recursive: true });

  await writeJson(
    path.join(repoPath, "harness.config.json"),
    {
      allowedCommands: [],
      ignored: ["node_modules/**", ".git/**", "dist/**", ".harness/**"],
    },
    true,
  );
  await writeJson(
    path.join(repoPath, "feature_list.json"),
    [
      {
        id: 1,
        name: "legacy-alpha",
        description: "legacy workflow feature",
        status: "pending",
      },
    ],
    true,
  );
  await writeFile(path.join(repoPath, "progress", "README.md"), "# Progress\n", "utf8");
  await writeFile(
    path.join(repoPath, "progress", "current.md"),
    DEFAULT_CURRENT_MD,
    "utf8",
  );
  await writeFile(
    path.join(repoPath, "progress", "history.md"),
    DEFAULT_HISTORY_MD,
    "utf8",
  );
  await writeFile(
    path.join(repoPath, "inbox", "README.md"),
    "# inbox\n",
    "utf8",
  );
  await writeFile(
    path.join(repoPath, "inbox", "legacy-task.md"),
    "Legacy workflow task\n",
    "utf8",
  );
  for (const file of [
    "architecture.md",
    "conventions.md",
    "specs.md",
    "verification.md",
  ]) {
    await writeFile(path.join(repoPath, "docs", file), `# ${file}\n`, "utf8");
  }
  await writeFile(path.join(repoPath, "AGENTS.md"), "# AGENTS\n", "utf8");
  await writeFile(path.join(repoPath, "CLAUDE.md"), "## Comunicación\n", "utf8");
  await writeFile(path.join(repoPath, "CODEX.md"), "# CODEX\n", "utf8");
  await mkdir(path.join(repoPath, ".claude", "commands"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".claude", "commands", "harness.md"),
    "# Harness\n",
    "utf8",
  );
  await mkdir(path.join(repoPath, ".github"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".github", "copilot-instructions.md"),
    "## Comunicación\n",
    "utf8",
  );
  await mkdir(path.join(repoPath, ".vscode"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".vscode", "mcp.json"),
    JSON.stringify({ servers: {} }, null, 2) + "\n",
    "utf8",
  );
  await writeFile(path.join(repoPath, "CHECKPOINTS.md"), "# CHECKPOINTS\n", "utf8");
}

async function writeJson(filePath, value, trailingNewline = false) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(value, null, 2) + (trailingNewline ? "\n" : ""),
    "utf8",
  );
}

async function readSingleLoopFilePath(repoPath) {
  const loopsDir = path.join(repoPath, ".harness", "metrics", "loops");
  const names = (await readdir(loopsDir)).filter((name) => name.endsWith(".json"));
  assert(
    names.length === 1,
    `Expected exactly one loop file.\n${names.join("\n")}`,
  );
  return path.join(loopsDir, names[0]);
}

async function readSingleLoopFile(repoPath) {
  const loopPath = await readSingleLoopFilePath(repoPath);
  return JSON.parse(await readFile(loopPath, "utf8"));
}

function firstText(result) {
  const content = result.content?.[0];
  if (!content || !("text" in content)) {
    fail(`Tool result did not return text content.\n${JSON.stringify(result, null, 2)}`);
  }
  return content.text;
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
