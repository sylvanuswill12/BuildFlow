export type ProjectTreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  children: ProjectTreeNode[];
};

export function buildProjectFileTree(files: Record<string, string>): ProjectTreeNode[] {
  const root: ProjectTreeNode[] = [];
  const folders = new Map<string, ProjectTreeNode>();
  for (const rawPath of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
    const parts = rawPath.replace(/^\.\//, "").split("/").filter(Boolean);
    if (!parts.length || parts.some(part => part === "." || part === "..")) continue;
    let children = root;
    let parentPath = "";
    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index]!;
      const path = parentPath ? `${parentPath}/${name}` : name;
      const isFile = index === parts.length - 1;
      let node = children.find(candidate => candidate.name === name);
      if (!node) {
        node = { name, path, kind: isFile ? "file" : "folder", children: [] };
        children.push(node);
        if (!isFile) folders.set(path, node);
      }
      if (!isFile) {
        children = node.children;
        parentPath = path;
      }
    }
  }
  const sort = (nodes: ProjectTreeNode[]) => {
    nodes.sort((a, b) => Number(b.kind === "folder") - Number(a.kind === "folder") || a.name.localeCompare(b.name));
    nodes.forEach(node => sort(node.children));
  };
  sort(root);
  return root;
}
