import * as vscode from 'vscode';
import { COMMANDS, STATUS_BAR } from './constants';
import { DiscordRpcManager } from './rpcManager';

let rpcManager: DiscordRpcManager | null = null;

export function activate(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.tooltip = STATUS_BAR.initialTooltip;
    statusBarItem.show();

    rpcManager = new DiscordRpcManager(context, statusBarItem);

    // Initialize Discord Rich Presence
    void rpcManager.initialize();

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.reload, () => rpcManager?.reload()),
        vscode.commands.registerCommand(COMMANDS.disconnect, () => rpcManager?.disconnect()),
        vscode.commands.registerCommand(COMMANDS.reconnect, () => rpcManager?.reconnect()),
    );
}

export async function deactivate() {
    await rpcManager?.deactivate();
    rpcManager = null;
}
