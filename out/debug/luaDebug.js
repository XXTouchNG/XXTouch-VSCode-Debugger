"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const path_1 = require("path");
const luaDebugRuntime_1 = require("./luaDebugRuntime");
const Net = require("net");
const dataProcessor_1 = require("./dataProcessor");
const logManager_1 = require("../common/logManager");
const statusBarManager_1 = require("../common/statusBarManager");
const breakpoint_1 = require("./breakpoint");
const Tools_1 = require("../common/Tools");
const updateManager_1 = require("./updateManager");
const ThreadManager_1 = require("../common/ThreadManager");
const PathManager_1 = require("../common/PathManager");
const visualSetting_1 = require("./visualSetting");
const { Subject } = require('await-notify');
let fs = require('fs');
class LuaDebugSession extends vscode_debugadapter_1.LoggingDebugSession {
    constructor() {
        super("lua-debug.txt");
        this._configurationDone = new Subject();
        this._variableHandles = new vscode_debugadapter_1.Handles(50000);
        this.UseLoadstring = false;
        this._dbCheckBreakpoint = true;
        this.connectionFlag = false;
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
        this._threadManager = new ThreadManager_1.ThreadManager();
        this._pathManager = new PathManager_1.PathManager(this, this.printLogInDebugConsole);
        this._runtime = new luaDebugRuntime_1.LuaDebugRuntime();
        this._dataProcessor = new dataProcessor_1.DataProcessor();
        this._dataProcessor._runtime = this._runtime;
        this._runtime._dataProcessor = this._dataProcessor;
        this._runtime._pathManager = this._pathManager;
        LuaDebugSession._debugSessionArray.set(this._threadManager.CUR_THREAD_ID, this);
        this._runtime.TCPSplitChar = "|*|";
        this._runtime.on('stopOnEntry', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('entry', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnStep', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('step', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnStepIn', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('step', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnStepOut', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('step', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnCodeBreakpoint', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('breakpoint', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnBreakpoint', () => {
            if (this.checkIsRealHitBreakpoint()) {
                this.sendEvent(new vscode_debugadapter_1.StoppedEvent('breakpoint', this._threadManager.CUR_THREAD_ID));
            }
            else {
                this._runtime.continueWithFakeHitBk(() => {
                    logManager_1.DebugLogger.AdapterInfo("命中同名文件中的断点, 确认继续运行");
                });
            }
        });
        this._runtime.on('stopOnException', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('exception', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnPause', () => {
            this.sendEvent(new vscode_debugadapter_1.StoppedEvent('exception', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('breakpointValidated', (bp) => {
            this.sendEvent(new vscode_debugadapter_1.BreakpointEvent('changed', { verified: bp.verified, id: bp.id }));
        });
        this._runtime.on('logInDebugConsole', (message) => {
            this.printLogInDebugConsole(message);
        });
    }
    static get debugSessionArray() { return LuaDebugSession._debugSessionArray; }
    checkIsRealHitBreakpoint() {
        if (!this._dbCheckBreakpoint) {
            return true;
        }
        let steak = this._runtime.breakStack;
        let steakPath = steak[0].file;
        let steakLine = steak[0].line;
        for (let bkMap of this.breakpointsArray) {
            if (bkMap.bkPath === steakPath) {
                for (const node of bkMap.bksArray) {
                    if (node.line == steakLine) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    printLogInDebugConsole(message, instance = this) {
        instance.sendEvent(new vscode_debugadapter_1.OutputEvent(message + '\n', 'console'));
    }
    initializeRequest(response, args) {
        logManager_1.DebugLogger.AdapterInfo("initializeRequest!");
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsEvaluateForHovers = true;
        response.body.supportsStepBack = false;
        response.body.supportsSetVariable = true;
        response.body.supportsFunctionBreakpoints = false;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsHitConditionalBreakpoints = true;
        response.body.supportsLogPoints = true;
        this.sendResponse(response);
    }
    configurationDoneRequest(response, args) {
        super.configurationDoneRequest(response, args);
        this._configurationDone.notify();
    }
    attachRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._configurationDone.wait(1000);
            this.initProcess(response, args);
            this.sendResponse(response);
        });
    }
    launchRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._configurationDone.wait(1000);
            this.initProcess(response, args);
            this.sendResponse(response);
        });
    }
    copyAttachConfig(args) {
        if (args.tag === "attach") {
            if (args.rootFolder) {
                let settings = visualSetting_1.VisualSetting.readLaunchjson(args.rootFolder);
                for (const launchValue of settings.configurations) {
                    if (launchValue["tag"] === "normal" || launchValue["name"] === "LuaPanda") {
                        for (const key in launchValue) {
                            if (key === "name" || key === "program" || args[key]) {
                                continue;
                            }
                            if (key === "cwd") {
                                args[key] = launchValue[key].replace(/\${workspaceFolder}/, args.rootFolder);
                                continue;
                            }
                            args[key] = launchValue[key];
                        }
                    }
                }
            }
        }
        return args;
    }
    initProcess(response, args) {
        let os = require("os");
        let path = require("path");
        this.copyAttachConfig(args);
        this.VSCodeAsClient = args.VSCodeAsClient;
        this.connectionIP = args.connectionIP;
        this.TCPPort = args.connectionPort;
        this._pathManager.CWD = args.cwd;
        this._pathManager.rootFolder = args.rootFolder;
        this._pathManager.useAutoPathMode = !!args.autoPathMode;
        this._pathManager.pathCaseSensitivity = !!args.pathCaseSensitivity;
        this._dbCheckBreakpoint = !!args.dbCheckBreakpoint;
        if (this._pathManager.useAutoPathMode === true) {
            Tools_1.Tools.rebuildAcceptExtMap(args.luaFileExtension);
            let isCWDExist = fs.existsSync(args.cwd);
            if (!isCWDExist) {
                vscode.window.showErrorMessage("[Error] launch.json 文件中 cwd 指向的路径 " + args.cwd + " 不存在, 请修改后再次运行! ", "好的");
                return;
            }
            this._pathManager.rebuildWorkspaceNamePathMap(args.cwd);
            this._pathManager.checkSameNameFile(!!args.distinguishSameNameFile);
        }
        if (args.tag != "independent_file") {
            try {
                new updateManager_1.UpdateManager().checkIfLuaPandaNeedUpdate(this._pathManager.LuaPandaPath, args.cwd);
            }
            catch (error) {
                logManager_1.DebugLogger.AdapterInfo("[Error] 检查升级信息失败, 可选择后续手动升级. https://github.com/Tencent/LuaPanda/blob/master/Docs/Manual/update.md ");
            }
        }
        let sendArgs = new Array();
        sendArgs["stopOnEntry"] = !!args.stopOnEntry;
        sendArgs["luaFileExtension"] = args.luaFileExtension;
        sendArgs["cwd"] = args.cwd;
        sendArgs["isNeedB64EncodeStr"] = !!args.isNeedB64EncodeStr;
        sendArgs["TempFilePath"] = args.TempFilePath;
        sendArgs["logLevel"] = args.logLevel;
        sendArgs["pathCaseSensitivity"] = args.pathCaseSensitivity;
        sendArgs["OSType"] = os.type();
        sendArgs["clibPath"] = Tools_1.Tools.getClibPathInExtension();
        sendArgs["useCHook"] = args.useCHook;
        sendArgs["adapterVersion"] = String(Tools_1.Tools.adapterVersion);
        sendArgs["autoPathMode"] = this._pathManager.useAutoPathMode;
        sendArgs["distinguishSameNameFile"] = !!args.distinguishSameNameFile;
        sendArgs["truncatedOPath"] = String(args.truncatedOPath);
        sendArgs["DevelopmentMode"] = String(args.DevelopmentMode);
        Tools_1.Tools.developmentMode = args.DevelopmentMode;
        if (args.docPathReplace instanceof Array && args.docPathReplace.length === 2) {
            this.replacePath = new Array(Tools_1.Tools.genUnifiedPath(String(args.docPathReplace[0])), Tools_1.Tools.genUnifiedPath(String(args.docPathReplace[1])));
        }
        else {
            this.replacePath = null;
        }
        this.autoReconnect = args.autoReconnect;
        statusBarManager_1.StatusBarManager.reset();
        if (this.VSCodeAsClient) {
            this.printLogInDebugConsole("[Connecting] 调试器 VSCode 客户端已启动, 正在尝试连接. 目标名称: " + args.name + " 端口: " + args.connectionPort);
            this.startClient(sendArgs);
        }
        else {
            this.printLogInDebugConsole("[Listening] 调试器 VSCode 服务端已启动, 正在等待连接. 目标名称: " + args.name + " 端口: " + args.connectionPort);
            this.startServer(sendArgs);
        }
        this.breakpointsArray = new Array();
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
        if (args.tag === "independent_file") {
            let retObject = Tools_1.Tools.getVSCodeAvtiveFilePath();
            if (retObject["retCode"] !== 0) {
                logManager_1.DebugLogger.DebuggerInfo(retObject["retMsg"]);
                return;
            }
            let filePath = retObject["filePath"];
            if (this._debugFileTermianl) {
                this._debugFileTermianl.dispose();
            }
            this._debugFileTermianl = vscode.window.createTerminal({
                name: "Debug Lua File (LuaPanda)",
                env: {},
            });
            let pathCMD = "'";
            let pathArr = Tools_1.Tools.VSCodeExtensionPath.split(path.sep);
            let stdPath = pathArr.join('/');
            pathCMD = pathCMD + stdPath + "/Debugger/?.lua;";
            pathCMD = pathCMD + args.packagePath.join(';');
            pathCMD = pathCMD + "'";
            pathCMD = " \"package.path = " + pathCMD + ".. package.path; ";
            let reqCMD = "require('LuaPanda').start('127.0.0.1'," + this.TCPPort + ");\" ";
            let doFileCMD = filePath;
            let runCMD = pathCMD + reqCMD + doFileCMD;
            let LuaCMD;
            if (args.luaPath && args.luaPath !== '') {
                LuaCMD = args.luaPath + " -e ";
            }
            else {
                LuaCMD = "lua -e ";
            }
            this._debugFileTermianl.sendText(LuaCMD + runCMD, true);
            this._debugFileTermianl.show();
        }
        else {
            if (args.program != undefined && args.program.trim() != '') {
                if (fs.existsSync(args.program) && fs.statSync(args.program).isFile()) {
                    if (this._programTermianl) {
                        this._programTermianl.dispose();
                    }
                    this._programTermianl = vscode.window.createTerminal({
                        name: "Run Program File (LuaPanda)",
                        env: {},
                    });
                    let progaamCmdwithArgs = args.program;
                    for (const arg of args.args) {
                        progaamCmdwithArgs = progaamCmdwithArgs + " " + arg;
                    }
                    this._programTermianl.sendText(progaamCmdwithArgs, true);
                    this._programTermianl.show();
                }
                else {
                    let progError = "[Warning] 配置文件 launch.json 中的 program 路径有误: \n";
                    progError += " + program 配置项的作用是, 在调试器开始运行时拉起一个可执行文件 (注意不是 lua 文件). ";
                    progError += "如无需此功能，建议 program 设置为 \"\" 或从 launch.json 中删除 program 项. \n";
                    progError += " + 当前设置的 " + args.program + " 不存在或不是一个可执行文件. ";
                    this.printLogInDebugConsole(progError);
                }
            }
        }
    }
    startServer(sendArgs) {
        this.connectionFlag = false;
        this._server = Net.createServer(socket => {
            this._dataProcessor._socket = socket;
            this._runtime.start((_, info) => {
                this.connectionFlag = true;
                this._server.close();
                let connectMessage = "[Connected] VSCode 客户端已建立连接! 远程设备信息 " + socket.remoteAddress + ":" + socket.remotePort;
                logManager_1.DebugLogger.AdapterInfo(connectMessage);
                this.printLogInDebugConsole(connectMessage);
                this.printLogInDebugConsole("[Tips] 当停止在断点处时, 可在调试控制台输入要观察变量或执行表达式. ");
                if (info.UseLoadstring === "1") {
                    this.UseLoadstring = true;
                }
                else {
                    this.UseLoadstring = false;
                }
                if (info.isNeedB64EncodeStr === "true") {
                    this._dataProcessor.isNeedB64EncodeStr = true;
                }
                else {
                    this._dataProcessor.isNeedB64EncodeStr = false;
                }
                if (info.UseHookLib === "1") { }
                for (let bkMap of this.breakpointsArray) {
                    this._runtime.setBreakPoint(bkMap.bkPath, bkMap.bksArray, null, null);
                }
            }, sendArgs);
            socket.on('end', () => {
                logManager_1.DebugLogger.AdapterInfo('Socket ended');
            });
            socket.on('close', () => {
                if (this.connectionFlag) {
                    this.connectionFlag = false;
                    logManager_1.DebugLogger.AdapterInfo('Socket closed');
                    vscode.window.showInformationMessage('[LuaPanda] 调试器已断开连接');
                    delete this._dataProcessor._socket;
                    this.sendEvent(new vscode_debugadapter_1.TerminatedEvent(this.autoReconnect));
                }
            });
            socket.on('data', (data) => {
                logManager_1.DebugLogger.AdapterInfo('[Get Msg]:' + data);
                this._dataProcessor.processMsg(data.toString());
            });
        }).listen(this.TCPPort, 0, function () {
            logManager_1.DebugLogger.AdapterInfo("Listening...");
            logManager_1.DebugLogger.DebuggerInfo("Listening...");
        });
    }
    startClient(sendArgs) {
        this.connectInterval = setInterval(begingConnect, 1000, this);
        function begingConnect(instance) {
            instance._client = Net.createConnection(instance.TCPPort, instance.connectionIP);
            instance._client.setTimeout(800);
            instance._client.on('connect', () => {
                clearInterval(instance.connectInterval);
                instance._dataProcessor._socket = instance._client;
                instance._runtime.start((_, info) => {
                    let connectMessage = "[Connected] VSCode 客户端已建立连接! ";
                    logManager_1.DebugLogger.AdapterInfo(connectMessage);
                    instance.printLogInDebugConsole(connectMessage);
                    instance.printLogInDebugConsole("[Tips] 当停止在断点处时, 可在调试控制台输入要观察变量或执行表达式. ");
                    if (info.UseLoadstring === "1") {
                        instance.UseLoadstring = true;
                    }
                    else {
                        instance.UseLoadstring = false;
                    }
                    if (info.isNeedB64EncodeStr === "true") {
                        instance._dataProcessor.isNeedB64EncodeStr = true;
                    }
                    else {
                        instance._dataProcessor.isNeedB64EncodeStr = false;
                    }
                    if (info.UseHookLib === "1") { }
                    for (let bkMap of instance.breakpointsArray) {
                        instance._runtime.setBreakPoint(bkMap.bkPath, bkMap.bksArray, null, null);
                    }
                }, sendArgs);
            });
            instance._client.on('end', () => {
                logManager_1.DebugLogger.AdapterInfo("client end");
                vscode.window.showInformationMessage('[LuaPanda] 调试器已断开连接');
                delete instance._dataProcessor._socket;
                instance.sendEvent(new vscode_debugadapter_1.TerminatedEvent(instance.autoReconnect));
            });
            instance._client.on('close', () => {
            });
            instance._client.on('data', (data) => {
                logManager_1.DebugLogger.AdapterInfo('[Get Msg]:' + data);
                instance._dataProcessor.processMsg(data.toString());
            });
        }
    }
    setBreakPointsRequest(response, args) {
        logManager_1.DebugLogger.AdapterInfo('setBreakPointsRequest');
        let path = args.source.path;
        path = Tools_1.Tools.genUnifiedPath(path);
        if (this.replacePath && this.replacePath.length === 2) {
            path = path.replace(this.replacePath[1], this.replacePath[0]);
        }
        let vscodeBreakpoints = new Array();
        args.breakpoints.map(bp => {
            const id = this._runtime.getBreakPointId();
            let breakpoint;
            if (bp.condition) {
                breakpoint = new breakpoint_1.ConditionBreakpoint(true, bp.line, bp.condition, id);
            }
            else if (bp.logMessage) {
                breakpoint = new breakpoint_1.LogPoint(true, bp.line, bp.logMessage, id);
            }
            else {
                breakpoint = new breakpoint_1.LineBreakpoint(true, bp.line, id);
            }
            vscodeBreakpoints.push(breakpoint);
        });
        response.body = {
            breakpoints: vscodeBreakpoints
        };
        if (this.breakpointsArray == undefined) {
            this.breakpointsArray = new Array();
        }
        let isbkPathExist = false;
        for (let bkMap of this.breakpointsArray) {
            if (bkMap.bkPath === path) {
                bkMap["bksArray"] = vscodeBreakpoints;
                isbkPathExist = true;
            }
        }
        if (!isbkPathExist) {
            let bk = new Object();
            bk["bkPath"] = path;
            bk["bksArray"] = vscodeBreakpoints;
            this.breakpointsArray.push(bk);
        }
        if (this._dataProcessor._socket) {
            let callbackArgs = new Array();
            callbackArgs.push(this);
            callbackArgs.push(response);
            this._runtime.setBreakPoint(path, vscodeBreakpoints, function (arr) {
                logManager_1.DebugLogger.AdapterInfo("确认断点");
                let ins = arr[0];
                ins.sendResponse(arr[1]);
            }, callbackArgs);
        }
        else {
            this.sendResponse(response);
        }
    }
    stackTraceRequest(response, args) {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
        const endFrame = startFrame + maxLevels;
        const stk = this._runtime.stack(startFrame, endFrame);
        response.body = {
            stackFrames: stk.frames.map(f => {
                let source = f.file;
                if (this.replacePath && this.replacePath.length === 2) {
                    source = source.replace(this.replacePath[0], this.replacePath[1]);
                }
                return new vscode_debugadapter_1.StackFrame(f.index, f.name, this.createSource(source), f.line);
            }),
            totalFrames: stk.count
        };
        this.sendResponse(response);
    }
    evaluateRequest(response, args) {
        if (args.context == "watch" || args.context == "hover") {
            let callbackArgs = new Array();
            callbackArgs.push(this);
            callbackArgs.push(response);
            if (this.UseLoadstring == false) {
                let watchString = args.expression;
                watchString = watchString.replace(/\[/g, ".");
                watchString = watchString.replace(/\"/g, "");
                watchString = watchString.replace(/\'/g, "");
                watchString = watchString.replace(/]/g, "");
                args.expression = watchString;
            }
            this._runtime.getWatchedVariable((arr, info) => {
                if (info.length === 0) {
                    arr[1].body = {
                        result: '未能查到变量的值',
                        type: 'string',
                        variablesReference: 0
                    };
                }
                else {
                    arr[1].body = {
                        result: info[0].value,
                        type: info[0].type,
                        variablesReference: parseInt(info[0].variablesReference)
                    };
                }
                let ins = arr[0];
                ins.sendResponse(arr[1]);
            }, callbackArgs, args.expression, args.frameId);
        }
        else if (args.context == "repl") {
            let callbackArgs = new Array();
            callbackArgs.push(this);
            callbackArgs.push(response);
            this._runtime.getREPLExpression((arr, info) => {
                if (info.length === 0) {
                    arr[1].body = {
                        result: 'nil',
                        variablesReference: 0
                    };
                }
                else {
                    arr[1].body = {
                        result: info[0].value,
                        type: info[0].type,
                        variablesReference: parseInt(info[0].variablesReference)
                    };
                }
                let ins = arr[0];
                ins.sendResponse(arr[1]);
            }, callbackArgs, args.expression, args.frameId);
        }
        else {
            this.sendResponse(response);
        }
    }
    scopesRequest(response, args) {
        const frameReference = args.frameId;
        const scopes = new Array();
        scopes.push(new vscode_debugadapter_1.Scope("Local", this._variableHandles.create("10000_" + frameReference), false));
        scopes.push(new vscode_debugadapter_1.Scope("Global", this._variableHandles.create("20000_" + frameReference), true));
        scopes.push(new vscode_debugadapter_1.Scope("UpValue", this._variableHandles.create("30000_" + frameReference), false));
        response.body = {
            scopes: scopes
        };
        this.sendResponse(response);
    }
    setVariableRequest(response, args) {
        let callbackArgs = new Array();
        callbackArgs.push(this);
        callbackArgs.push(response);
        let referenceString = this._variableHandles.get(args.variablesReference);
        let referenceArray = [];
        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                logManager_1.DebugLogger.AdapterInfo("[VariablesRequest Error] #referenceArray < 2, #referenceArray = " + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        }
        else {
            referenceArray[0] = String(args.variablesReference);
        }
        this._runtime.setVariable((arr, info) => {
            if (info.success === "true") {
                arr[1].body = {
                    value: String(info.value),
                    type: String(info.type),
                    variablesReference: parseInt(info.variablesReference)
                };
                logManager_1.DebugLogger.showTips(info.tip);
            }
            else {
                logManager_1.DebugLogger.showTips("变量赋值失败 [" + info.tip + "]");
            }
            let ins = arr[0];
            ins.sendResponse(arr[1]);
        }, callbackArgs, args.name, args.value, parseInt(referenceArray[0]), parseInt(referenceArray[1]));
    }
    variablesRequest(response, args) {
        let callbackArgs = new Array();
        callbackArgs.push(this);
        callbackArgs.push(response);
        let referenceString = this._variableHandles.get(args.variablesReference);
        let referenceArray = [];
        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                logManager_1.DebugLogger.AdapterInfo("[VariablesRequest Error] #referenceArray < 2, #referenceArray = " + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        }
        else {
            referenceArray[0] = String(args.variablesReference);
        }
        this._runtime.getVariable((arr, info) => {
            if (info == undefined) {
                info = new Array();
            }
            const variables = new Array();
            info.forEach(element => {
                variables.push({
                    name: element.name,
                    type: element.type,
                    value: element.value,
                    variablesReference: parseInt(element.variablesReference)
                });
            });
            arr[1].body = {
                variables: variables
            };
            let ins = arr[0];
            ins.sendResponse(arr[1]);
        }, callbackArgs, parseInt(referenceArray[0]), parseInt(referenceArray[1]));
    }
    continueRequest(response, args) {
        let callbackArgs = new Array();
        callbackArgs.push(this);
        callbackArgs.push(response);
        this._runtime.continue(arr => {
            logManager_1.DebugLogger.AdapterInfo("确认继续运行");
            let ins = arr[0];
            ins.sendResponse(arr[1]);
        }, callbackArgs);
    }
    nextRequest(response, args) {
        let callbackArgs = new Array();
        callbackArgs.push(this);
        callbackArgs.push(response);
        this._runtime.step(arr => {
            logManager_1.DebugLogger.AdapterInfo("确认单步");
            let ins = arr[0];
            ins.sendResponse(arr[1]);
        }, callbackArgs);
    }
    stepInRequest(response, args) {
        let callbackArgs = new Array();
        callbackArgs.push(this);
        callbackArgs.push(response);
        this._runtime.step(arr => {
            logManager_1.DebugLogger.AdapterInfo("确认步入");
            let ins = arr[0];
            ins.sendResponse(arr[1]);
        }, callbackArgs, 'stopOnStepIn');
    }
    stepOutRequest(response, args) {
        let callbackArgs = new Array();
        callbackArgs.push(this);
        callbackArgs.push(response);
        this._runtime.step(arr => {
            logManager_1.DebugLogger.AdapterInfo("确认步出");
            let ins = arr[0];
            ins.sendResponse(arr[1]);
        }, callbackArgs, 'stopOnStepOut');
    }
    pauseRequest(response, args) {
        vscode.window.showInformationMessage('暂停功能暂不可用');
    }
    disconnectRequest(response, args) {
        let disconnectMessage = "[Disconnect Request] 调试器已断开连接";
        logManager_1.DebugLogger.AdapterInfo(disconnectMessage);
        this.printLogInDebugConsole(disconnectMessage);
        let restart = args.restart;
        if (this.VSCodeAsClient) {
            clearInterval(this.connectInterval);
            this._client.end();
        }
        else {
            let callbackArgs = new Array();
            callbackArgs.push(restart);
            this._runtime.stopRun(arr => {
                logManager_1.DebugLogger.AdapterInfo("确认停止");
            }, callbackArgs, 'stopRun');
            this._server.close();
        }
        this._threadManager.destructor();
        LuaDebugSession._debugSessionArray.delete(this._threadManager.CUR_THREAD_ID);
        this.sendResponse(response);
    }
    restartRequest(response, args) {
        logManager_1.DebugLogger.AdapterInfo("restartRequest");
    }
    restartFrameRequest(response, args) {
        logManager_1.DebugLogger.AdapterInfo("restartFrameRequest");
    }
    createSource(filePath) {
        return new vscode_debugadapter_1.Source(path_1.basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, undefined);
    }
    threadsRequest(response) {
        response.body = {
            threads: [
                new vscode_debugadapter_1.Thread(this._threadManager.CUR_THREAD_ID, "thread " + this._threadManager.CUR_THREAD_ID)
            ]
        };
        this.sendResponse(response);
    }
    LuaGarbageCollect() {
        this._runtime.luaGarbageCollect();
    }
}
LuaDebugSession._debugSessionArray = new Map();
exports.LuaDebugSession = LuaDebugSession;
//# sourceMappingURL=luaDebug.js.map