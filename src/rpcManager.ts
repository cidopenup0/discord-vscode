import * as vscode from 'vscode';
import { Client } from '@xhayper/discord-rpc';
import {
    clientId,
    COMMANDS,
    fileExtensionToLanguageId,
    fileTypeImages,
    PRESENCE,
    RPC_TIMINGS,
    STATUS_BAR,
    UI_MESSAGES,
} from './constants';

export class DiscordRpcManager {
    private rpc: Client | null = null;
    private startTimestamp = Date.now();
    private isConnected = false;
    private activityInterval: NodeJS.Timeout | null = null;
    private connectionTimeout: NodeJS.Timeout | null = null;
    private readonly rpcDisposables: vscode.Disposable[] = [];
    private reconnectInProgress = false;
    private hasTriedConnection = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly statusBarItem: vscode.StatusBarItem,
    ) {}

    async initialize() {
        if (this.reconnectInProgress) {
            return;
        }

        this.reconnectInProgress = true;
        this.statusBarItem.text = STATUS_BAR.connectingText;
        this.statusBarItem.tooltip = STATUS_BAR.connectingTooltip;
        this.statusBarItem.command = undefined;

        await this.deactivate();

        this.rpc = new Client({
            clientId,
            transport: {
                type: 'ipc',
            },
        });

        this.rpc.on('ready', () => {
            this.startTimestamp = Date.now();
            this.hasTriedConnection = false;
            this.updateActivity();
            this.rpcDisposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.updateActivity()));
            this.rpcDisposables.push(vscode.workspace.onDidCloseTextDocument(() => this.updateActivity()));
            this.rpcDisposables.push(vscode.workspace.onDidChangeNotebookDocument(() => this.updateActivity()));
            this.activityInterval = setInterval(() => this.updateActivity(), RPC_TIMINGS.activityUpdateIntervalMs);

            this.statusBarItem.tooltip = STATUS_BAR.connectedTooltip;
            this.statusBarItem.text = STATUS_BAR.connectedText;
            this.statusBarItem.command = COMMANDS.disconnect;

            this.connectionTimeout = setTimeout(() => {
                if (this.isConnected) {
                    this.statusBarItem.text = STATUS_BAR.connectedCompactText;
                }
            }, RPC_TIMINGS.compactConnectedStatusDelayMs);

            this.isConnected = true;
            this.reconnectInProgress = false;
        });

        this.rpc.on('disconnected', () => {
            this.disposeRpcResources();

            this.statusBarItem.tooltip = STATUS_BAR.reconnectTooltip;
            this.statusBarItem.text = STATUS_BAR.reconnectText;
            this.statusBarItem.command = COMMANDS.reconnect;
            this.isConnected = false;
            this.reconnectInProgress = false;
        });

        try {
            await this.rpc.login();
        } catch (err) {
            this.reconnectInProgress = false;
            this.handleError(err);
        }

        this.context.subscriptions.push({
            dispose: () => {
                void this.rpc?.destroy();
            },
        });
    }

    reload() {
        vscode.window.showInformationMessage(UI_MESSAGES.reloadInfo);
        void this.initialize();
    }

    disconnect() {
        void this.deactivate();
    }

    reconnect() {
        void this.initialize();
    }

    async deactivate() {
        this.disposeRpcResources();

        if (this.rpc) {
            this.isConnected = false;

            const currentRpc = this.rpc;
            this.rpc = null;

            try {
                await currentRpc.user?.clearActivity();
            } catch {
                // Ignore clear failures during shutdown.
            }

            try {
                await currentRpc.destroy();
            } catch {
                // Ignore destroy failures and allow reconnect attempts.
            }

            this.statusBarItem.tooltip = STATUS_BAR.reconnectTooltip;
            this.statusBarItem.text = STATUS_BAR.reconnectText;
            this.statusBarItem.command = COMMANDS.reconnect;
        }

        this.reconnectInProgress = false;
    }

    private disposeRpcResources() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }

        while (this.rpcDisposables.length > 0) {
            const disposable = this.rpcDisposables.pop();
            disposable?.dispose();
        }
    }

    private handleError(err: unknown) {
        let errorMessage: string = UI_MESSAGES.unknownActivationError;

        if (err instanceof Error) {
            console.error('Error logging into Discord RPC:', err);
            errorMessage = `${UI_MESSAGES.activationErrorPrefix} ${err.message}`;
        } else {
            console.error('Unknown error occurred', err);
        }

        if (!this.hasTriedConnection) {
            vscode.window.showErrorMessage(errorMessage, UI_MESSAGES.tryAgainAction).then((selection) => {
                if (selection === UI_MESSAGES.tryAgainAction) {
                    this.reconnect();
                }
            });

            this.hasTriedConnection = true;
        } else {
            vscode.window.showErrorMessage(errorMessage);
        }

        this.statusBarItem.tooltip = STATUS_BAR.reconnectTooltip;
        this.statusBarItem.text = STATUS_BAR.reconnectText;
        this.statusBarItem.command = COMMANDS.reconnect;
    }

    private getLanguageId(fileName: string, languageId: string): string {
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
        return fileExtensionToLanguageId[fileExtension] || languageId;
    }

    private updateActivity() {
        if (!this.rpc || !this.rpc.user) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        let workspaceFolderName: string = PRESENCE.noWorkspace;

        if (vscode.workspace.workspaceFolders) {
            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            workspaceFolderName = workspaceFolder.name;
        }

        if (editor) {
            const fileName = editor.document.fileName.split(/[/\\]/).pop() || '';
            const fileType = this.getLanguageId(fileName, editor.document.languageId);
            const imageKey = fileTypeImages[fileType] || fileTypeImages.default;

            const cursorPosition = editor.selection.active;
            const position = `${cursorPosition.line + 1}:${cursorPosition.character + 1}`;

            void this.rpc.user.setActivity({
                details: `${PRESENCE.editingPrefix}${fileName}${PRESENCE.editingSuffix}${position}`,
                state: `${PRESENCE.workspacePrefix}${workspaceFolderName}`,
                startTimestamp: this.startTimestamp,
                largeImageKey: imageKey,
                largeImageText: `${PRESENCE.fileTypeTextPrefix}${fileType.toUpperCase()}${PRESENCE.fileTypeTextSuffix}`,
                smallImageKey: PRESENCE.vscodeSmallImageKey,
                smallImageText: PRESENCE.vscodeSmallImageText,
            });
        } else {
            void this.rpc.user.setActivity({
                state: PRESENCE.notEditingState,
                startTimestamp: this.startTimestamp,
                largeImageKey: PRESENCE.idleLargeImageKey,
                smallImageKey: PRESENCE.idleSmallImageKey,
                smallImageText: PRESENCE.idleSmallImageText,
            });
        }
    }
}
