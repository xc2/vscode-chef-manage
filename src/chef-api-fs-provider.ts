import * as path from "path";
import * as vscode from "vscode";
import Trie from "wayfarer/trie";
import { TempClient } from "./temp-client";
const trie = new Trie();
// todo use openapi spec
interface RestTrieNode extends TrieNode {
  metadata?: {
    plain: boolean;
  };
}
function createNode(route: string, metadata?: Partial<RestTrieNode["metadata"]>): RestTrieNode {
  const node = trie.create(route) as RestTrieNode;
  node.metadata = { plain: false, ...metadata };
  return node;
}
createNode("/organizations/:org");
createNode("/organizations/:org/clients");
createNode("/organizations/:org/clients/:client");
createNode("/organizations/:org/clients/:client/keys");
createNode("/organizations/:org/clients/:client/keys/:key");
createNode("/organizations/:org/containers");
createNode("/organizations/:org/containers/:container");
createNode("/organizations/:org/cookbook_artifacts");
createNode("/organizations/:org/cookbook_artifacts/:cookbook_artifact");
createNode("/organizations/:org/cookbook_artifacts/:cookbook_artifact/:id");
createNode("/organizations/:org/cookbooks");
createNode("/organizations/:org/cookbooks/_latest");
createNode("/organizations/:org/cookbooks/_recipes");
createNode("/organizations/:org/cookbooks/:cookbook");
createNode("/organizations/:org/cookbooks/:cookbook/version");
createNode("/organizations/:org/data");
createNode("/organizations/:org/data/:data");
createNode("/organizations/:org/data/:data/:item");
createNode("/organizations/:org/environments");
createNode("/organizations/:org/environments/_default");
createNode("/organizations/:org/environments/:environment");
createNode("/organizations/:org/environments/:environment/cookbooks");
createNode("/organizations/:org/environments/:environment/cookbooks/:cookbook");
createNode("/organizations/:org/environments/:environment/cookbooks_versions");
createNode("/organizations/:org/environments/:environment/nodes");
createNode("/organizations/:org/environments/:environment/recipes");
createNode("/organizations/:org/environments/:environment/roles/:role");
createNode("/organizations/:org/groups");
createNode("/organizations/:org/groups/:group");
createNode("/organizations/:org/nodes");
createNode("/organizations/:org/nodes/:node");
createNode("/organizations/:org/policies");
createNode("/organizations/:org/policy_groups");
createNode("/organizations/:org/policy_groups/:policy_group");
createNode("/organizations/:org/policies/:policy");
createNode("/organizations/:org/required_recipe", { plain: true });
createNode("/organizations/:org/roles");
createNode("/organizations/:org/roles/:role");
createNode("/organizations/:org/roles/:role/environments");
createNode("/organizations/:org/roles/:role/environments/:environment");
createNode("/organizations/:org/sandboxes");
createNode("/organizations/:org/sandboxes/:sandbox");
createNode("/organizations/:org/universe");
createNode("/organizations/:org/users");
createNode("/organizations/:org/users/:user");
interface Route extends RestTrieNode {
  path: string;
}
function getNode(path: string): Route | undefined {
  const n = trie.match(path) as Route;
  if (!n) {
    return n;
  }
  n.path = path;
  return n;
}

export class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  permissions?: vscode.FilePermission;

  constructor() {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
  }
}

export class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  permissions?: vscode.FilePermission;

  constructor() {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
  }
}

export type Entry = File | Directory;

export class ChefApiFsProvider implements vscode.FileSystemProvider {
  private client = new TempClient();

  // --- manage file metadata

