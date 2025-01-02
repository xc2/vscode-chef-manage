import * as vscode from "vscode";
import { ChefApiFsProvider } from "./chef-api-fs-provider";
import { TmpConfig } from "./tmp";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider("chef", new ChefApiFsProvider(), {
      isCaseSensitive: true,
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("chef-manage.helloWorld", () => {
      vscode.workspace.updateWorkspaceFolders(0, 0, {
        uri: vscode.Uri.parse(
          new URL(`/organizations/${TmpConfig.org}`, "chef://example.com").href
        ),
        name: TmpConfig.org,
      });
    })
  );
}

export function deactivate() {
  console.log("chef manage deactivated");
}
