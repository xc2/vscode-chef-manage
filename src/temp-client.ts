import { readFileSync } from "node:fs";
import { importKey, sign } from "barhop/sign.js";
import { TmpConfig } from "./tmp";

export class TempClient {
  private key = importKey(readFileSync(TmpConfig.key, "utf8"));
  async get(path: string, { plain = false }: { plain?: boolean } = {}) {
    const url = new URL(path, TmpConfig.server).toString();
    const method = "GET";
    console.log("GET", url);

    const signedHeaders = await sign(this.key, {
      method,
      path: url,
      userId: TmpConfig.nodeName,
    });
    const headers: Record<string, string> = {
      ...signedHeaders,
      "content-type": "application/json",
      accept: "application/json",
      "X-Chef-Version": "18.6.2",
    };
    if (plain) {
      delete headers.accept;
    }
    console.log(headers);

    const res = await fetch(url, { method, headers });
    console.log(res.status, res.statusText, res.url);
    return res;
  }
}
