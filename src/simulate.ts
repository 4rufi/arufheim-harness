import process from "node:process";

import type { ResolvedharnessConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { buildDoctorSnapshot } from "./doctor.js";
import { readLoopStatus, type LoopSummary } from "./loop.js";
import { estimateSerializedPayload } from "./session-metrics.js";
import { buildHarnessStatus } from "./status.js";

const FLOW_NAMES = ["startup", "activation", "loop", "triage"] as const;

type SimulateFlowName = (typeof FLOW_NAMES)[number];

interface SimulatedStep {
  surface: string;
  format: "json";
  bytes: number;
  tokens: number;
  detail?: string;
}

interface SimulatedFlow {
  flow: SimulateFlowName;
  steps: SimulatedStep[];
  total_bytes: number;
  total_tokens: number;
}

interface SimulationReport {
  repo_path: string;
  note: string;
  flows: SimulatedFlow[];
}

interface LoopToolPayload {
  exists: boolean;
  feature_id?: number;
  feature_name?: string;
  path?: string;
  loop?: unknown;
  loop_summary?: LoopSummary | null;
}

interface SimulationContext {
  repoPath: string;
  startupStatus(): Promise<Record<string, unknown>>;
  activationStatus(): Promise<Record<string, unknown>>;
  doctorSnapshot(): Promise<unknown>;
  loopPayload(): Promise<LoopToolPayload>;
}

function readOptionValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return argv[index + 1] ?? null;
}

function parseSelectedFlows(argv: string[]): SimulateFlowName[] {
  const value = readOptionValue(argv, "--flow");
  if (!value || value === "all") {
    return [...FLOW_NAMES];
  }

  const selected = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (selected.length === 0) {
    return [...FLOW_NAMES];
  }

  if (selected.includes("all")) {
    return [...FLOW_NAMES];
  }

  for (const entry of selected) {
    if (!FLOW_NAMES.includes(entry as SimulateFlowName)) {
      throw new Error(
        `Unknown flow '${entry}'. Use one of: ${FLOW_NAMES.join(", ")}, all.`,
      );
    }
  }

  return FLOW_NAMES.filter((flow) => selected.includes(flow));
}

function summarizeLoopPayload(payload: LoopToolPayload): string {
  if (!payload.exists) {
    return "exists=false";
  }

  if (!payload.loop_summary) {
    return "exists=true";
  }

  return `${payload.loop_summary.phase}:a${payload.loop_summary.attempt_index}`;
}

function measureJsonStep(
  surface: string,
  payload: unknown,
  detail?: string,
): SimulatedStep {
  const measured = estimateSerializedPayload(payload);
  return {
    surface,
    format: "json",
    bytes: measured.bytes,
    tokens: measured.tokens,
    ...(detail ? { detail } : {}),
  };
}

function sumFlow(steps: SimulatedStep[]): Pick<SimulatedFlow, "total_bytes" | "total_tokens"> {
  return {
    total_bytes: steps.reduce((total, step) => total + step.bytes, 0),
    total_tokens: steps.reduce((total, step) => total + step.tokens, 0),
  };
}

function createSimulationContext(config: ResolvedharnessConfig): SimulationContext {
  let startupStatusPromise: Promise<Record<string, unknown>> | undefined;
  let activationStatusPromise: Promise<Record<string, unknown>> | undefined;
  let doctorSnapshotPromise: Promise<unknown> | undefined;
  let loopPayloadPromise: Promise<LoopToolPayload> | undefined;

  return {
    repoPath: config.repoPath,
    startupStatus() {
      if (!startupStatusPromise) {
        startupStatusPromise = buildHarnessStatus({
          repoPath: config.repoPath,
          configPath: config.configPath,
          configScope: config.configScope,
          permissionPolicy: config.permissionPolicy,
          mode: "brief_minimal",
          preferCachedHealth: false,
        }).then((snapshot) => snapshot.content);
      }
      return startupStatusPromise;
    },
    activationStatus() {
      if (!activationStatusPromise) {
        activationStatusPromise = buildHarnessStatus({
          repoPath: config.repoPath,
          configPath: config.configPath,
          configScope: config.configScope,
          permissionPolicy: config.permissionPolicy,
          mode: "brief_only",
          preferCachedHealth: false,
        }).then((snapshot) => snapshot.content);
      }
      return activationStatusPromise;
    },
    doctorSnapshot() {
      if (!doctorSnapshotPromise) {
        doctorSnapshotPromise = buildDoctorSnapshot(config.repoPath, {
          persist: false,
        });
      }
      return doctorSnapshotPromise;
    },
    loopPayload() {
      if (!loopPayloadPromise) {
        loopPayloadPromise = readLoopStatus(config.repoPath).then((status) => ({
          exists: status.exists,
          feature_id: status.feature_id,
          feature_name: status.feature_name,
          path: status.path,
          loop: status.loop,
          loop_summary: status.loop_summary,
        }));
      }
      return loopPayloadPromise;
    },
  };
}

