import * as vscode from 'vscode';
import { Client } from 'discord-rpc';

const clientId = '1331928227782066229';

let rpc: Client | null = null;
let startTimestamp = Date.now(); 

const fileTypeImages: { [key: string]: string } = {
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

const fileExtensionToLanguageId: { [key: string]: string } = {
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

export function activate(context: vscode.ExtensionContext) {
    initializeRichPresence(context);
    
    const reloadCommand = vscode.commands.registerCommand('minimal-discord-rpc.reloadRichPresence', () => {
        vscode.window.showInformationMessage('Reloading Discord Rich Presence...');
        deactivate(); // Clean up existing state
        initializeRichPresence(context); // Reinitialize
    });

    context.subscriptions.push(reloadCommand);
}

function initializeRichPresence(context: vscode.ExtensionContext) {
    if (rpc) {
        rpc.destroy();
    }

    rpc = new Client({ transport: 'ipc' });

    rpc.on('ready', () => {
        vscode.window.showInformationMessage('Minimal Discord Rich Presence activated!');
        startTimestamp = Date.now();
        setActivity();
        vscode.window.onDidChangeActiveTextEditor(setActivity);
        vscode.workspace.onDidCloseTextDocument(setActivity);
        vscode.window.onDidChangeTextEditorSelection(setActivity);
        setInterval(setActivity, 10000);
    });

    rpc.login({ clientId }).catch(console.error);

    context.subscriptions.push({
        dispose: () => rpc?.destroy(),
    });
}

function getLanguageId(fileName: string, languageId: string): string {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    console.log(fileExtension);
    return fileExtensionToLanguageId[fileExtension] || languageId;
}

function setActivity() {
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
            details: `Editing ${fileName} file at line ${position}`,
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

export function deactivate() {
    if (rpc) {
        rpc.destroy();
        rpc = null;
    }
}
