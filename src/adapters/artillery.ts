import * as core from "@actions/core";
import { DataframeMetric, createAdapter } from "../types";
import { z } from "zod";
import { waitOn } from "../utils";

type ArtilleryHistogramData = {
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
};

export const artilleryAdapter = createAdapter({
  tool: "artillery",
  dependsOn: ["node"],
  config: z.object({
    config_path: z.string().optional().default("artillery.yaml"),
    // Host to run test against
    host: z.string(),
    // List of keys to report
    report: z.array(z.string()),
    // duet_mode: z.boolean().optional().default(false),
    depends_on: z
      .array(
        z.object({
          url: z.string(),
        })
      )
      .optional()
      .default([]),
  }),
  setup: async ({ exec }) => {
    const result = await exec("sudo npm install -g artillery@latest");

    if (!result.success) {
      return {
        success: false,
        error: "Failed to install artillery: " + result.stderr,
      };
    }

    return { success: true };
  },
  run: async ({
    exec,
    options: { config_path: configPath, depends_on: dependsOn, host, report },
  }) => {
    // If there is a package.json file, install the dependencies
    const packageJson = await exec("cat package.json");
    if (packageJson.success) {
      await exec("npm install");
    }

    if (dependsOn.length > 0) {
      core.info(`Waiting for dependencies to be ready`);
    }

    await waitOn({
      ressources: dependsOn.map((dep) => dep.url),
      // Wait for 10 minutes
      timeout: 10 * 60 * 1000,
    });

    core.info("Host " + host);

    core.info(`Running Artillery with config ${configPath}`);
    const result = await exec(
      `export host=${host} && artillery run ${configPath} --output report.json`
    );

    if (!result.success) {
      core.error("Failed to run artillery");
      return [];
    }

    // Print the last lines of the std out
    const lastLines = result.stdout.split("\n").slice(-50);
    core.info("Last 50 lines of stdout: " + lastLines.join("\n"));

    // Read the report
    const allDataRaw = await exec("cat report.json");

    if (!allDataRaw.success) {
      core.error("Failed to read report");
      return [];
    }

    const allData = JSON.parse(allDataRaw.stdout);

    // Under aggregate.summary we have the keys we want to report
    const data: Record<string, ArtilleryHistogramData> = {};
    report.forEach((key) => {
      // TODO: This is weird but needed for some reason
      const joinedKey = Object.values(
        key as unknown as Record<string, string>
      ).join("");
      if (allData.aggregate.summaries[joinedKey] === undefined) {
        core.error("Key not found in report: " + joinedKey);
        return;
      }
      data[joinedKey] = allData.aggregate.summaries[
        joinedKey
      ] as ArtilleryHistogramData;
    });

    core.info("Data: " + JSON.stringify(data, null, 2));

    // Transform the data into dataframe metrics
    return Object.entries(data).map(
      ([key, { median }]) =>
        ({
          type: "dataframe",
          metric: "latency",
          specifier: `${key} - median`,
          unit: "ms",
          value: median,
        } as DataframeMetric)
    );
  },
});

export type ArtilleryAdapter = typeof artilleryAdapter;
