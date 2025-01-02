import * as path from "path";
import * as vscode from "vscode";
import Trie from "wayfarer/trie";
import { TempClient } from "./temp-client";
const trie = new Trie();
trie.create("/organizations/:org/nodes/:nodeName");

export class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  data?: Uint8Array;

  constructor(name: string) {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}

export class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;

  constructor(name: string) {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}

export type Entry = File | Directory;

export class ChefApiFsProvider implements vscode.FileSystemProvider {
  private client = new TempClient();

  // --- manage file metadata

  stat(uri: vscode.Uri): PromiseLike<vscode.FileStat> {
    console.log("stat", uri.path);
    return this._lookup(uri, false);
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    console.log("readDirectory");
    const entry = this._lookupAsDirectory(uri, false);
    const result: [string, vscode.FileType][] = [];
    for (const [name, child] of entry.entries) {
      result.push([name, child.type]);
    }
    return result;
  }

  // --- manage file contents

  readFile(uri: vscode.Uri): Uint8Array {
    console.log("readFile");
    const data = this._lookupAsFile(uri, false).data;
    if (data) {
      return data;
    }
    throw vscode.FileSystemError.FileNotFound();
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

  private async _lookup(uri: vscode.Uri, silent: false): Promise<Entry>;
  private async _lookup(uri: vscode.Uri, silent: boolean): Promise<Entry | undefined>;
  private async _lookup(uri: vscode.Uri, silent: boolean): Promise<Entry | undefined> {
    const m = trie.match(uri.path);
    if (!m) {
      if (silent) {
        return undefined;
      } else {
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    }
    const { nodes } = m;
    const basename = path.basename(uri.path);
    if (Object.keys(nodes).length === 0) {
      return new File(basename);
    } else {
      return new Directory(basename);
    }
  }

  private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw vscode.FileSystemError.FileNotADirectory(uri);
  }

  private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw vscode.FileSystemError.FileIsADirectory(uri);
  }

  private _lookupParentDirectory(uri: vscode.Uri): Directory {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    return this._lookupAsDirectory(dirname, false);
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
