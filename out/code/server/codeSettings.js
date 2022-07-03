"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["ERROR"] = 2] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class CodeSettings {
}
CodeSettings.logLevel = LogLevel.INFO;
CodeSettings.isOpenDebugCode = false;
CodeSettings.isAllowDefJumpPreload = true;
exports.CodeSettings = CodeSettings;
//# sourceMappingURL=codeSettings.js.map