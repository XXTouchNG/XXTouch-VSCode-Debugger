"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class DebugLogger {
    static init() {
        DebugLogger.Ainfo = vscode.window.createOutputChannel("LuaPanda Adapter");
        DebugLogger.Dinfo = vscode.window.createOutputChannel("LuaPanda Debugger");
        DebugLogger.Dinfo.appendLine("LuaPanda initializing...");
    }
    static DebuggerInfo(str) {
        if (str != "" && str != null) {
            DebugLogger.Dinfo.appendLine(str);
        }
    }
    static AdapterInfo(str) {
        if (str != "" && str != null) {
            DebugLogger.Ainfo.appendLine(str);
        }
    }
    static showTips(str, level) {
        if (level === 2) {
            vscode.window.showErrorMessage(str);
        }
        else if (level === 1) {
            vscode.window.showWarningMessage(str);
        }
        else {
            vscode.window.showInformationMessage(str);
        }
    }
}
exports.DebugLogger = DebugLogger;
//# sourceMappingURL=logManager.js.map