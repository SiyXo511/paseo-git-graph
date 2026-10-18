import type { PluginClientContext } from "@getpaseo/plugin/client";
import { GitGraphPanel } from "./client/git-graph-panel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "git-graph",
    title: "Git Graph",
    icon: "GitBranch",
    context: "workspace",
    locations: ["workspace", "explorer"],
    Component: GitGraphPanel,
  });
  return () => {};
}
