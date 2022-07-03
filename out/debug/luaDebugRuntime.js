"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const events_1 = require("events");
const logManager_1 = require("../common/logManager");
const statusBarManager_1 = require("../common/statusBarManager");
class LuaDebugRuntime extends events_1.EventEmitter {
    constructor() {
        super();
        this._breakpointId = 1;
        this.breakStack = new Array();
    }
    get sourceFile() {
        return this._sourceFile;
    }
    get TCPSplitChar() {
        return this._TCPSplitChar;
    }
    set TCPSplitChar(char) {
        this._TCPSplitChar = char;
    }
    getBreakPointId() {
        return this._breakpointId++;
    }
    start(callback, sendArgs) {
        let arrSend = new Object();
        for (let key in sendArgs) {
            arrSend[key] = String(sendArgs[key]);
        }
        this._dataProcessor.commandToDebugger('initSuccess', arrSend, callback);
    }
    continue(callback, callbackArgs, event = 'continue') {
        logManager_1.DebugLogger.AdapterInfo("continue");
        let arrSend = new Object();
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    continueWithFakeHitBk(callback, callbackArgs = null, event = 'continue') {
        logManager_1.DebugLogger.AdapterInfo("continue");
        let arrSend = new Object();
        arrSend["fakeBKPath"] = String(this.breakStack[0].oPath);
        arrSend["fakeBKLine"] = String(this.breakStack[0].line);
        arrSend["isFakeHit"] = String(true);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    getWatchedVariable(callback, callbackArgs, varName, frameId = 2, event = 'getWatchedVariable') {
        logManager_1.DebugLogger.AdapterInfo("getWatchedVariable");
        let arrSend = new Object();
        arrSend["varName"] = String(varName);
        arrSend["stackId"] = String(frameId);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    getREPLExpression(callback, callbackArgs, expression, frameId = 2, event = 'runREPLExpression') {
        logManager_1.DebugLogger.AdapterInfo("runREPLExpression");
        let arrSend = new Object();
        arrSend["Expression"] = String(expression);
        arrSend["stackId"] = String(frameId);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    setVariable(callback, callbackArgs, name, newValue, variableRef = 0, frameId = 2, event = 'setVariable') {
        logManager_1.DebugLogger.AdapterInfo("setVariable");
        let arrSend = new Object();
        arrSend["varRef"] = String(variableRef);
        arrSend["stackId"] = String(frameId);
        arrSend["newValue"] = String(newValue);
        arrSend["varName"] = String(name);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    getVariable(callback, callbackArgs, variableRef = 0, frameId = 2, event = 'getVariable') {
        logManager_1.DebugLogger.AdapterInfo("getVariable");
        let arrSend = new Object();
        arrSend["varRef"] = String(variableRef);
        arrSend["stackId"] = String(frameId);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs, 3);
    }
    stopRun(callback, callbackArgs, event = 'stopRun') {
        let arrSend = new Object();
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    step(callback, callbackArgs, event = 'stopOnStep') {
        logManager_1.DebugLogger.AdapterInfo("step:" + event);
        let arrSend = new Object();
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }
    luaGarbageCollect(event = "LuaGarbageCollect") {
        let arrSend = new Object();
        this._dataProcessor.commandToDebugger(event, arrSend);
    }
    setBreakPoint(path, bks, callback, callbackArgs) {
        logManager_1.DebugLogger.AdapterInfo("setBreakPoint " + " path:" + path);
        let arrSend = new Object();
        arrSend["path"] = path;
        arrSend["bks"] = bks;
        this._dataProcessor.commandToDebugger("setBreakPoint", arrSend, callback, callbackArgs);
    }
    stack(startFrame, endFrame) {
        return {
            frames: this.breakStack,
            count: this.breakStack.length
        };
    }
    printLog(logStr) {
        logManager_1.DebugLogger.DebuggerInfo("[Debugger Log]:" + logStr);
    }
    refreshLuaMemoty(luaMemory) {
        statusBarManager_1.StatusBarManager.refreshLuaMemNum(parseInt(luaMemory));
    }
    showTip(tip) {
        vscode.window.showInformationMessage(tip);
    }
    showError(tip) {
        vscode.window.showErrorMessage(tip);
    }
    logInDebugConsole(message) {
        this.sendEvent('logInDebugConsole', message);
    }
    stop(stack, reason) {
        stack.forEach(element => {
            let linenum = element.line;
            element.line = parseInt(linenum);
            let getinfoPath = element.file;
            let oPath = element.oPath;
            element.file = this._pathManager.checkFullPath(getinfoPath, oPath);
        });
        this.breakStack = stack;
        this.sendEvent(reason);
    }
    sendEvent(event, ...args) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
exports.LuaDebugRuntime = LuaDebugRuntime;
//# sourceMappingURL=luaDebugRuntime.js.map