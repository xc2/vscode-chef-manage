interface WayfarerRouterCb<CArgs extends unknown[], RT> {
  (params: Record<string, string>, ...args: CArgs): RT;
}
interface WayfarerRoute<CArgs extends unknown[], RT> {
  cb: WayfarerRouterCb<CArgs, RT>;
  route: string;
  params: Record<string, string>;
}
interface WayfarerEmit<CArgs extends unknown[], RT> {
  (route: string, ...args: CArgs): RT;
  emit(route: string, ...args: CArgs): RT;
  on(route: string, cb: WayfarerRouterCb<CArgs, RT>): this;
  match(route: string): WayfarerRoute<CArgs, RT>;
  _wayfarer: true;
}
interface Wayfarer<CArgs extends unknown[] = any[], RT = unknown> {
  new (dft?: string): WayfarerEmit<CArgs, RT>;
  <CArgs extends unknown[] = any[], RT = unknown>(dft?: string): WayfarerEmit<CArgs, RT>;
}
interface TrieNode {
  nodes: Record<string, TrieNode>;
  params?: Record<string, string>;
  name?: string;
}
declare class Trie {
  trie: TrieNode;
  create(route: string): TrieNode;
  match(route: string): TrieNode | undefined;
}
declare module "wayfarer" {
  const wayfarer: Wayfarer;
  export = wayfarer;
}
declare module "wayfarer/trie" {
  export = Trie;
}
