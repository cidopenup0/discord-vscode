import * as vscode from 'vscode';
import { Client } from 'discord-rpc';
import simpleGit from 'simple-git';

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
let githubStatusBarItem: vscode.StatusBarItem;
let isConnected = false;

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.tooltip = 'Minimal RPC Status';
    statusBarItem.show();

    // Initialize Discord Rich Presence
    initializeRichPresence(context);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('minimal-discord-rpc.reload', () => reloadRichPresence(context)),
        vscode.commands.registerCommand('minimal-discord-rpc.disconnect', () => disconnectRichPresence()),
        vscode.commands.registerCommand('minimal-discord-rpc.reconnect', () => reconnectRichPresence(context)),
    );
}

async function getGitRemoteUrl(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    try {
        const git = simpleGit(workspacePath);
        const remotes = await git.getRemotes(true);
        const origin = remotes.find(remote =>
            remote.name === 'origin' || (remote.refs.fetch && remote.refs.fetch.includes('github.com'))) || remotes[0];
        return origin?.refs.fetch;
    } catch (error) {
        console.debug('Minimal Discord RPC => Failed to get Git remote URL using simple-git: ',error);
        return undefined;
    }
}

async function initializeRichPresence(context: vscode.ExtensionContext) {
    if (rpc) {
        rpc.destroy();
    }

    rpc = new Client({ transport: 'ipc' });

    let connectionTimeout: NodeJS.Timeout | null = null;

    rpc.on('ready', () => {
        startTimestamp = Date.now();
        updateActivity();
        vscode.window.onDidChangeActiveTextEditor(updateActivity);
        vscode.workspace.onDidCloseTextDocument(updateActivity);
        vscode.workspace.onDidChangeNotebookDocument(updateActivity);
        setInterval(updateActivity, 15000);

        statusBarItem.tooltip = 'Click to disconnect from Discord gateway';
        statusBarItem.text = '$(sparkle) Connected to Discord';
        statusBarItem.command = 'minimal-discord-rpc.disconnect';

        // The status update after 5 seconds if RPC stays connected
        connectionTimeout = setTimeout(() => {
            if (isConnected) {
                statusBarItem.text = '$(rss)';
            }
        }, 5000);

        isConnected = true;
    });

    rpc.on('disconnected', () => {
        if (connectionTimeout) {
            clearTimeout(connectionTimeout); // Clear the timeout if disconnected
        }

        statusBarItem.tooltip = 'Click to reconnect to Discord gateway';
        statusBarItem.text = '$(refresh) Reconnect to Discord';
        statusBarItem.command = 'minimal-discord-rpc.reconnect';
        rpc?.destroy();
        isConnected = false;
    });

    try {
        await rpc.login({ clientId });        
    } catch (err) {
        handleError(err, context);
    }

    context.subscriptions.push({
        dispose: () => rpc?.destroy(),
    });
}

let hasTriedConnection = false;

function handleError(err: unknown, context: vscode.ExtensionContext) {
    let errorMessage = 'Failed to activate Minimal Discord Rich Presence due to an unknown error.';

    if (err instanceof Error) {
        console.error('Error logging into Minimal Discord RPC:', err);
        errorMessage = `Failed to activate Minimal Discord Rich Presence: ${err.message}`;
    } else {
        console.error('Unknown error occurred', err);
    }

    if (!hasTriedConnection) {
        vscode.window.showErrorMessage(errorMessage, 'Try Again').then((selection) => {
            if (selection === 'Try Again') {
                reconnectRichPresence(context);
            }
        });
        
        hasTriedConnection = true; 
    } else {
       vscode.window.showErrorMessage(errorMessage);
    }

    statusBarItem.tooltip = 'Click to reconnect to Discord gateway';
    statusBarItem.text = '$(refresh) Reconnect to Discord';
    statusBarItem.command = 'minimal-discord-rpc.reconnect';
}

function getLanguageId(fileName: string, languageId: string): string {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    return fileExtensionToLanguageId[fileExtension] || languageId;
}

async function updateActivity() {
    if (!rpc) {
        return;
    }

    const editor = vscode.window.activeTextEditor;
    let workspaceFolderName = "No Workspace";

    if (vscode.workspace.workspaceFolders) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        workspaceFolderName = workspaceFolder.name;
    }
    const url = await getGitRemoteUrl();
    const normalizedUrl = url ? url.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '') : undefined;

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
            buttons: normalizedUrl ? [
                { label: 'View Repository', url: normalizedUrl }
            ] : undefined
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
    statusBarItem.text = "$(sync) Connecting to Discord...";
    statusBarItem.tooltip = "Connecting to Discord...";
    initializeRichPresence(context);
    statusBarItem.tooltip = isConnected ? 'Click to disconnect from Discord gateway' : 'Click to reconnect to Discord gateway';
    statusBarItem.text = isConnected ? '$(sparkle) Connected to Discord' : '$(refresh) Reconnect to Discord';
    statusBarItem.command = isConnected ? 'minimal-discord-rpc.disconnect' : 'minimal-discord-rpc.reconnect';
}

export function deactivate() {
    if (rpc) {
        rpc.destroy();
        rpc = null;
        isConnected = false;
        statusBarItem.tooltip = 'Click to reconnect to Discord gateway';
        statusBarItem.text = '$(refresh) Reconnect to Discord';
        statusBarItem.command = 'minimal-discord-rpc.reconnect';
    }
}
function execAsync(arg0: string, arg1: { cwd: string; }): { stdout: any; } | PromiseLike<{ stdout: any; }> {
    throw new Error('Function not implemented.');
}

