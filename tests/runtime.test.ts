import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getGlobalHarnessRoot,
} from "../src/config.js";
import {
  ensureManagedGlobalRuntime,
  evaluateManagedGlobalRuntimeStatus,
  getManagedGlobalRuntimeArtifactPath,
  getManagedGlobalRuntimeMetadataPath,
  getManagedGlobalRuntimeShimPath,
  getRepoRuntimeLauncherSource,
  readManagedGlobalRuntimeMetadata,
} from "../src/runtime.js";
import { HARNESS_VERSION } from "../src/version.js";

async function seedHarnessPackage(
  packageRoot: string,
  options: {
    bundleText?: string;
    entrypointText?: string;
  } = {},
) {
  const distDir = path.join(packageRoot, "dist");
  await mkdir(distDir, { recursive: true });
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ name: "arufheim-harness", version: HARNESS_VERSION }) + "\n",
    "utf8",
  );
  await writeFile(
    path.join(distDir, "index.js"),
    options.entrypointText ?? "export {};\n",
    "utf8",
  );
  await writeFile(
    path.join(distDir, "runtime-bundle.cjs"),
    options.bundleText ?? 'console.log("bundle");\n',
    "utf8",
  );
  return distDir;
}

describe("managed runtime", () => {
  it("classifies a local workspace runtime as workspace_dev", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-workspace-"));
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-home-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: xdgHome,
    };

    try {
      const distDir = await seedHarnessPackage(workspaceRoot, {
        bundleText: 'console.log("workspace bundle");\n',
      });
      const install = await ensureManagedGlobalRuntime({
        env,
        sourceDistDir: distDir,
        installedAt: "2026-06-23T14:00:00.000Z",
      });
      const metadata = await readManagedGlobalRuntimeMetadata(env);
      const status = await evaluateManagedGlobalRuntimeStatus({
        env,
        verifiedAt: "2026-06-23T14:00:01.000Z",
      });

      expect(install.seedEntrypointPath).toBe(path.join(distDir, "index.js"));
      expect(install.runtimeArtifact.kind).toBe("global_bundle");
      expect(install.artifactPath).toBe(getManagedGlobalRuntimeArtifactPath(env));
      expect(metadata?.version).toBe(2);
      expect(metadata && "artifact_path" in metadata ? metadata.artifact_path : null).toBe(
        getManagedGlobalRuntimeArtifactPath(env),
      );
      expect(metadata?.shim_path).toBe(getManagedGlobalRuntimeShimPath(env));
      expect(status.state).toBe("ok");
      expect(status.runtime_artifact.kind).toBe("global_bundle");
      expect(status.runtime_source.kind).toBe("workspace_dev");
      expect(status.runtime_source.package_root).toBe(workspaceRoot);
      expect(status.detail).toBe(getManagedGlobalRuntimeArtifactPath(env));
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(xdgHome, { recursive: true, force: true });
    }
  });

  it("classifies a node_modules install as package_install", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-pkg-"));
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-pkg-home-"));
    const packageRoot = path.join(tempRoot, "node_modules", "arufheim-harness");
    const distDir = path.join(packageRoot, "dist");
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: xdgHome,
    };

    try {
      await seedHarnessPackage(packageRoot, {
        bundleText: 'console.log("pkg bundle");\n',
      });

      const status = await evaluateManagedGlobalRuntimeStatus({
        env,
        verifiedAt: "2026-06-23T14:00:01.000Z",
      });
      expect(status.state).toBe("missing");

      const install = await ensureManagedGlobalRuntime({
        env,
        sourceDistDir: distDir,
        installedAt: "2026-06-23T14:00:00.000Z",
      });

      expect(install.runtimeSource.kind).toBe("package_install");
      expect(install.runtimeArtifact.kind).toBe("global_bundle");

      const runtimeStatus = await evaluateManagedGlobalRuntimeStatus({
        env,
        verifiedAt: "2026-06-23T14:00:02.000Z",
      });
      expect(runtimeStatus.state).toBe("ok");
      expect(runtimeStatus.runtime_artifact.kind).toBe("global_bundle");
      expect(runtimeStatus.runtime_source.kind).toBe("package_install");
      expect(runtimeStatus.runtime_source.package_root).toBe(packageRoot);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(xdgHome, { recursive: true, force: true });
    }
  });

  it("classifies a symlinked node_modules install as linked_dev", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-link-"));
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-link-home-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const packageRoot = path.join(tempRoot, "node_modules", "arufheim-harness");
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: xdgHome,
    };

    try {
      await mkdir(path.dirname(packageRoot), { recursive: true });
      await seedHarnessPackage(workspaceRoot, {
        bundleText: 'console.log("link bundle");\n',
      });
      await symlink(workspaceRoot, packageRoot, "dir");

      const install = await ensureManagedGlobalRuntime({
        env,
        sourceDistDir: path.join(packageRoot, "dist"),
        installedAt: "2026-06-23T14:00:00.000Z",
      });

      expect(install.runtimeSource.kind).toBe("linked_dev");
      expect(install.runtimeArtifact.kind).toBe("global_bundle");

      const runtimeStatus = await evaluateManagedGlobalRuntimeStatus({
        env,
        verifiedAt: "2026-06-23T14:00:02.000Z",
      });
      expect(runtimeStatus.state).toBe("ok");
      expect(runtimeStatus.runtime_artifact.kind).toBe("global_bundle");
      expect(runtimeStatus.runtime_source.kind).toBe("linked_dev");
      expect(runtimeStatus.runtime_source.package_root).toBe(packageRoot);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(xdgHome, { recursive: true, force: true });
    }
  });

  it("flags a legacy copied runtime entrypoint as stale", async () => {
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-legacy-"));
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: xdgHome,
    };

    try {
      const globalRoot = getGlobalHarnessRoot(env);
      const shimPath = getManagedGlobalRuntimeShimPath(env);
      const metadataPath = getManagedGlobalRuntimeMetadataPath(env);
      const legacyEntrypoint = path.join(globalRoot, "runtime", "dist", "index.js");

      await mkdir(path.dirname(shimPath), { recursive: true });
      await mkdir(path.dirname(legacyEntrypoint), { recursive: true });
      await writeFile(shimPath, "#!/usr/bin/env bash\n", "utf8");
      await writeFile(legacyEntrypoint, "export {};\n", "utf8");
      await writeFile(
        metadataPath,
        JSON.stringify(
          {
            version: 1,
            package_version: HARNESS_VERSION,
            process_exec_path: process.execPath,
            entrypoint: legacyEntrypoint,
            installed_at: "2026-06-23T14:00:00.000Z",
            global_root: globalRoot,
            shim_path: shimPath,
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const status = await evaluateManagedGlobalRuntimeStatus({
        env,
        verifiedAt: "2026-06-23T14:00:01.000Z",
      });
      expect(status.state).toBe("stale");
      expect(status.runtime_artifact.kind).toBe("legacy_entrypoint");
      expect(status.detail).toContain("dist copiado legacy");
    } finally {
      await rm(xdgHome, { recursive: true, force: true });
    }
  });

  it("keeps a package_install seed visible after the source package disappears", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-detached-"));
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-detached-home-"));
    const packageRoot = path.join(tempRoot, "node_modules", "arufheim-harness");
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: xdgHome,
    };

    try {
      const distDir = await seedHarnessPackage(packageRoot, {
        bundleText: 'console.log("detached bundle");\n',
      });

      await ensureManagedGlobalRuntime({
        env,
        sourceDistDir: distDir,
        installedAt: "2026-06-23T14:00:00.000Z",
      });

      await rm(packageRoot, { recursive: true, force: true });

      const runtimeStatus = await evaluateManagedGlobalRuntimeStatus({
        env,
        verifiedAt: "2026-06-23T14:00:02.000Z",
      });
      expect(runtimeStatus.state).toBe("ok");
      expect(runtimeStatus.runtime_artifact.kind).toBe("global_bundle");
      expect(runtimeStatus.runtime_source.kind).toBe("package_install");
      expect(await readFile(runtimeStatus.runtime_artifact.path, "utf8")).toContain(
        "detached bundle",
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(xdgHome, { recursive: true, force: true });
    }
  });

  it("builds the workspace fallback bundle without duplicating the shebang", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-fallback-"));
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-runtime-fallback-home-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const distDir = path.join(workspaceRoot, "dist");
    const env = {
      ...process.env,
      XDG_CONFIG_HOME: xdgHome,
    };

    try {
      await mkdir(distDir, { recursive: true });
      await writeFile(
        path.join(workspaceRoot, "package.json"),
        JSON.stringify({ name: "arufheim-harness", version: HARNESS_VERSION }) + "\n",
        "utf8",
      );
      await writeFile(
        path.join(distDir, "index.js"),
        '#!/usr/bin/env node\nconsole.log("fallback runtime");\n',
        "utf8",
      );

      const install = await ensureManagedGlobalRuntime({
        env,
        sourceDistDir: distDir,
        sourceBundlePath: path.join(distDir, "missing-runtime-bundle.cjs"),
        installedAt: "2026-06-23T14:00:00.000Z",
      });

      const artifactText = await readFile(install.artifactPath, "utf8");
      expect(artifactText.startsWith("#!/usr/bin/env node\n#!/usr/bin/env node")).toBe(
        false,
      );
      expect(artifactText.startsWith("#!/usr/bin/env node")).toBe(true);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
      await rm(xdgHome, { recursive: true, force: true });
    }
  });

  it("renders launcher source with os.homedir fallback instead of HOME/cwd", () => {
    const source = getRepoRuntimeLauncherSource();
    expect(source).toContain('os.homedir()');
    expect(source).not.toContain('process.env.HOME ?? process.cwd()');
    expect(source).toContain('artifact_path');
  });
});
