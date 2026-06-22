import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadConfig } from "./config.js";
import {
  evaluateHarnessHealth,
  formatClientReadinessBrief,
  formatHealthBrief,
  getHealthClientLabel,
  listClientReadinessEntries,
} from "./health.js";
import { readSessionMetrics, type SessionMetrics } from "./session-metrics.js";
import { resolveExistingWithinRepo } from "./safety.js";
import { readMemoryEntries } from "./tools/shared-memory.js";
import {
  listPendingInboxEntries,
  parseFeatureListText,
  resolveWorkflowPaths,
} from "./workflow.js";

// ── Catppuccin Mocha ─────────────────────────────────────────────────────────
const P = {
  surface2: "#585b70",
  subtext0: "#bac2de",
  subtext1: "#a6adc8",
  text: "#cdd6f4",
  green: "#a6e3a1",
  blue: "#89b4fa",
  yellow: "#f9e2af",
  red: "#f38ba8",
  teal: "#94e2d5",
  mauve: "#cba6f7",
} as const;

const RST = "\x1b[0m";
const BOLD = "\x1b[1m";

function ansi(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(v >> 16) & 0xff};${(v >> 8) & 0xff};${v & 0xff}m`;
}

/** Colored text */
function c(hex: string, text: string): string {
  return `${ansi(hex)}${text}${RST}`;
}

/** Bold text */
function b(text: string): string {
  return `${BOLD}${text}${RST}`;
}

// ── Layout helpers ───────────────────────────────────────────────────────────
const W = Math.min(Math.max(process.stdout.columns || 72, 54), 100);
const INNER = W - 4; // │ [sp] content [sp] │

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function pad(s: string, width: number): string {
  const vlen = stripAnsi(s).length;
  return s + " ".repeat(Math.max(0, width - vlen));
}

function row(content = ""): string {
  const border = c(P.surface2, "│");
  return `${border} ${pad(content, INNER)} ${border}`;
}

function sep(): string {
  const line = "─".repeat(W - 2);
  return `${c(P.surface2, "├" + line + "┤")}`;
}

function tuiTop(title: string): string {
  const t = ` ${c(P.mauve, b(title))} `;
  const fill = "─".repeat(Math.max(0, W - 2 - 1 - stripAnsi(t).length));
  return `${c(P.surface2, "╭─")}${t}${c(P.surface2, fill + "╮")}`;
}

function tuiBottom(): string {
  return c(P.surface2, "╰" + "─".repeat(W - 2) + "╯");
}

function sectionLabel(text: string, badge = ""): string {
  const content = `${c(P.subtext1, b(text))}${badge ? "  " + badge : ""}`;
  return row(content);
}

// ── Data types ───────────────────────────────────────────────────────────────
type FeatureStatus = "in_progress" | "pending" | "done" | "blocked";

interface Feature {
  id?: number;
  name: string;
  status: FeatureStatus;
  description?: string;
}

interface MemEntry {
  id: number;
  type: string;
  title: string;
  timestamp: string;
}

// ── Data loaders ─────────────────────────────────────────────────────────────
async function loadFeatures(repoPath: string): Promise<Feature[]> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  try {
    const safePath = await resolveExistingWithinRepo(
      repoPath,
      workflowPaths.featureListPath,
    );
    const raw = await readFile(safePath, "utf8");
    return parseFeatureListText(raw).features as Feature[];
  } catch {
    return [];
  }
}

async function loadNextStep(repoPath: string): Promise<string[]> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  try {
    const safePath = await resolveExistingWithinRepo(
      repoPath,
      workflowPaths.currentPath,
    );
    const raw = await readFile(safePath, "utf8");
    const lines = raw.split("\n");
    const idx = lines.findIndex((l) => l.trim().startsWith("## Próximo paso"));
    if (idx === -1) return [];
    const result: string[] = [];
    for (const l of lines.slice(idx + 1)) {
      if (l.startsWith("##")) break;
      const t = l.trim();
      if (t) result.push(t);
    }
    return result.slice(0, 4);
  } catch {
    return [];
  }
}

async function loadInbox(repoPath: string): Promise<string[]> {
  return listPendingInboxEntries(repoPath);
}

async function loadMemory(repoPath: string, limit = 4): Promise<MemEntry[]> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const entries = await readMemoryEntries(repoPath, workflowPaths.memoryPath);
  return entries.reverse().slice(0, limit);
}

async function loadMetrics(repoPath: string): Promise<SessionMetrics> {
  return readSessionMetrics(repoPath);
}

// ── Renderers ────────────────────────────────────────────────────────────────
const STATUS_ICON: Record<FeatureStatus, string> = {
  in_progress: "●",
  pending: "○",
  done: "✓",
  blocked: "✗",
};

const STATUS_COLOR: Record<FeatureStatus, string> = {
  in_progress: P.blue,
  pending: P.yellow,
  done: P.green,
  blocked: P.red,
};

const STATUS_ORDER: FeatureStatus[] = [
  "in_progress",
  "pending",
  "blocked",
  "done",
];

function renderFeature(f: Feature): string {
  const color = STATUS_COLOR[f.status] ?? P.subtext1;
  const icon = STATUS_ICON[f.status] ?? "?";
  const status = c(color, pad(f.status, 12));
  const name = c(P.text, f.name);
  return row(`  ${c(color, icon)}  ${status}  ${name}`);
}

function renderMem(m: MemEntry): string {
  const id = c(P.subtext0, `#${m.id}`);
  const type = c(P.teal, `[${m.type}]`);
  const title = c(P.text, m.title);
  const date = c(P.subtext0, m.timestamp.slice(0, 10));
  // right-align date
  const left = `  ${id}  ${type}  ${title}`;
  const llen = stripAnsi(left).length;
  const dlen = stripAnsi(date).length;
  const gap = Math.max(1, INNER - llen - dlen);
  return row(`${left}${" ".repeat(gap)}${date}`);
}

