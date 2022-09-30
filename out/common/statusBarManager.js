"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class StatusBarManager {
    static init() {
        this.MemStateBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 5.0);
        this.MemStateBar.tooltip = "Click to collect garbage";
        this.MemStateBar.command = 'luapanda.LuaGarbageCollect';
        this.Setting = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 6.0);
        this.Setting.tooltip = "Click to open settings page";
        this.Setting.command = 'luapanda.openSettingsPage';
        this.Setting.hide();
    }
    static refreshLuaMemNum(num) {
        this.MemStateBar.text = String(num) + " KB";
        this.MemStateBar.show();
    }
    static showSetting(message) {
        this.Setting.text = message;
        this.Setting.show();
    }
    static reset() {
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBarManager.js.map