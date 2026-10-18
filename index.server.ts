import type { PluginServerContext } from "@getpaseo/plugin/server";
import { loadCommitFiles, loadCommitPatch, loadGraphPage } from "./server/git-graph";
import { commitFilesRpc, commitPatchRpc, graphPageRpc } from "./shared/git-graph";

export default function contribute(server: PluginServerContext) {
  server.handle(graphPageRpc, loadGraphPage);
  server.handle(commitFilesRpc, ({ directory, hash }) => loadCommitFiles(directory, hash));
  server.handle(commitPatchRpc, ({ directory, hash, path, oldPath }) =>
    loadCommitPatch(directory, hash, path, oldPath),
  );
  return () => {};
}
