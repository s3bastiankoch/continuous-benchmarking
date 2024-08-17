import { readFile } from "fs/promises";
import { loadPyodide } from "pyodide";
import { Metric } from "../types";

/**
 * The user can provide an analysis script that will be run on the benchmark result data.
 * The script should contain a function called `main` that takes the benchmark result data as input.
 * The script should returns a list of metrics to be displayed in EMPIRIS UI.
 */
export async function runScript({
  path,
  downloadedDataContents,
  metrics,
}: {
  path: string;
  downloadedDataContents: Record<string, string>;
  metrics: Metric[];
}) {
  // Read python script from path
  const script = await readFile(path, "utf-8");

  const pyodide = await loadPyodide();

  const result = await pyodide.runPythonAsync(`
${script}

main(3)`);

  // Turn pyproxy object into a JS object
  const map = result.toJs();

  // Validate the result against metric schema

  // Return the result
  return map;
}
