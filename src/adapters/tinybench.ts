import { createAdapter } from "../types";
import { z } from "zod";
import { Bench } from "tinybench";
import { join } from "path";

export const tinybenchAdapter = createAdapter({
  tool: "tinybench",
  dependsOn: ["node"],
  config: z.object({
    // This is the path to the entrypoint file for the benchmark which exports all microbenchmarks
    entrypoint: z.string(),
    time: z.number().optional().default(1000),
  }),
  setup: async () => {
    return { success: true };
  },
  run: async ({ options: { entrypoint, time } }) => {
    // Dynamically import the built entrypoint file
    const { default: benchmarks } = await import(
      join(process.cwd(), entrypoint)
    );

    const bench = new Bench({ time });

    for (const benchmark of benchmarks) {
      bench.add(benchmark.name, benchmark.fn);
    }

    await bench.warmup(); // make results more reliable, ref: https://github.com/tinylibs/tinybench/pull/50
    await bench.run();

    console.log(bench.results);

    return [];
  },
});

export type TinybenchAdapter = typeof tinybenchAdapter;