function emptyRow(text: string): string {
  return row(`  ${c(P.subtext0, text)}`);
}

function renderRuntimeLine(label: string, value: string, accent: string = P.text): string {
  const left = `  ${c(P.subtext1, pad(label, 14))} ${c(accent, value)}`;
  return row(left);
}

function verificationAccent(state: string): string {
  if (state === "verified") {
    return P.green;
  }
  if (state === "configured" || state === "configured_needs_activation") {
    return P.teal;
  }
  if (
    state === "stale" ||
    state === "stale_reverification_required" ||
    state === "invalid_manual_fix_required"
  ) {
    return P.yellow;
  }
  return P.subtext0;
}

function renderAlertLine(
  severity: "warn" | "error",
  message: string,
  detail?: string,
): string {
  const color = severity === "error" ? P.red : P.yellow;
  const icon = severity === "error" ? "✗" : "!";
  const suffix = detail ? ` — ${detail}` : "";
  return row(`  ${c(color, icon)} ${c(color, message)}${c(P.subtext0, suffix)}`);
}

  // ── Main ─────────────────────────────────────────────────────────────────────
export async function runTui(): Promise<void> {
  const config = await loadConfig();
  const root = config.repoPath;
  const permissionPolicy = config.permissionPolicy;

  const [features, nextSteps, inbox, memories, metrics, health] = await Promise.all([
    loadFeatures(root),
    loadNextStep(root),
    loadInbox(root),
    loadMemory(root),
    loadMetrics(root),
    evaluateHarnessHealth(root),
  ]);

  const out: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  out.push(tuiTop("harness"));
  out.push(row());

  // ── Alerts ────────────────────────────────────────────────────────────────
  out.push(sectionLabel("Alerts"));
  if (health.alerts.length === 0) {
    out.push(emptyRow("sin alertas activas"));
  } else {
    for (const alert of health.alerts.slice(0, 5)) {
      out.push(renderAlertLine(alert.severity, alert.message, alert.detail));
    }
    if (health.alerts.length > 5) {
      out.push(emptyRow(`... y ${health.alerts.length - 5} más`));
    }
  }

  out.push(row());
  out.push(sep());
  out.push(row());

  // ── Features ──────────────────────────────────────────────────────────────
  out.push(sectionLabel("Features"));
  if (features.length === 0) {
    out.push(
      emptyRow("sin features registradas — corre arufheim-harness setup"),
    );
  } else {
    const sorted = [...features].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    );
    for (const f of sorted) out.push(renderFeature(f));
  }

  out.push(row());
  out.push(sep());
  out.push(row());

  // ── Próximo paso ──────────────────────────────────────────────────────────
  out.push(sectionLabel("Próximo paso"));
  if (nextSteps.length === 0) {
    out.push(emptyRow("—"));
  } else {
    for (const step of nextSteps) out.push(row(`  ${c(P.text, step)}`));
  }

  out.push(row());
  out.push(sep());
  out.push(row());

  // ── Inbox ─────────────────────────────────────────────────────────────────
  out.push(sectionLabel("Inbox", c(P.teal, `(${inbox.length})`)));
  if (inbox.length === 0) {
    out.push(emptyRow("vacío"));
  } else {
    for (const f of inbox.slice(0, 6))
      out.push(row(`  ${c(P.teal, "·")} ${c(P.text, f)}`));
    if (inbox.length > 6) out.push(emptyRow(`... y ${inbox.length - 6} más`));
  }

  out.push(row());
  out.push(sep());
  out.push(row());

  // ── Runtime ───────────────────────────────────────────────────────────────
  out.push(sectionLabel("Runtime"));
  out.push(
    renderRuntimeLine(
      "Health",
      formatHealthBrief(health),
      health.doctor_summary.status === "ok"
        ? P.green
        : health.doctor_summary.status === "degraded"
          ? P.yellow
          : P.red,
    ),
  );
  out.push(
    renderRuntimeLine(
      "Loop",
      health.loop_summary
        ? `${health.loop_summary.phase} a${health.loop_summary.attempt_index} r${health.loop_summary.review_round} next=${health.loop_summary.next_actor}`
        : "none",
      health.loop_summary ? P.blue : P.subtext0,
    ),
  );
  out.push(
    renderRuntimeLine("Binding", health.binding_status.state, P.teal),
  );
  out.push(
    renderRuntimeLine(
      "Activation",
      formatClientReadinessBrief(health.client_readiness),
      P.teal,
    ),
  );
  for (const entry of listClientReadinessEntries(health.client_readiness)) {
    const suffix = entry.status.verified_at
      ? ` (${entry.status.verified_at.slice(0, 10)})`
      : "";
    out.push(
      renderRuntimeLine(
        getHealthClientLabel(entry.client),
        `${entry.status.state}${suffix}`,
        verificationAccent(entry.status.state),
      ),
    );
  }
  out.push(
    renderRuntimeLine(
      "Verified",
      health.last_verified_at ?? "nunca",
      health.last_verified_at ? P.subtext0 : P.yellow,
    ),
  );
  out.push(
    renderRuntimeLine(
      "Policy",
      permissionPolicy.mode,
      permissionPolicy.mode === "always_allow"
        ? P.green
        : permissionPolicy.mode === "always_ask"
          ? P.yellow
          : P.teal,
    ),
  );
  out.push(
    renderRuntimeLine(
      "Allowed",
      `tools=${permissionPolicy.allowedTools.length} risk=${permissionPolicy.allowedRisk.length}`,
      P.subtext0,
    ),
  );
  out.push(
    renderRuntimeLine(
      "Metrics",
      `tok≈${metrics.estimated_local_tokens} resp≈${metrics.response_output_tokens} tools=${metrics.tool_calls} cmd=${metrics.command_calls}`,
      P.text,
    ),
  );
  out.push(
    renderRuntimeLine(
      "Repo I/O",
      `read=${metrics.repo_reads} write=${metrics.repo_writes} mem=${metrics.memory_reads}/${metrics.memory_writes}`,
      P.subtext0,
    ),
  );

  out.push(row());
  out.push(sep());
  out.push(row());

  // ── Memoria ───────────────────────────────────────────────────────────────
  out.push(sectionLabel("Memoria", c(P.teal, `(${memories.length})`)));
  if (memories.length === 0) {
    out.push(emptyRow("sin entradas — usa mem_save para guardar decisiones"));
  } else {
    for (const m of memories) out.push(renderMem(m));
  }

  out.push(row());

  // ── Footer ────────────────────────────────────────────────────────────────
  out.push(tuiBottom());
  out.push("");

  process.stdout.write(out.join("\n") + "\n");
}
