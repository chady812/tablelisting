import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * There is a stray `package-lock.json` one level up (in the home directory),
   * which makes Turbopack walk out of the project and then warn that the
   * lockfile would cover the whole home folder. Pinning the workspace root here
   * keeps module resolution and the lockfile scoped to this folder.
   */
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
