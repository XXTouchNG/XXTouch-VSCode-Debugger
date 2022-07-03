"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Tools = require("./codeTools");
const codeLogManager_1 = require("./codeLogManager");
class CodeEditor {
    static saveCode(uri, text) {
        this.codeInEditor[uri] = text;
    }
    static getCode(uri) {
        if (this.codeInEditor[uri]) {
            return this.codeInEditor[uri];
        }
        else {
            let luatxt = Tools.getFileContent(Tools.uriToPath(uri));
            if (!luatxt) {
                codeLogManager_1.Logger.InfoLog("Cannot get file content. uri: " + uri);
                return;
            }
            return luatxt;
        }
    }
}
CodeEditor.codeInEditor = new Map();
exports.CodeEditor = CodeEditor;
//# sourceMappingURL=codeEditor.js.map