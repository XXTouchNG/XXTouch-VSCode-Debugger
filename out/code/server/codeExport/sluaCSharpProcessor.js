"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Tools = require("../codeTools");
const codeLogManager_1 = require("../codeLogManager");
const fs = require("fs");
const dir = require("path-reader");
const path = require("path");
const codeSymbol_1 = require("../codeSymbol");
class SluaCSharpProcessor {
    static loadIntelliSenseRes() {
        codeSymbol_1.CodeSymbol.refreshUserPreloadSymbals(this.sluaCSharpInterfaceIntelliSenseResPath);
    }
    static get sluaCSharpInterfaceIntelliSenseResPath() {
        if (!this._sluaCSharpInterfaceIntelliSenseResPath) {
            if (Tools.getVSCodeOpenedFolders() && Tools.getVSCodeOpenedFolders().length > 0) {
                this._sluaCSharpInterfaceIntelliSenseResPath = Tools.getVSCodeOpenedFolders()[0] + "/.vscode/LuaPanda/IntelliSenseRes/SluaCSharpInterface/";
            }
        }
        return this._sluaCSharpInterfaceIntelliSenseResPath;
    }
    static processluaCSDir(cppDir) {
        let intelLuaPath = this.sluaCSharpInterfaceIntelliSenseResPath;
        if (!intelLuaPath) {
            codeLogManager_1.Logger.ErrorLog('未打开文件夹, 无法使用此功能! ');
            Tools.showTips('未打开文件夹, 无法使用此功能! ');
        }
        let subDir = cppDir;
        subDir = subDir.replace(/\//g, ' ');
        subDir = subDir.replace(/\\/g, ' ');
        subDir = subDir.replace(/:/g, '');
        subDir = subDir.trim();
        subDir = subDir.replace(/ /g, '-');
        let files = this.getCSharpFiles(cppDir);
        let fileCount = this.readSluaCSSymbols(files, subDir);
        codeSymbol_1.CodeSymbol.refreshUserPreloadSymbals(intelLuaPath);
        return fileCount;
    }
    static getCSharpFiles(dirPath) {
        let options = {
            sync: true,
            recursive: true,
            valuetizer: function (stat, fileShortName, fileFullPath) {
                if (stat.isDirectory()) {
                    return fileFullPath;
                }
                return fileShortName.match(/\.cs$/) ? fileFullPath : null;
            }
        };
        return dir.files(dirPath, 'file', null, options);
    }
    static readSluaCSSymbols(filepath, writepath) {
        let sluaRootPath = this.sluaCSharpInterfaceIntelliSenseResPath + writepath;
        this.makeDirSync(sluaRootPath);
        let fileCount = 0;
        for (const file of filepath) {
            let codeTxt = Tools.getFileContent(file);
            if (codeTxt) {
                let luaTxt = this.parseSluaCSSymbols(codeTxt);
                if (luaTxt && luaTxt != "") {
                    fileCount++;
                    let csFilePath = sluaRootPath + '/' + path.basename(file, "cs") + "lua";
                    fs.writeFileSync(csFilePath, luaTxt);
                }
            }
        }
        if (fileCount > 0) {
            let engineFileName = "Lua_UnityEngine.lua";
            let engineFileContent = "UnityEngine = {}";
            fs.writeFileSync(sluaRootPath + '/' + engineFileName, engineFileContent);
        }
        return fileCount;
    }
    static makeDirSync(dirPath) {
        if (fs.existsSync(dirPath)) {
            return;
        }
        let baseDir = path.dirname(dirPath);
        this.makeDirSync(baseDir);
        fs.mkdirSync(dirPath);
    }
    static parseSluaCSSymbols(codeTxt) {
        let currentClass;
        let parentClass;
        let members = [];
        let createTypeMetatableREG = /createTypeMetatable\((.*)\)/;
        let dver = codeTxt.match(createTypeMetatableREG);
        if (!dver)
            return;
        if (dver && dver.length === 2) {
            let paramsArray = dver[1].split(',');
            if (paramsArray.length === 4 && paramsArray[3].trim().search('typeof') != 0) {
                paramsArray[2] = paramsArray[2] + paramsArray.pop();
            }
            if (paramsArray.length === 3) {
                currentClass = paramsArray[2].trim().match(/typeof\((.*)\)/)[1];
            }
            else if (paramsArray.length === 4) {
                currentClass = paramsArray[2].trim().match(/typeof\((.*)\)/)[1];
                parentClass = paramsArray[3].trim().match(/typeof\((.*)\)/)[1].replace('_', '.');
            }
        }
        let memberREG = /addMember\((.*?)\)/g;
        let dver2 = codeTxt.match(memberREG);
        if (dver2) {
            for (const mems of dver2) {
                let paras = mems.match(/addMember\(l,("(.*?)"|(.*?))(,|\))/);
                if (paras[2]) {
                    let functionObj = new Object();
                    functionObj['var'] = paras[2];
                    functionObj['type'] = "variable";
                    members.push(functionObj);
                }
                else if (paras[3]) {
                    let varObj = new Object();
                    let functionNameStr = paras[3];
                    functionNameStr = functionNameStr.replace(/_s$/, '');
                    varObj['var'] = functionNameStr + '()';
                    varObj['type'] = "function";
                    members.push(varObj);
                }
            }
        }
        let luaCode = currentClass + " = {}";
        if (parentClass) {
            luaCode += " ---@type " + parentClass;
        }
        luaCode += '\n';
        for (const oneMember of members) {
            if (oneMember.type === "variable") {
                luaCode += currentClass + '.' + oneMember.var + ' = nil\n';
            }
            else if (oneMember.type === "function") {
                luaCode += "function " + currentClass + '.' + oneMember.var + ' end\n';
            }
        }
        return luaCode;
    }
}
exports.SluaCSharpProcessor = SluaCSharpProcessor;
//# sourceMappingURL=sluaCSharpProcessor.js.map