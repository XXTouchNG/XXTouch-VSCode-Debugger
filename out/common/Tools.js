"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const vscode_uri_1 = require("vscode-uri");
let path = require("path");
class Tools {
    static getLuaPathInExtension() {
        let luaPathInVSCodeExtension = this.VSCodeExtensionPath + "/Debugger/LuaPanda.lua";
        return luaPathInVSCodeExtension;
    }
    static getClibPathInExtension() {
        let ClibPathInVSCodeExtension = this.VSCodeExtensionPath + "/Debugger/debugger_lib/plugins/";
        return ClibPathInVSCodeExtension;
    }
    static readFileContent(path) {
        if (path === '' || path == undefined) {
            return '';
        }
        let data = fs.readFileSync(path);
        let dataStr = data.toString();
        return dataStr;
    }
    static writeFileContent(path, content) {
        if (path === '' || path == undefined) {
            return;
        }
        fs.writeFileSync(path, content);
    }
    static genUnifiedPath(beProcessPath) {
        beProcessPath = beProcessPath.replace(/\\/g, '/');
        while (beProcessPath.match(/\/\//)) {
            beProcessPath = beProcessPath.replace(/\/\//g, '/');
        }
        beProcessPath = beProcessPath.replace(/^\w:/, function ($1) { return $1.toLocaleLowerCase(); });
        return beProcessPath;
    }
    static getVSCodeAvtiveFilePath() {
        let retObject = { retCode: 0, retMsg: "", filePath: "" };
        let activeWindow = vscode.window.activeTextEditor;
        if (activeWindow) {
            let activeFileUri = '';
            let activeScheme = activeWindow.document.uri.scheme;
            if (activeScheme !== "file") {
                let visableTextEditorArray = vscode.window.visibleTextEditors;
                for (const key in visableTextEditorArray) {
                    const editor = visableTextEditorArray[key];
                    let editScheme = editor.document.uri.scheme;
                    if (editScheme === "file") {
                        activeFileUri = editor.document.uri.fsPath;
                        break;
                    }
                }
            }
            else {
                activeFileUri = activeWindow.document.uri.fsPath;
            }
            if (activeFileUri === '') {
                retObject.retMsg = "[Error]: Adapter started file debugging, but file URI is an empty string. ";
                retObject.retCode = -1;
                return retObject;
            }
            let pathArray = activeFileUri.split(path.sep);
            let filePath = pathArray.join('/');
            filePath = '"' + filePath + '"';
            retObject.filePath = filePath;
            return retObject;
        }
        else {
            retObject.retMsg = "[Error]: Cannot get vscode activeWindow. ";
            retObject.retCode = -1;
            return retObject;
        }
    }
    static rebuildAcceptExtMap(userSetExt) {
        Tools.extMap = new Object();
        Tools.extMap['lua'] = true;
        Tools.extMap['lua.txt'] = true;
        Tools.extMap['lua.bytes'] = true;
        if (typeof userSetExt == 'string' && userSetExt != '') {
            Tools.extMap[userSetExt] = true;
        }
    }
    static getCurrentMS() {
        let currentMS = new Date();
        return currentMS.getTime();
    }
    static getPathNameAndExt(UriOrPath) {
        let name_and_ext = path.basename(UriOrPath).split('.');
        let name = name_and_ext[0];
        let ext = name_and_ext[1] || '';
        for (let index = 2; index < name_and_ext.length; index++) {
            ext = ext + '.' + name_and_ext[index];
        }
        return { name, ext };
    }
    static getDirAndFileName(UriOrPath) {
        let retObj = this.getPathNameAndExt(UriOrPath);
        let _dir = path.dirname(UriOrPath);
        retObj["dir"] = _dir;
        return retObj;
    }
    static removeDir(dir) {
        let files;
        try {
            files = fs.readdirSync(dir);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            else {
                throw err;
            }
        }
        for (var i = 0; i < files.length; i++) {
            let newPath = path.join(dir, files[i]);
            let stat = fs.statSync(newPath);
            if (stat.isDirectory()) {
                this.removeDir(newPath);
            }
            else {
                fs.unlinkSync(newPath);
            }
        }
        fs.rmdirSync(dir);
        return true;
    }
    static uriToPath(uri) {
        let pathStr = vscode_uri_1.default.parse(uri).fsPath;
        return pathStr;
    }
}
Tools.developmentMode = false;
exports.Tools = Tools;
//# sourceMappingURL=Tools.js.map