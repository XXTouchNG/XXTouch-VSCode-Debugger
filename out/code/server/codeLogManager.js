"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeSettings_1 = require("./codeSettings");
class Logger {
    static init() {
    }
    static log(str, level) {
        if (!level) {
            level = codeSettings_1.LogLevel.DEBUG;
        }
        if (str != "" && str != null) {
            if (level == codeSettings_1.LogLevel.ERROR)
                this.ErrorLog(str);
            if (level == codeSettings_1.LogLevel.INFO)
                this.InfoLog(str);
            if (level == codeSettings_1.LogLevel.DEBUG)
                this.DebugLog(str);
        }
    }
    static DebugLog(str) {
        if (codeSettings_1.CodeSettings.logLevel <= codeSettings_1.LogLevel.DEBUG) {
            this.connection.console.log(str);
        }
    }
    static InfoLog(str) {
        if (codeSettings_1.CodeSettings.logLevel <= codeSettings_1.LogLevel.INFO) {
            this.connection.console.log(str);
        }
    }
    static ErrorLog(str) {
        if (codeSettings_1.CodeSettings.logLevel <= codeSettings_1.LogLevel.ERROR) {
            this.connection.console.log(str);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=codeLogManager.js.map