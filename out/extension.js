'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const Net = require("net");
const path = require("path");
const luaDebug_1 = require("./debug/luaDebug");
const logManager_1 = require("./common/logManager");
const statusBarManager_1 = require("./common/statusBarManager");
const Tools_1 = require("./common/Tools");
const vscode_languageclient_1 = require("vscode-languageclient");
const vscode_1 = require("vscode");
const visualSetting_1 = require("./debug/visualSetting");
const PathManager_1 = require("./common/PathManager");
let client;
function activate(context) {
    let reloadWindow = vscode.commands.registerCommand('luapanda.reloadLuaDebug', function () {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    context.subscriptions.push(reloadWindow);
    let LuaGarbageCollect = vscode.commands.registerCommand('luapanda.LuaGarbageCollect', function () {
        for (var [, instance] of luaDebug_1.LuaDebugSession.debugSessionArray) {
            instance.LuaGarbageCollect();
        }
        vscode.window.showInformationMessage('Lua Garbage Collect!');
    });
    context.subscriptions.push(LuaGarbageCollect);
    let openSettingsPage = vscode.commands.registerCommand('luapanda.openSettingsPage', function () {
        try {
            let launchData = visualSetting_1.VisualSetting.getLaunchData(PathManager_1.PathManager.rootFolderArray);
            let panel = vscode.window.createWebviewPanel('LuaPanda Setting', 'LuaPanda Setting', vscode.ViewColumn.One, {
                retainContextWhenHidden: true,
                enableScripts: true
            });
            panel.webview.html = Tools_1.Tools.readFileContent(Tools_1.Tools.VSCodeExtensionPath + '/res/web/settings.html');
            panel.webview.onDidReceiveMessage(message => {
                visualSetting_1.VisualSetting.getWebMessage(message);
            }, undefined, context.subscriptions);
            panel.webview.postMessage(launchData);
        }
        catch (error) {
            logManager_1.DebugLogger.showTips("解析 launch.json 文件失败, 请检查此文件配置项是否异常, 或手动修改 launch.json 中的项目来完成配置! ", 2);
        }
    });
    context.subscriptions.push(openSettingsPage);
    const provider = new LuaConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('lua', provider));
    context.subscriptions.push(provider);
    let pkg = require(context.extensionPath + "/package.json");
    Tools_1.Tools.adapterVersion = pkg.version;
    Tools_1.Tools.VSCodeExtensionPath = context.extensionPath;
    logManager_1.DebugLogger.init();
    statusBarManager_1.StatusBarManager.init();
    let serverModule = context.asAbsolutePath(path.join('out', 'code', 'server', 'server.js'));
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    let clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'lua' }],
        synchronize: {
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    client = new vscode_languageclient_1.LanguageClient('lua_analyzer', 'Lua Analyzer', serverOptions, clientOptions);
    client.start();
    client.onReady().then(() => {
        Tools_1.Tools.client = client;
        client.onNotification("setRootFolders", setRootFolders);
        client.onNotification("showProgress", showProgress);
        client.onNotification("showErrorMessage", showErrorMessage);
        client.onNotification("showWarningMessage", showWarningMessage);
        client.onNotification("showInformationMessage", showInformationMessage);
    });
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    Tools_1.Tools.client = undefined;
    return client.stop();
}
exports.deactivate = deactivate;
class LuaConfigurationProvider {
    resolveDebugConfiguration(folder, config, token) {
        if (!config.type && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lua') {
                vscode.window.showInformationMessage('请先正确配置launch文件!');
                config.type = 'lua';
                config.name = 'LuaPanda';
                config.request = 'launch';
            }
        }
        if (config.noDebug) {
            let retObject = Tools_1.Tools.getVSCodeAvtiveFilePath();
            if (retObject["retCode"] !== 0) {
                logManager_1.DebugLogger.DebuggerInfo(retObject["retMsg"]);
                return;
            }
            let filePath = retObject["filePath"];
            if (LuaConfigurationProvider.RunFileTerminal) {
                LuaConfigurationProvider.RunFileTerminal.dispose();
            }
            LuaConfigurationProvider.RunFileTerminal = vscode.window.createTerminal({
                name: "Run Lua File (LuaPanda)",
                env: {},
            });
            let path = require("path");
            let pathCMD = "'";
            let pathArr = Tools_1.Tools.VSCodeExtensionPath.split(path.sep);
            let stdPath = pathArr.join('/');
            pathCMD = pathCMD + stdPath + "/Debugger/?.lua;";
            pathCMD = pathCMD + config.packagePath.join(';');
            pathCMD = pathCMD + "'";
            pathCMD = " \"package.path = " + pathCMD + ".. package.path;\" ";
            let doFileCMD = filePath;
            let runCMD = pathCMD + doFileCMD;
            let LuaCMD;
            if (config.luaPath && config.luaPath !== '') {
                LuaCMD = config.luaPath + " -e ";
            }
            else {
                LuaCMD = "lua -e ";
            }
            LuaConfigurationProvider.RunFileTerminal.sendText(LuaCMD + runCMD, true);
            LuaConfigurationProvider.RunFileTerminal.show();
            return;
        }
        if (config.tag == undefined) {
            if (config.name === "LuaPanda") {
                config.tag = "normal";
            }
            else if (config.name === "LuaPanda-Attach") {
                config.tag = "attach";
            }
            else if (config.name === "LuaPanda-IndependentFile" || config.name === "LuaPanda-DebugFile") {
                config.tag = "independent_file";
            }
        }
        if (config.tag === "independent_file") {
            if (!config.internalConsoleOptions) {
                config.internalConsoleOptions = "neverOpen";
            }
        }
        else {
            if (!config.internalConsoleOptions) {
                config.internalConsoleOptions = "openOnSessionStart";
            }
        }
        config.rootFolder = '${workspaceFolder}';
        if (!config.TempFilePath) {
            config.TempFilePath = '${workspaceFolder}';
        }
        if (config.DevelopmentMode !== true) {
            config.DevelopmentMode = false;
        }
        if (config.tag !== "attach") {
            if (!config.program) {
                config.program = '';
            }
            if (config.packagePath == undefined) {
                config.packagePath = [];
            }
            if (config.truncatedOPath == undefined) {
                config.truncatedOPath = "";
            }
            if (config.distinguishSameNameFile == undefined) {
                config.distinguishSameNameFile = false;
            }
            if (config.dbCheckBreakpoint == undefined) {
                config.dbCheckBreakpoint = false;
            }
            if (!config.args) {
                config.args = new Array();
            }
            if (config.autoPathMode == undefined) {
                config.autoPathMode = true;
            }
            if (!config.cwd) {
                config.cwd = '${workspaceFolder}';
            }
            if (!config.luaFileExtension) {
                config.luaFileExtension = '';
            }
            else {
                let firseLetter = config.luaFileExtension.substr(0, 1);
                if (firseLetter === '.') {
                    config.luaFileExtension = config.luaFileExtension.substr(1);
                }
            }
            if (config.stopOnEntry == undefined) {
                config.stopOnEntry = true;
            }
            if (config.pathCaseSensitivity == undefined) {
                config.pathCaseSensitivity = false;
            }
            if (config.connectionPort == undefined) {
                config.connectionPort = 8818;
            }
            if (config.logLevel == undefined) {
                config.logLevel = 1;
            }
            if (config.autoReconnect != true) {
                config.autoReconnect = false;
            }
            if (config.updateTips == undefined) {
                config.updateTips = true;
            }
            if (config.useCHook == undefined) {
                config.useCHook = true;
            }
            if (config.isNeedB64EncodeStr == undefined) {
                config.isNeedB64EncodeStr = true;
            }
            if (config.VSCodeAsClient == undefined) {
                config.VSCodeAsClient = false;
            }
            if (config.connectionIP == undefined) {
                config.connectionIP = "127.0.0.1";
            }
        }
        if (!this._server) {
            this._server = Net.createServer(socket => {
                const session = new luaDebug_1.LuaDebugSession();
                session.setRunAsServer(true);
                session.start(socket, socket);
            }).listen(0);
        }
        config.debugServer = this._server.address().port;
        return config;
    }
    dispose() {
        if (this._server) {
            this._server.close();
        }
    }
}
function showProgress(message) {
    statusBarManager_1.StatusBarManager.showSetting(message);
}
function setRootFolders(...rootFolders) {
    PathManager_1.PathManager.rootFolderArray = rootFolders;
}
function showErrorMessage(str) {
    vscode.window.showErrorMessage(str);
}
function showWarningMessage(str) {
    vscode.window.showWarningMessage(str);
}
function showInformationMessage(str) {
    vscode.window.showInformationMessage(str);
}
//# sourceMappingURL=extension.js.map