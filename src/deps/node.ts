import { BenchmarkDependency } from "../types";

export const nodeDependency: BenchmarkDependency<"node"> = {
  name: "node",
  getInstallCMD: () =>
    "curl -sL https://deb.nodesource.com/setup_20.x -o setup.sh && sudo bash setup.sh && sudo apt-get install -y nodejs",
  getCheckIfInstalledCMD: () => "node -v",
};
