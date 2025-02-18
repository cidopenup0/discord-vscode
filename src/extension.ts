import * as vscode from 'vscode';
import { Client } from 'discord-rpc';

const clientId = '1331928227782066229';
const fileTypeImages: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'python',
    java: 'java',
    c: 'c',
    csharp: 'csharp',
    'objective-c': 'objective-c',
    cpp: 'cpp',
    dart: 'dart',
    julia: 'julia',
    r: 'r',
    html: 'html',
    css: 'css',
    json: 'json',
    jsonc: 'json',
    markdown: 'markdown',
    lua: 'lua',
    kotlin: 'kotlin',
    log: 'log',
    gradle: 'gradle',
    go: 'go',
    properties: 'env',
    jupyter: 'jupyter',
    javascriptreact: 'jsx',
    typescriptreact: 'tsx',
    plaintext: 'text',
    xml: 'xml',
    swift: 'swift',
    vue: 'vue',
    sql: 'sql',
    git: 'git',
    default: 'idle-keyboard',
};

const fileExtensionToLanguageId: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    h: 'c',
    cs: 'csharp',
    'objective-c': 'objective-c',
    cpp: 'cpp',
    hpp: 'cpp',
    dart: 'dart',
    jl: 'julia',
    html: 'html',
    css: 'css',
    json: 'json',
    jsonc: 'json',
    md: 'markdown',
    lua: 'lua',
    kt: 'kotlin',
    log: 'log',
    gradle: 'gradle',
    go: 'go',
    env: 'properties',
    ipynb: 'jupyter',
    jsx: 'javascriptreact',
    tsx: 'typescriptreact',
    txt: 'plaintext',
    xml: 'xml',
    swift: 'swift',
    vue: 'vue',
    sql: 'sql',
    gitignore: 'git',
};

let rpc: Client | null = null;
let startTimestamp = Date.now();
let statusBarItem: vscode.StatusBarItem;
let isConnected = false;

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.tooltip = 'Minimal RPC Status';
    initializeRichPresence(context);
    
    // TODO : fix that something is off in this code, RPC updating 15 seconds later
    context.subscriptions.push(
        vscode.commands.registerCommand('minimal-discord-rpc.reload', () => reloadRichPresence(context)),
        vscode.commands.registerCommand('minimal-discord-rpc.disconnect', () => disconnectRichPresence()),
        vscode.commands.registerCommand('minimal-discord-rpc.reconnect', () => reconnectRichPresence(context)),
    );
}

async function initializeRichPresence(context: vscode.ExtensionContext) {
    if (rpc) {
        rpc.destroy();
    }

    rpc = new Client({ transport: 'ipc' });

    rpc.on('ready', () => {
        vscode.window.showInformationMessage('Minimal Discord Rich Presence activated!');
        startTimestamp = Date.now();
        updateActivity();
        vscode.window.onDidChangeActiveTextEditor(updateActivity);
        vscode.workspace.onDidCloseTextDocument(updateActivity);
        setInterval(updateActivity, 15000);

        statusBarItem.text = '$(flame) Connected to discord';
        statusBarItem.command = 'minimal-discord-rpc.disconnect';
        statusBarItem.show();
    });

    rpc.on('disconnected', () => {
        statusBarItem.text = '$(refresh) Reconnect to discord';
        statusBarItem.command = 'minimal-discord-rpc.reconnect';
        statusBarItem.show();
        rpc?.destroy();
    });

    rpc.login({ clientId }).catch(err => {
        handleError(err);
    });

    context.subscriptions.push({
        dispose: () => rpc?.destroy(),
    });
}

function handleError(err: unknown) {
    if (err instanceof Error) {
        console.error('Error logging into Discord RPC:', err);
        vscode.window.showErrorMessage(`Failed to activate Minimal Discord Rich Presence: ${err.message}`);
    } else {
        console.error('Unknown error occurred', err);
        vscode.window.showErrorMessage('Failed to activate Minimal Discord Rich Presence due to an unknown error.');
    }

    statusBarItem.text = '$(refresh) Reconnect to discord';
    statusBarItem.command = 'minimal-discord-rpc.reconnect';
    statusBarItem.show();
}

function getLanguageId(fileName: string, languageId: string): string {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    return fileExtensionToLanguageId[fileExtension] || languageId;
}

function updateActivity() {
    if (!rpc) {
        return;
    }

    const editor = vscode.window.activeTextEditor;
    let workspaceFolderName = "No Workspace";

    if (vscode.workspace.workspaceFolders) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        workspaceFolderName = workspaceFolder.name;
    }

    if (editor) {
        const fileName = editor.document.fileName.split(/[/\\]/).pop() || '';
        const fileType = getLanguageId(fileName, editor.document.languageId);
        const imageKey = fileTypeImages[fileType] || fileTypeImages.default;

        const cursorPosition = editor.selection.active;
        const position = `${cursorPosition.line + 1}:${cursorPosition.character + 1}`;

        rpc.setActivity({
            details: `Editing ${fileName} file at ${position}`,
            state: `Workspace: ${workspaceFolderName}`,
            startTimestamp: startTimestamp,
            largeImageKey: imageKey,
            largeImageText: `Editing a ${fileType.toUpperCase()} File`,
            smallImageKey: 'vscode',
            smallImageText: 'Visual Studio Code',
        });
    } else {
        rpc.setActivity({
            state: `Not editing a file`,
            startTimestamp: startTimestamp,
            largeImageKey: 'idle-keyboard',
            smallImageKey: 'idle',
            smallImageText: 'Idling',
        });
    }
}

function reloadRichPresence(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Reloading Discord Rich Presence...');
    deactivate();
    initializeRichPresence(context);
}

function disconnectRichPresence() {
    deactivate();
}

function reconnectRichPresence(context: vscode.ExtensionContext) {
    statusBarItem.text = "$(search-refresh) Connecting to Discord...";
    statusBarItem.tooltip = "Connecting to Discord...";
    initializeRichPresence(context);
    statusBarItem.tooltip = isConnected ? 'Click to disconnect from discord gateway' : 'Click to connect to discord gateway';
    statusBarItem.text = isConnected ? '$(flame) Connected to discord' : '$(refresh) Reconnect to discord';
    statusBarItem.command = isConnected ? 'minimal-discord-rpc.disconnect' : 'minimal-discord-rpc.reconnect';
    statusBarItem.show();
}

export function deactivate() {
    if (rpc) {
        rpc.destroy();
        rpc = null;
        statusBarItem.text = '$(refresh) Reconnect to discord';
        statusBarItem.command = 'minimal-discord-rpc.reconnect';
        statusBarItem.show();
    }
}