  stat(uri: vscode.Uri): vscode.FileStat {
    const basename = path.basename(uri.path);
    // todo from node
    const root = basename.startsWith(".root");
    const s = this._lookup(uri, false);
    // todo: fetch metadata from server
    if (!root && Object.keys(s.nodes).length > 0) {
      const entry = new Directory();
      entry.permissions = s.nodes.$$ ? undefined : vscode.FilePermission.Readonly;
      return entry;
    } else {
      const entry = new File();
      entry.permissions = root ? vscode.FilePermission.Readonly : undefined;
      return entry;
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    console.log("readDirectory", uri.path);

    const node = this._lookupAsDirectory(uri);

    const result: [string, vscode.FileType][] = [[".root.json", vscode.FileType.File]];
    for (const [name, child] of Object.entries(node.nodes)) {
      if (name === "$$") {
        // todo read children
        const res = await this.client.get(node.path);
        console.log("readChildren", uri.path, res.status, res.url);
        if (res.status === 200) {
          const r = (await res.json()) as
            | Record<string, string>
            | Record<string, { uri: string; [key: string]: any }>
            | { uri: string; name: string; [key: string]: any }[];
          let rr: { uri: string; name: string; [key: string]: any }[] = [];
          if (Array.isArray(r)) {
            rr = r;
          } else {
            rr = Object.entries(r).map(([name, v]) => {
              if (typeof v === "string") {
                return { uri: v, name };
              }
              return { uri: v.uri, name, ...v };
            });
          }
          for (const n of rr) {
            try {
              console.log(uri.with({ path: uri.path + "/" + n.name }));
              const c = this.stat(uri.with({ path: uri.path + "/" + n.name }));
              result.push([n.name, c.type]);
            } catch {}
          }
        }
        continue;
      }
      if (Object.keys(child.nodes).length > 0) {
        result.push([name, vscode.FileType.Directory]);
      } else {
        result.push([name, vscode.FileType.File]);
      }
    }
    console.log("readDirectory", uri.path, Object.fromEntries(result));
    return result;
  }

  // --- manage file contents

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const node = this._lookupAsFile(uri);
    const res = await this.client.get(node.path, { plain: node.metadata?.plain });
    console.log("readFile", uri.path, res.status, res.url);
    if (res.status === 404) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (res.status === 403) {
      throw vscode.FileSystemError.NoPermissions(uri);
    }
    if (res.status === 401) {
      throw vscode.FileSystemError.NoPermissions(uri);
    }
    if (res.status > 499) {
      throw vscode.FileSystemError.Unavailable(uri);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    try {
      const r = JSON.parse(new TextDecoder().decode(buf));
      console.log("read file success", r);
      return new TextEncoder().encode(JSON.stringify(r, null, 2));
    } catch {}
    return buf;
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    // const basename = path.posix.basename(uri.path);
    // const parent = this._lookupParentDirectory(uri);
    // let entry = parent.entries.get(basename);
    // if (entry instanceof Directory) {
    //   throw vscode.FileSystemError.FileIsADirectory(uri);
    // }
    // if (!entry && !options.create) {
    //   throw vscode.FileSystemError.FileNotFound(uri);
    // }
    // if (entry && options.create && !options.overwrite) {
    //   throw vscode.FileSystemError.FileExists(uri);
    // }
    // if (!entry) {
    //   entry = new File(basename);
    //   parent.entries.set(basename, entry);
    //   this._fireSoon({ type: vscode.FileChangeType.Created, uri });
    // }
    // entry.mtime = Date.now();
    // entry.size = content.byteLength;
    // entry.data = content;
    //
    // this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
  }

  // --- manage files/folders

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    // if (!options.overwrite && this._lookup(newUri, true)) {
    //   throw vscode.FileSystemError.FileExists(newUri);
    // }
    //
    // const entry = this._lookup(oldUri, false);
    // const oldParent = this._lookupParentDirectory(oldUri);
    //
    // const newParent = this._lookupParentDirectory(newUri);
    // const newName = path.posix.basename(newUri.path);
    //
    // oldParent.entries.delete(entry.name);
    // entry.name = newName;
    // newParent.entries.set(newName, entry);
    //
    // this._fireSoon(
    //   { type: vscode.FileChangeType.Deleted, uri: oldUri },
    //   { type: vscode.FileChangeType.Created, uri: newUri }
    // );
  }

  delete(uri: vscode.Uri): void {
    // const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    // const basename = path.posix.basename(uri.path);
    // const parent = this._lookupAsDirectory(dirname, false);
    // if (!parent.entries.has(basename)) {
    //   throw vscode.FileSystemError.FileNotFound(uri);
    // }
    // parent.entries.delete(basename);
    // parent.mtime = Date.now();
    // parent.size -= 1;
    // this._fireSoon(
    //   { type: vscode.FileChangeType.Changed, uri: dirname },
    //   { uri, type: vscode.FileChangeType.Deleted }
    // );
  }

  createDirectory(uri: vscode.Uri): void {
    // const basename = path.posix.basename(uri.path);
    // const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    // const parent = this._lookupAsDirectory(dirname, false);
    //
    // const entry = new Directory(basename);
    // parent.entries.set(entry.name, entry);
    // parent.mtime = Date.now();
    // parent.size += 0;
    // this._fireSoon(
    //   { type: vscode.FileChangeType.Changed, uri: dirname },
    //   { type: vscode.FileChangeType.Created, uri }
    // );
  }

  // --- lookup

  private _lookup(uri: vscode.Uri, silent: false): Route;
  private _lookup(uri: vscode.Uri, silent: boolean): Route;
  private _lookup(uri: vscode.Uri, silent: boolean): Route | undefined {
    const basename = path.basename(uri.path);
    const isRoot = basename.startsWith(".root");
    const parent = getNode(path.dirname(uri.path));
    const m = isRoot ? parent : getNode(uri.path);
    if (!m) {
      if (silent) {
        return undefined;
      } else {
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    }
    return m;
  }

  private _lookupAsDirectory(uri: vscode.Uri): Route {
    const m = this._lookup(uri, false);
    if (Object.keys(m.nodes).length === 0) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return m;
  }

  private _lookupAsFile(uri: vscode.Uri): Route {
    return this._lookup(uri, false);
  }

  // --- manage file events

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timeout;

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  watch(_resource: vscode.Uri): vscode.Disposable {
    // ignore, fires for all changes...
    return new vscode.Disposable(() => {});
  }

  private _fireSoon(...events: vscode.FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}