async function buildFlow(
  flow: SimulateFlowName,
  context: SimulationContext,
): Promise<SimulatedFlow> {
  let steps: SimulatedStep[] = [];

  if (flow === "startup") {
    steps = [
      measureJsonStep(
        "cli:status:brief_minimal:json",
        await context.startupStatus(),
      ),
    ];
  } else if (flow === "activation") {
    steps = [
      measureJsonStep(
        "cli:status:brief_only:json",
        await context.activationStatus(),
      ),
    ];
  } else if (flow === "loop") {
    const [startupStatus, loopPayload] = await Promise.all([
      context.startupStatus(),
      context.loopPayload(),
    ]);
    steps = [
      measureJsonStep("cli:status:brief_minimal:json", startupStatus),
      measureJsonStep(
        "tool:harness_loop_status:json",
        loopPayload,
        summarizeLoopPayload(loopPayload),
      ),
    ];
  } else if (flow === "triage") {
    const [activationStatus, doctorSnapshot, loopPayload] = await Promise.all([
      context.activationStatus(),
      context.doctorSnapshot(),
      context.loopPayload(),
    ]);
    steps = [
      measureJsonStep("cli:status:brief_only:json", activationStatus),
      measureJsonStep("cli:doctor:json", doctorSnapshot),
      measureJsonStep(
        "tool:harness_loop_status:json",
        loopPayload,
        summarizeLoopPayload(loopPayload),
      ),
    ];
  }

  return {
    flow,
    steps,
    ...sumFlow(steps),
  };
}

export async function buildSimulationReport(
  config: ResolvedharnessConfig,
  selectedFlows: SimulateFlowName[],
): Promise<SimulationReport> {
  const context = createSimulationContext(config);
  const flows = await Promise.all(
    selectedFlows.map((flow) => buildFlow(flow, context)),
  );

  return {
    repo_path: context.repoPath,
    note: "Estimación local usando ceil(bytes/4) sobre payloads serializados del contrato real. No representa billing del provider y no escribe session.json.",
    flows,
  };
}

function renderHumanReport(report: SimulationReport): string {
  const lines = [
    "",
    "harness simulate",
    "",
    `  repo: ${report.repo_path}`,
    `  note: ${report.note}`,
  ];

  for (const flow of report.flows) {
    lines.push("");
    lines.push(`  flow: ${flow.flow}`);
    for (const step of flow.steps) {
      const detail = step.detail ? ` (${step.detail})` : "";
      lines.push(
        `    - ${step.surface} [${step.format}] bytes=${step.bytes} tok≈${step.tokens}${detail}`,
      );
    }
    lines.push(
      `    total: bytes=${flow.total_bytes} tok≈${flow.total_tokens}`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runSimulate(argv: string[] = []): Promise<void> {
  const json = argv.includes("--json");
  const selectedFlows = parseSelectedFlows(argv);
  const config = await loadConfig({ argv });
  const report = await buildSimulationReport(config, selectedFlows);
  const output = json
    ? JSON.stringify(report, null, 2) + "\n"
    : renderHumanReport(report);
  process.stdout.write(output);
}
