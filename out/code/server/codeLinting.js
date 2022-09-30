"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const Tools = require("./codeTools");
const child_process_1 = require("child_process");
let os = require('os');
class CodeLinting {
    static processLinting(textDocument, settings, globalVariables) {
        let fileName = Tools.uriToPath(Tools.urlDecode(textDocument.uri));
        let luacheck = this.getLuacheck(settings);
        let luacheckArgs = this.getLuacheckArgs(settings, fileName, globalVariables);
        let fileContent = textDocument.getText();
        let luacheckProcess = new Promise((resolve, reject) => {
            let checkResult = child_process_1.spawnSync(luacheck, luacheckArgs, { input: fileContent });
            if (checkResult.status == 1 || checkResult.status == 2) {
                reject(checkResult.output.join('\n'));
            }
            else if (checkResult.status == 0) {
                resolve();
            }
            else {
                resolve();
            }
        });
        return luacheckProcess;
    }
    static getLuacheck(settings) {
        let luacheck = settings.codeLinting.luacheckPath;
        if (luacheck != "") {
            return luacheck;
        }
        if (os.type() == "Windows_NT") {
            luacheck = Tools.getVScodeExtensionPath() + "/res/luacheck/luacheck.exe";
        }
        else {
            luacheck = '/usr/local/bin/luacheck';
        }
        return luacheck;
    }
    static mergeIgnoreGlobals(globalsInSetting, globalVariables) {
        let globalsMap = new Map();
        for (let g of globalsInSetting) {
            globalsMap[g] = true;
        }
        for (let g of globalVariables) {
            if (globalsMap[g])
                continue;
            let arr = g.split('.');
            globalsMap[arr[0]] = true;
        }
        let ret = [];
        for (let key in globalsMap) {
            ret.push(key);
        }
        return ret;
    }
    static getLuacheckArgs(settings, fileName, globalVariables) {
        let luacheckArgs = [];
        let luaVersion = settings.codeLinting.luaVersion;
        switch (luaVersion) {
            case "5.1":
                luacheckArgs.push("--std", "lua51");
                break;
            case "5.3":
                luacheckArgs.push("--std", "lua53");
                break;
            case "5.1+5.3":
                luacheckArgs.push("--std", "lua51+lua53");
                break;
            default:
        }
        let userIgnoreGlobals = settings.codeLinting.ignoreGlobal.split(";");
        let ignoreGlobals = this.mergeIgnoreGlobals(userIgnoreGlobals, globalVariables);
        if (ignoreGlobals.length > 0) {
            luacheckArgs.push("--globals", ...ignoreGlobals);
        }
        let maxLineLength = settings.codeLinting.maxLineLength;
        luacheckArgs.push("--max-line-length", maxLineLength.toString());
        luacheckArgs.push("--allow-defined");
        luacheckArgs.push("--ranges");
        luacheckArgs.push("--codes");
        luacheckArgs.push("--formatter", "plain");
        luacheckArgs.push("--filename", fileName);
        luacheckArgs.push("-");
        return luacheckArgs;
    }
    static parseLuacheckResult(luaErrorOrWarning, settings) {
        let diagnosticArray = [];
        let maxNumberOfProblems = settings.codeLinting.maxNumberOfProblems;
        let ignoreErrorCode = settings.codeLinting.ignoreErrorCode.split(";");
        const luaErrorOrWarningArray = luaErrorOrWarning.split(/\r\n|\r|\n/);
        for (let i = 0, problems = 0; i < luaErrorOrWarningArray.length && problems < maxNumberOfProblems; i++) {
            let regResult = this.luacheckResultRegExp.exec(luaErrorOrWarningArray[i]);
            if (!regResult) {
                continue;
            }
            let line = parseInt(regResult[2]);
            let startCharacter = parseInt(regResult[3]);
            let endCharacter = parseInt(regResult[4]);
            let errorType = regResult[5];
            let severity = errorType == "E" ? vscode_languageserver_1.DiagnosticSeverity.Error : vscode_languageserver_1.DiagnosticSeverity.Warning;
            let errorCode = parseInt(regResult[6]);
            let message = regResult[7];
            let range = vscode_languageserver_1.Range.create(line - 1, startCharacter - 1, line - 1, endCharacter);
            if (ignoreErrorCode.includes(errorCode.toString())) {
                continue;
            }
            let diagnosic = {
                range: range,
                severity: severity,
                code: errorCode,
                message: message,
                source: "lua-analyzer"
            };
            problems++;
            diagnosticArray.push(diagnosic);
        }
        return diagnosticArray;
    }
}
CodeLinting.luacheckResultRegExp = /^(.+):(\d+):(\d+)-(\d+): \(([EW])(\d+)\) (.+)$/;
exports.CodeLinting = CodeLinting;
//# sourceMappingURL=codeLinting.js.map