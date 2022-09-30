"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logManager_1 = require("./logManager");
const Tools_1 = require("./Tools");
const util_1 = require("util");
const vscode = require("vscode");
let pathReader = require('path-reader');
class PathManager {
    constructor(_luaDebugInstance, _consoleLog) {
        this.useAutoPathMode = false;
        this.pathCaseSensitivity = false;
        this.luaDebugInstance = _luaDebugInstance;
        this.consoleLog = _consoleLog;
    }
    rebuildWorkspaceNamePathMap(rootPath) {
        let beginMS = Tools_1.Tools.getCurrentMS();
        let _fileNameToPathMap = new Array();
        let workspaceFiles = pathReader.files(rootPath, { sync: true });
        let workspaceFileCount = workspaceFiles.length;
        let processFilNum = 0;
        for (let processingFileIdx = 0; processingFileIdx < workspaceFileCount; processingFileIdx++) {
            let formatedPath = Tools_1.Tools.genUnifiedPath(workspaceFiles[processingFileIdx]);
            let nameExtObject = Tools_1.Tools.getPathNameAndExt(formatedPath);
            if (!Tools_1.Tools.extMap[nameExtObject['ext']]) {
                continue;
            }
            processFilNum = processFilNum + 1;
            let fileNameKey = nameExtObject['name'];
            if (_fileNameToPathMap[fileNameKey]) {
                if (util_1.isArray(_fileNameToPathMap[fileNameKey])) {
                    _fileNameToPathMap[fileNameKey].push(formatedPath);
                }
                else if (typeof _fileNameToPathMap[fileNameKey] === "string") {
                    let tempSaveValue = _fileNameToPathMap[fileNameKey];
                    let tempArray = new Array();
                    tempArray.push(tempSaveValue);
                    tempArray.push(formatedPath);
                    _fileNameToPathMap[fileNameKey] = tempArray;
                }
                else {
                    _fileNameToPathMap[fileNameKey] = formatedPath;
                }
            }
            else {
                _fileNameToPathMap[fileNameKey] = formatedPath;
            }
            let processingRate = Math.floor(processingFileIdx / workspaceFileCount * 100);
            let completePath = '';
            if (util_1.isArray(_fileNameToPathMap[fileNameKey])) {
                completePath = _fileNameToPathMap[fileNameKey][_fileNameToPathMap[fileNameKey].length - 1];
            }
            else if (typeof _fileNameToPathMap[fileNameKey] === "string") {
                completePath = _fileNameToPathMap[fileNameKey];
            }
            logManager_1.DebugLogger.AdapterInfo(processingRate + "%  |  " + fileNameKey + "   " + completePath);
            if (fileNameKey === "LuaPanda") {
                this.LuaPandaPath = completePath;
            }
        }
        let endMS = Tools_1.Tools.getCurrentMS();
        logManager_1.DebugLogger.AdapterInfo("文件 Map 刷新完毕，使用了 " + (endMS - beginMS) + " 毫秒。检索了 " + workspaceFileCount + " 个文件，其中 " + processFilNum + " 个 lua 类型文件");
        if (processFilNum <= 0) {
            vscode.window.showErrorMessage("没有在工程中检索到 lua 文件. 请检查 launch.json 文件中 lua 后缀 (luaFileExtension) 是否配置正确, 以及 VSCode 打开的工程是否正确. ", "确定");
            let noLuaFileTip = "[!] 没有在 VSCode 打开的工程中检索到 lua 文件, 请进行如下检查\n 1. VSCode打开的文件夹是否正确 \n 2. launch.json 文件中 luaFileExtension 选项配置是否正确";
            logManager_1.DebugLogger.DebuggerInfo(noLuaFileTip);
            logManager_1.DebugLogger.AdapterInfo(noLuaFileTip);
        }
        this.fileNameToPathMap = _fileNameToPathMap;
    }
    checkSameNameFile(distinguishSameNameFile) {
        let sameNameFileStr;
        for (const nameKey in this.fileNameToPathMap) {
            let completePath = this.fileNameToPathMap[nameKey];
            if (util_1.isArray(completePath)) {
                if (sameNameFileStr === undefined) {
                    sameNameFileStr = "\nVSCode 打开工程中存在以下同名 lua 文件: \n";
                }
                sameNameFileStr = sameNameFileStr + " + " + completePath.join("\n + ") + "\n\n";
            }
        }
        if (sameNameFileStr) {
            if (distinguishSameNameFile) {
                sameNameFileStr = sameNameFileStr + "distinguishSameNameFile 已开启. 调试器[可以区分]同名文件中的断点. \n";
            }
            else {
                let sameNameFileTips = "[Tips] VSCode 打开目录中存在同名 lua 文件, 请避免在这些文件中打断点. 如确定需要区分同名文件中的断点, 可按以下选择适合自己项目的操作: \n";
                sameNameFileTips += "方法1: LuaPanda 启动时会索引 cwd 目录中的 lua 文件, 修改 launch.json 中的 cwd 配置路径, 过滤掉不参与运行的文件夹, 缩小索引范围来避免重复文件; \n";
                sameNameFileTips += "方法2: 在 launch.json 中加入 distinguishSameNameFile: true, 开启同名文件区分 (会采用更严格的路径校验方式区分同名文件); \n";
                sameNameFileTips += "方法3: 同名文件信息展示在 VSCode 控制台 OUTPUT - LuaPanda Debugger 中, 也可以尝试修改文件名; \n";
                this.consoleLog(sameNameFileTips, this.luaDebugInstance);
            }
            logManager_1.DebugLogger.DebuggerInfo(sameNameFileStr);
            logManager_1.DebugLogger.AdapterInfo(sameNameFileStr);
        }
    }
    checkFullPath(shortPath, oPath) {
        if (this.useAutoPathMode === false) {
            return shortPath;
        }
        if ('@' === shortPath.substr(0, 1)) {
            shortPath = shortPath.substr(1);
        }
        let nameExtObject = Tools_1.Tools.getPathNameAndExt(shortPath);
        let fileName = nameExtObject['name'];
        let fullPath;
        if (this.pathCaseSensitivity) {
            fullPath = this.fileNameToPathMap[fileName];
        }
        else {
            for (const keyPath in this.fileNameToPathMap) {
                if (keyPath.toLowerCase() === fileName) {
                    fullPath = this.fileNameToPathMap[keyPath];
                    break;
                }
            }
        }
        if (fullPath) {
            if (util_1.isArray(fullPath)) {
                if (oPath) {
                    return this.checkRightPath(shortPath, oPath, fullPath);
                }
                else {
                    for (const element of fullPath) {
                        if (element.indexOf(shortPath)) {
                            return element;
                        }
                    }
                }
            }
            else if (typeof fullPath === "string") {
                return fullPath;
            }
        }
        logManager_1.DebugLogger.showTips("调试器没有找到文件 " + shortPath + " 。 请检查 launch.json 文件中 lua 后缀是否配置正确, 以及 VSCode 打开的工程是否正确", 2);
        return shortPath;
    }
    checkRightPath(fileName, oPath, fullPathArray) {
        if ('@' === oPath.substr(0, 1)) {
            oPath = oPath.substr(1);
        }
        if ('./' === oPath.substr(0, 2)) {
            oPath = oPath.substr(1);
        }
        oPath = Tools_1.Tools.genUnifiedPath(oPath);
        if (!this.pathCaseSensitivity) {
            oPath = oPath.toLowerCase();
        }
        let nameExtObject = Tools_1.Tools.getPathNameAndExt(fileName);
        fileName = nameExtObject['name'];
        let idx = oPath.lastIndexOf(fileName);
        oPath = oPath.substring(0, idx - 1);
        oPath = oPath + '/' + fileName;
        oPath = oPath.replace(/\./g, "/");
        for (const iteratorPath of fullPathArray) {
            let pathForCompare = iteratorPath;
            if (!this.pathCaseSensitivity) {
                pathForCompare = iteratorPath.toLowerCase();
            }
            if (pathForCompare.indexOf(oPath) >= 0) {
                return iteratorPath;
            }
        }
        if (Tools_1.Tools.developmentMode === true) {
            let str = "file_name: " + fileName + "  opath: " + oPath + "无法命中任何文件路径! ";
            logManager_1.DebugLogger.showTips(str);
            let Adapterlog = "同名文件无法命中! \n";
            for (const iteratorPath of fullPathArray) {
                Adapterlog += " + " + iteratorPath + "\n";
            }
            Adapterlog += str;
            logManager_1.DebugLogger.AdapterInfo(Adapterlog);
        }
        return fullPathArray[0];
    }
}
PathManager.rootFolderArray = {};
exports.PathManager = PathManager;
//# sourceMappingURL=PathManager.js.map