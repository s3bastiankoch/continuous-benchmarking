import * as core from "@actions/core";
import { Config, getConfig } from "./config";
import { adapters, Adapter } from "./adapters";
import {
  createStartupScript,
  destroyComputeInstance,
  setupComputeInstance,
} from "./platform/gcp";
import { BenchmarkMetadata, Metric } from "./types";
import { stat, writeFile, mkdir, readFile } from "fs/promises";
import { NodeSSH } from "node-ssh";
import { isExecSuccess, waitOn } from "./utils";
import { getExecOutput } from "@actions/exec";
import { createExperimentRun, writeMetrics } from "./write-results";
import { randomUUID } from "crypto";
import { SSH_USER_NAME } from "./platform/constants";
import { join } from "path";
import { artifactClient } from "./artifacts";
import { glob } from "glob";
import { runScript } from "./analysis/run-script";

const ssh = new NodeSSH();

function getAdapter<T extends Config["benchmark"]["tool"]>(tool: T) {
  const adapter = adapters.find((adapter) => adapter.tool === tool);

  if (!adapter) {
    throw new Error(`Adapter ${tool} not found`);
  }

  return adapter as Adapter<T>;
}

async function localExec(cmd: string) {
  try {
    const { exitCode, stderr, stdout } = await getExecOutput(cmd, [], {
      silent: true,
      // Set output to nothing
      outStream: undefined,
    });

    if (isExecSuccess(exitCode)) {
      return {
        success: true,
        stdout: stdout,
      } as const;
    }

    return {
      success: false,
      stderr: stderr,
    } as const;
  } catch (e) {}

  return {
    success: false,
    stderr: "Failed to execute command",
  } as const;
}

function wrapRemoteExec(
  ssh: NodeSSH,
  {
    host,
    username,
    privateKey,
  }: { host: string; username: string; privateKey: string }
) {
  return async (cmd: string) => {
    await ssh.connect({
      host,
      username,
      privateKey,
    });
    const { code, stderr, stdout } = await ssh.execCommand(cmd);

    if (code !== null && isExecSuccess(code)) {
      return {
        success: true,
        stdout,
      } as const;
    }

    core.error(`Failed to execute command on remote host: ${stderr}`);

    return {
      success: false,
      stderr,
    } as const;
  };
}

async function copyFileToRemote(
  ssh: NodeSSH,
  {
    host,
    username,
    privateKey,
    localPath,
    remotePath,
  }: {
    host: string;
    username: string;
    privateKey: string;
    localPath: string;
    remotePath: string;
  }
) {
  await ssh.connect({
    host,
    username,
    privateKey,
  });

  const joinedLocalPath = join(process.cwd(), localPath);

  // Check if the local path is a directory or a file
  const stats = await stat(joinedLocalPath);
  core.info(
    `Copying ${joinedLocalPath} to ${remotePath} as ${
      stats.isDirectory() ? "directory" : "file"
    }`
  );

  if (stats.isDirectory()) {
    const success = await ssh.putDirectory(joinedLocalPath, remotePath);

    if (!success) {
      core.error(
        `Failed to copy directory ${joinedLocalPath} to ${remotePath}`
      );
    }
  } else if (stats.isFile()) {
    await ssh.putFile(joinedLocalPath, remotePath);
  }
}

async function downloadFileFromRemote(
  ssh: NodeSSH,
  {
    host,
    username,
    privateKey,
    localPath,
    remotePath,
  }: {
    host: string;
    username: string;
    privateKey: string;
    localPath: string;
    remotePath: string;
  }
) {
  await ssh.connect({
    host,
    username,
    privateKey,
  });

  const joinedLocalPath = join(process.cwd(), localPath);

  // Check if the remote path is a directory or a file
  const isDirectory =
    (
      await ssh.execCommand(`[ -d ${remotePath} ] && echo "yes" || echo "no"`)
    ).stdout.trim() === "yes";

  core.info(
    `Downloading ${remotePath} to ${joinedLocalPath} as ${
      isDirectory ? "directory" : "file"
    }`
  );

  if (isDirectory) {
    // Make sure the local directory exists
    await mkdir(joinedLocalPath, { recursive: true });

    const success = await ssh.getDirectory(joinedLocalPath, remotePath, {
      recursive: true,
    });

    if (!success) {
      core.error(
        `Failed to download directory ${remotePath} to ${joinedLocalPath}`
      );
    }
  } else {
    await ssh.getFile(joinedLocalPath, remotePath);
  }
}

