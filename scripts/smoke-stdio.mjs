import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
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

try {
  await smokeDefaultRepo();
  await smokeMissingRawConfig();
  await smokeSecurityBoundaries();
  await smokeLegacyRootCompatibility();
  await smokeWorkflowHiddenLayout();
  await smokeInitScaffold();
  smokeCliSurfaces();
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
          initialStatus.structuredContent?.next_step === "(sin plan activo)",
          `harness_status did not ignore the hidden-layout placeholder.\n${JSON.stringify(initialStatus, null, 2)}`,
        );

        const hiddenInbox = await client.callTool({
          name: "inbox_list",
          arguments: {},
        });
        assert(
          firstText(hiddenInbox).includes("hidden-task.md"),
          `inbox_list did not use the hidden inbox layout.\n${JSON.stringify(hiddenInbox, null, 2)}`,
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
      `init command failed.\nstdout:\n${init.stdout}\nstderr:\n${init.stderr}`,
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
      "AGENTS.md",
      "CLAUDE.md",
      "CODEX.md",
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
        agentsText.includes(".harness/feature_list.json"),
      `AGENTS.md did not point to the canonical hidden workflow paths.\n${agentsText}`,
    );

    const leaderPrompt = await readFile(
      path.join(repoPath, ".github", "prompts", "leader.prompt.md"),
      "utf8",
    );
    assert(
      leaderPrompt.includes("mcp_arufheim-harness_harness_status") &&
        leaderPrompt.includes('mode: "brief_only"') &&
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
        opencodeConfig.includes('"permission"'),
      `OpenCode scaffold is missing schema, MCP or permission policy.\n${opencodeConfig}`,
    );

    const opencodeCommand = await readFile(
      path.join(repoPath, ".opencode", "commands", "harness.md"),
      "utf8",
    );
    assert(
      opencodeCommand.includes("harness_status") &&
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
        claudeInstructions.includes('mode: "brief_only"') &&
        claudeInstructions.includes("startup_brief"),
      `CLAUDE.md does not point to the compact startup flow.\n${claudeInstructions}`,
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

function smokeCliSurfaces() {
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
    help.stdout.includes("harness_status"),
    `help output is missing MCP tool documentation.\n${help.stdout}`,
  );
  assert(
    help.stdout.includes("--opencode"),
    `help output does not document init --opencode.\n${help.stdout}`,
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
      tui.stdout.includes("Inbox") &&
      tui.stdout.includes("Runtime") &&
      tui.stdout.includes("Metrics"),
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
      version: "1.0.0",
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
