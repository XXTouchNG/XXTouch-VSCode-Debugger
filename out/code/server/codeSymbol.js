"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Tools = require("./codeTools");
const codeEditor_1 = require("./codeEditor");
const docSymbolProcessor_1 = require("./docSymbolProcessor");
const codeLogManager_1 = require("./codeLogManager");
const codeSettings_1 = require("./codeSettings");
let dir = require('path-reader');
class CodeSymbol {
    static getCretainDocChunkDic(uri) {
        let processor = this.getFileSymbolsFromCache(uri);
        if (processor) {
            return processor.getChunksDic();
        }
    }
    static createOneDocSymbols(uri, luaText) {
        if (!this.docSymbolMap.has(uri)) {
            this.refreshOneDocSymbols(uri, luaText);
        }
    }
    static refreshOneDocSymbols(uri, luaText) {
        if (luaText == undefined) {
            luaText = codeEditor_1.CodeEditor.getCode(uri);
        }
        this.createDocSymbol(uri, luaText);
    }
    static createSymbolswithExt(luaExtname, rootpath) {
        Tools.setLoadedExt(luaExtname);
        let exp = new RegExp(luaExtname + '$', "i");
        dir.readFiles(rootpath, { match: exp }, function (err, content, filePath, next) {
            if (!err) {
                let uri = Tools.pathToUri(filePath);
                if (!Tools.isinPreloadFolder(uri)) {
                    CodeSymbol.createOneDocSymbols(uri, content);
                }
                else {
                    CodeSymbol.refreshOneUserPreloadDocSymbols(Tools.uriToPath(uri));
                }
            }
            next();
        }, (err) => {
            if (err) {
                return;
            }
        });
    }
    static getOneDocSymbolsArray(uri, luaText, range) {
        let docSymbals = [];
        this.createOneDocSymbols(uri, luaText);
        switch (range) {
            case Tools.SearchRange.GlobalSymbols:
                docSymbals = this.getFileSymbolsFromCache(uri).getGlobalSymbolsArray();
                break;
            case Tools.SearchRange.LocalSymbols:
                docSymbals = this.getFileSymbolsFromCache(uri).getLocalSymbolsArray();
                break;
            case Tools.SearchRange.AllSymbols:
                docSymbals = this.getFileSymbolsFromCache(uri).getAllSymbolsArray();
                break;
        }
        return docSymbals;
    }
    static getOneDocSymbolsDic(uri, luaText, range) {
        let docSymbals = [];
        this.createOneDocSymbols(uri, luaText);
        switch (range) {
            case Tools.SearchRange.GlobalSymbols:
                docSymbals = this.getFileSymbolsFromCache(uri).getGlobalSymbolsDic();
                break;
            case Tools.SearchRange.LocalSymbols:
                docSymbals = this.getFileSymbolsFromCache(uri).getLocalSymbolsDic();
                break;
            case Tools.SearchRange.AllSymbols:
                docSymbals = this.getFileSymbolsFromCache(uri).getAllSymbolsDic();
                break;
        }
        return docSymbals;
    }
    static getOneDocReturnSymbol(uri) {
        this.createOneDocSymbols(uri);
        let docSymbals = this.docSymbolMap.get(uri);
        if (docSymbals) {
            return docSymbals.getFileReturnArray();
        }
        else {
            return null;
        }
    }
    static createFolderSymbols(path) {
        if (path === undefined || path === '') {
            return;
        }
        let filesArray = Tools.getDirFiles(path);
        filesArray.forEach(pathArray => {
            let uri = Tools.pathToUri(pathArray);
            if (!this.docSymbolMap.has(uri)) {
                this.createDocSymbol(uri, pathArray);
            }
        });
    }
    static refreshFolderSymbols(path) {
        if (path === undefined || path === '') {
            return;
        }
        let filesArray = Tools.getDirFiles(path);
        filesArray.forEach(element => {
            this.createDocSymbol(element);
        });
    }
    static createLuaPreloadSymbols(path) {
        if (path === undefined || path === '') {
            return;
        }
        let filesArray = Tools.getDirFiles(path);
        filesArray.forEach(pathElement => {
            this.createPreLoadSymbals(Tools.pathToUri(pathElement), 0);
        });
    }
    static refreshUserPreloadSymbals(path) {
        if (path === undefined || path === '') {
            return;
        }
        let filesArray = Tools.getDirFiles(path);
        filesArray.forEach(pathElement => {
            this.createPreLoadSymbals(Tools.pathToUri(pathElement), 1);
        });
    }
    static refreshOneUserPreloadDocSymbols(filePath) {
        if (filePath === undefined || filePath === '') {
            return;
        }
        this.createPreLoadSymbals(Tools.pathToUri(filePath), 1);
    }
    static getWorkspaceSymbols(range) {
        range = range || Tools.SearchRange.AllSymbols;
        let filesMap = Tools.get_FileName_Uri_Cache();
        let g_symb = {};
        for (const fileUri in filesMap) {
            if (!Tools.isinPreloadFolder(filesMap[fileUri])) {
                let g_s = this.getOneDocSymbolsDic(filesMap[fileUri], null, range);
                for (const key in g_s) {
                    const element = g_s[key];
                    g_symb[key] = element;
                }
            }
        }
        return g_symb;
    }
    static searchSymbolReferenceinDoc(searchSymbol) {
        let uri = searchSymbol.containerURI;
        let docSymbals = this.getFileSymbolsFromCache(uri);
        return docSymbals.searchDocSymbolReference(searchSymbol);
    }
    static searchSymbolinDoc(uri, symbolStr, searchMethod, range = Tools.SearchRange.AllSymbols) {
        if (symbolStr === '' || uri === '') {
            return null;
        }
        let docSymbals = this.getFileSymbolsFromCache(uri);
        ;
        let retSymbols = docSymbals.searchMatchSymbal(symbolStr, searchMethod, range);
        return retSymbols;
    }
    static getFileSymbolsFromCache(uri) {
        let docSymbals = this.docSymbolMap.get(uri);
        if (!docSymbals) {
            docSymbals = this.userPreloadSymbolMap.get(uri);
        }
        if (!docSymbals) {
            docSymbals = this.luaPreloadSymbolMap.get(uri);
        }
        return docSymbals;
    }
    static searchSymbolinWorkSpace(symbolStr, searchMethod = Tools.SearchMode.FuzzyMatching, searchRange = Tools.SearchRange.AllSymbols, isSearchPreload = false, useAlreadySearchList = false) {
        if (symbolStr === '') {
            return [];
        }
        let retSymbols = [];
        for (let [key, value] of this.docSymbolMap) {
            if (useAlreadySearchList) {
                if (this.alreadySearchList[key]) {
                    continue;
                }
            }
            let docSymbals = value.searchMatchSymbal(symbolStr, searchMethod, searchRange);
            retSymbols = retSymbols.concat(docSymbals);
        }
        if (isSearchPreload) {
            let preS = this.searchUserPreLoadSymbols(symbolStr, searchMethod);
            retSymbols = retSymbols.concat(preS);
            preS = this.searchLuaPreLoadSymbols(symbolStr, searchMethod);
            retSymbols = retSymbols.concat(preS);
        }
        return retSymbols;
    }
    static searchSymbolforGlobalDefinition(uri, symbolStr, searchMethod = Tools.SearchMode.ExactlyEqual, searchRange = Tools.SearchRange.GlobalSymbols) {
        if (symbolStr === '' || uri === '') {
            return [];
        }
        let retSymbols = [];
        CodeSymbol.alreadySearchList = new Object();
        let preS = this.recursiveSearchRequireTree(uri, symbolStr, searchMethod, searchRange);
        if (preS) {
            retSymbols = retSymbols.concat(preS);
        }
        if (retSymbols.length === 0) {
            let preS0 = this.searchSymbolinWorkSpace(symbolStr, searchMethod, Tools.SearchRange.GlobalSymbols, codeSettings_1.CodeSettings.isAllowDefJumpPreload, true);
            if (preS0) {
                retSymbols = retSymbols.concat(preS0);
            }
        }
        return retSymbols;
    }
    static searchSymbolforCompletion(uri, symbolStr, searchMethod = Tools.SearchMode.PrefixMatch, searchRange = Tools.SearchRange.AllSymbols) {
        if (symbolStr === '' || uri === '') {
            return [];
        }
        let retSymbols = [];
        CodeSymbol.alreadySearchList = new Object();
        let preS = this.recursiveSearchRequireTree(uri, symbolStr, searchMethod, searchRange);
        if (preS) {
            retSymbols = retSymbols.concat(preS);
        }
        let preS0 = this.searchSymbolinWorkSpace(symbolStr, searchMethod, Tools.SearchRange.GlobalSymbols, true, true);
        if (preS0) {
            retSymbols = retSymbols.concat(preS0);
        }
        return retSymbols;
    }
    static searchLuaPreLoadSymbols(symbolStr, searchMethod) {
        if (!symbolStr || symbolStr === '') {
            return [];
        }
        let retSymbols = new Array();
        this.luaPreloadSymbolMap.forEach(element => {
            let res = element.searchMatchSymbal(symbolStr, searchMethod, Tools.SearchRange.GlobalSymbols);
            if (res.length > 0) {
                retSymbols = retSymbols.concat(res);
            }
        });
        return retSymbols;
    }
    static searchUserPreLoadSymbols(symbolStr, searchMethod) {
        if (!symbolStr || symbolStr === '') {
            return [];
        }
        let retSymbols = new Array();
        this.userPreloadSymbolMap.forEach(element => {
            let res = element.searchMatchSymbal(symbolStr, searchMethod, Tools.SearchRange.GlobalSymbols);
            if (res.length > 0) {
                retSymbols = retSymbols.concat(res);
            }
        });
        return retSymbols;
    }
    static updateReference(oldDocSymbol, newDocSymbol) {
        if (!oldDocSymbol) {
            return;
        }
        newDocSymbol.setReferences(oldDocSymbol.getReferencesArray());
        let lastRequireFileArray = oldDocSymbol.getRequiresArray();
        let currentRequireFiles = newDocSymbol.getRequiresArray();
        lastRequireFileArray.forEach((lastRequireFile) => {
            let needDeleteReference = true;
            currentRequireFiles.forEach((currentRequireFile) => {
                if (currentRequireFile.reqName == lastRequireFile.reqName) {
                    needDeleteReference = false;
                    return;
                }
            });
            if (needDeleteReference) {
                let lastRequireFileUri = Tools.transFileNameToUri(lastRequireFile.reqName);
                if (lastRequireFileUri.length === 0)
                    return;
                let lastRequireFileDocSymbol = this.docSymbolMap.get(lastRequireFileUri);
                let lastRequireFileReference = lastRequireFileDocSymbol.getReferencesArray();
                let index = lastRequireFileReference.indexOf(newDocSymbol.getUri());
                lastRequireFileReference.splice(index, 1);
            }
        });
    }
    static createDocSymbol(uri, luaText) {
        if (uri == null)
            return;
        if (luaText == undefined) {
            luaText = Tools.getFileContent(Tools.uriToPath(uri));
        }
        let oldDocSymbol = this.getFileSymbolsFromCache(uri);
        let newDocSymbol = docSymbolProcessor_1.DocSymbolProcessor.create(luaText, uri);
        if (newDocSymbol) {
            Tools.AddTo_FileName_Uri_Cache(Tools.getPathNameAndExt(uri)['name'], uri);
            if (newDocSymbol.docInfo.parseSucc) {
                this.docSymbolMap.set(uri, newDocSymbol);
                this.updateReference(oldDocSymbol, newDocSymbol);
            }
            else {
                if (!this.getFileSymbolsFromCache(uri)) {
                    this.docSymbolMap.set(uri, newDocSymbol);
                }
                else {
                    if (!this.getFileSymbolsFromCache(uri).docInfo.parseSucc) {
                        this.docSymbolMap.set(uri, newDocSymbol);
                        this.updateReference(oldDocSymbol, newDocSymbol);
                    }
                }
            }
        }
        else {
            return;
        }
    }
    static createPreLoadSymbals(uri, type) {
        let path = Tools.uriToPath(uri);
        let luaText = Tools.getFileContent(path);
        let docSymbol = docSymbolProcessor_1.DocSymbolProcessor.create(luaText, uri);
        if (type === 0) {
            this.luaPreloadSymbolMap.set(uri, docSymbol);
        }
        else {
            this.userPreloadSymbolMap.set(uri, docSymbol);
        }
    }
    static recursiveSearchRequireTree(uri, symbolStr, searchMethod, searchRange = Tools.SearchRange.AllSymbols, isFirstEntry = true) {
        if (!uri || uri === '') {
            return [];
        }
        if (!symbolStr || symbolStr === '') {
            return [];
        }
        let retSymbArray = new Array();
        if (isFirstEntry) {
            this.deepCounter = 0;
        }
        else {
            this.deepCounter++;
            if (this.deepCounter >= 50) {
                return retSymbArray;
            }
        }
        if (!this.docSymbolMap.has(uri)) {
            codeLogManager_1.Logger.log("createDocSymbols: " + uri);
            let luaText = codeEditor_1.CodeEditor.getCode(uri);
            this.createDocSymbol(uri, luaText);
        }
        let docProcessor = this.docSymbolMap.get(uri);
        if (docProcessor == null || docProcessor.getRequiresArray == null) {
            codeLogManager_1.Logger.log("Get docProcessor or getRequireFiles error! ");
            return [];
        }
        if (this.alreadySearchList[uri] == 1) {
            return [];
        }
        else {
            this.alreadySearchList[uri] = 1;
        }
        let docS = this.docSymbolMap.get(uri);
        let retSymbols = docS.searchMatchSymbal(symbolStr, searchMethod, searchRange);
        if (retSymbols.length > 0) {
            retSymbArray = retSymbArray.concat(retSymbols);
        }
        let reqFiles = docProcessor.getRequiresArray();
        for (let idx = reqFiles.length - 1; idx >= 0; idx--) {
            let newuri = Tools.transFileNameToUri(reqFiles[idx]['reqName']);
            if (newuri.length === 0)
                return retSymbArray;
            let retSymbols = this.recursiveSearchRequireTree(newuri, symbolStr, searchMethod, searchRange, false);
            if (retSymbols != null && retSymbols.length > 0) {
                retSymbArray = retSymbArray.concat(retSymbols);
            }
        }
        let refFiles = docProcessor.getReferencesArray();
        for (let idx = refFiles.length - 1; idx >= 0; idx--) {
            let newuri = refFiles[idx];
            let retSymbols = this.recursiveSearchRequireTree(newuri, symbolStr, searchMethod, searchRange, false);
            if (retSymbols != null && retSymbols.length > 0) {
                retSymbArray = retSymbArray.concat(retSymbols);
            }
        }
        return retSymbArray;
    }
}
CodeSymbol.docSymbolMap = new Map();
CodeSymbol.luaPreloadSymbolMap = new Map();
CodeSymbol.userPreloadSymbolMap = new Map();
CodeSymbol.deepCounter = 0;
exports.CodeSymbol = CodeSymbol;
//# sourceMappingURL=codeSymbol.js.map