async function main() {
  const {
    name,
    description,
    application,
    benchmark: { tool, ...rest },
    platform,
    github_token,
    visualization,
    save_artifacts,
    analysis,
  } = await getConfig();

  // Get the adapter
  const adapter = getAdapter(tool);

  const runId = randomUUID();

  let metadata: BenchmarkMetadata = {};

  /*
   * The platform exeuction is not particularly elegant yet and could be improved
   * but for now it's good enough since we only support GCP VMs. In the future
   * we might want to support other platforms like AWS Lambdas or distributed
   * VMs for e.g. distributed loadtesting.
   */
  if (platform.on === "gcp-vm") {
    try {
      // NOTE: Here it could make sense to search for all empiris prefixed resources and delete them

      metadata = await setupComputeInstance({
        project: platform.project,
        serviceAccount: platform.auth.service_account,
        sshKey: platform.auth.ssh.public_key,
        zone: platform.instance.zone,
        machineType: platform.instance.machine_type,
        region: platform.region,
        runId,
        startupScript: createStartupScript(adapter.dependsOn || []),
      });
    } catch (e) {
      console.error("Failed to setup compute instance", e);
    }
  }

  metadata = {
    ...metadata,
    runConfig: platform,
    githubToken: github_token,
  };

  let metrics: Metric[] = [];
  const downloadedDataContents: Record<string, string> = {};

  // Setup the Benchmark Client
  try {
    if (metadata.ip && metadata.runConfig?.on === "gcp-vm") {
      const { ip, runConfig } = metadata;

      core.info(`Waiting for ${ip} to be ready...`);
      // Wait for ip to be ready
      await waitOn({
        ressources: [`http://${ip}`],
      });

      if (runConfig.instance.copy.length > 0) {
        core.info(`Copying files to ${ip}...`);
      }

      for (const path of runConfig.instance.copy) {
        await copyFileToRemote(ssh, {
          host: ip,
          username: SSH_USER_NAME,
          privateKey: runConfig.auth.ssh.private_key,
          localPath: path.local,
          remotePath: path.remote,
        });
      }

      const remoteExec = wrapRemoteExec(ssh, {
        host: ip,
        username: SSH_USER_NAME,
        privateKey: runConfig.auth.ssh.private_key,
      });

      const result = await adapter.setup({
        isLocal: false,
        options: rest,
        metadata,
        exec: remoteExec,
      });

      if (!result.success) {
        throw new Error("Failed to setup benchmark client: " + result.error);
      }

      // Run the Benchmark
      // We assume here that the SUT is already running and available, we don't do the setup here
      metrics = await adapter.run({
        isLocal: false,
        options: rest,
        metadata,
        exec: remoteExec,
      });

      if (runConfig.instance.download.length > 0) {
        core.info(`Downloading files from ${ip}...`);
      }

      for (const path of runConfig.instance.download) {
        await downloadFileFromRemote(ssh, {
          host: ip,
          username: SSH_USER_NAME,
          privateKey: runConfig.auth.ssh.private_key,
          localPath: path.local,
          remotePath: path.remote,
        });

        downloadedDataContents[path.local] = await readFile(
          path.local,
          "utf-8"
        );
      }

      // Teardown the Benchmark Client
      await adapter.teardown?.({
        options: rest,
        metadata,
        exec: remoteExec,
        isLocal: false,
      });
    } else {
      const result = await adapter.setup({
        isLocal: true,
        options: rest,
        metadata,
        exec: localExec,
      });

      if (!result.success) {
        throw new Error("Failed to setup benchmark client: " + result.error);
      }

      // Run the Benchmark
      // We assume here that the SUT is already running and available, we don't do the setup here
      metrics = await adapter.run({
        isLocal: true,
        options: rest,
        metadata,
        exec: localExec,
      });

      // Teardown the Benchmark Client
      await adapter.teardown?.({
        options: rest,
        metadata,
        exec: localExec,
        isLocal: true,
      });
    }
  } catch (e) {
    core.error("Failed to run benchmark: " + e);
  }

  if (platform.on === "gcp-vm") {
    try {
      await destroyComputeInstance({
        project: platform.project,
        serviceAccount: platform.auth.service_account,
        zone: platform.instance.zone,
        region: platform.region,
        runId,
        isCleanUp: false,
      });
    } catch (e) {
      console.error("Failed to destroy compute instance", e);
    }
  }

  // Perform analysis
  if (analysis.length > 0) {
    core.info("Running analysis scripts..");

    for (const { script } of analysis) {
      const result = await runScript({
        path: script,
        downloadedDataContents,
        metrics,
      });

      metrics = metrics.concat(result);
    }
  }

  const report = JSON.stringify(
    {
      metrics,
    },
    null,
    2
  );

  // Save artificats
  for (const artifact of save_artifacts) {
    // Get all files in the current directory
    const allFiles = await glob("*");
    core.info(`All files in the current directory: ${allFiles.join(", ")}`);

    const files = await glob(artifact.path);

    core.info(
      `Uploading artifact ${artifact.name} with files ${files.join(", ")}`
    );

    // TODO: Error handling
    await artifactClient.uploadArtifact(
      artifact.name,
      files,
      process.cwd(),
      // TODO: Include options
      {}
    );
  }

  // Send the report to the server
  if (metrics.length === 0) {
    core.warning("No metrics were collected");
  } else {
    core.info("Writing report to report.json");

    // For local analysis
    await writeFile("report.json", report);

    if (visualization?.api_key) {
      const { api_base_url, api_key } = visualization;
      const id = await createExperimentRun({
        apiKey: api_key,
        basePath: api_base_url,
        metadata: {
          name,
          description,
          appName: application,
          commit: process.env.GITHUB_SHA || "unknown",
        },
      });

      core.info("Experiment run id: " + id);

      core.info("Writing metrics to Empiris API..");

      // Write the results to the Empiris API
      await writeMetrics(metrics, {
        basePath: api_base_url,
        experimentRunId: id,
        apiKey: api_key,
      });

      console.log(
        `You can view the results at ${api_base_url}/experiments/${id}`
      );
    } else {
      core.info("No API key provided, skipping writing results to api");
    }
  }

  core.info("Benchmark finished");
}

main()
  .catch((e) => core.setFailed(e.message))
  .then(() => process.exit(0));
