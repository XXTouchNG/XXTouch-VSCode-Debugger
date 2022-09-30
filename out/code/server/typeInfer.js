"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Tools = require("./codeTools");
const codeSymbol_1 = require("./codeSymbol");
const codeSettings_1 = require("./codeSettings");
class TypeInfer {
    static SymbolTagForDefinitionEntry(symbolInfo, uri) {
        let symbolName = symbolInfo.name;
        this.retArray = [];
        this.startMS = Date.now();
        this.recursiveProcessSymbolTagForDefinition(uri, symbolName, [], true);
        return this.retArray;
    }
    static SymbolTagForCompletionEntry(uri, searchPrefix) {
        this.retArray = [];
        this.startMS = Date.now();
        this.recursiveProcessSymbolTagForCompletion(uri, searchPrefix, [], true);
        return this.retArray;
    }
    static recursiveSearchTagForDefinition(element, uri, searchPrefix, tailListCache, isStripping = true) {
        let findoutArr = this.searchTag(element, uri, 0) || [];
        for (const value of findoutArr) {
            let uri = value.containerURI;
            this.recursiveProcessSymbolTagForDefinition(uri, value.searchName, tailListCache, false);
            if (value.tagType && this.retArray.length === 0) {
                this.recursiveSearchTagForDefinition(value, uri, searchPrefix, tailListCache, isStripping);
            }
        }
    }
    static recursiveSearchTagForCompletion(element, uri, searchPrefix, tailListCache, isStripping = true) {
        let findoutArr = this.searchTag(element, uri, 1) || [];
        if (findoutArr.length > this.maxSymbolCount)
            findoutArr.length = this.maxSymbolCount;
        for (const value of findoutArr) {
            let uri = value.containerURI;
            this.recursiveProcessSymbolTagForCompletion(uri, value.searchName, tailListCache, false);
            if (value.tagType) {
                this.recursiveSearchTagForCompletion(value, uri, searchPrefix, tailListCache, isStripping);
            }
        }
    }
    static recursiveProcessSymbolTagForDefinition(uri, searchPrefix, tailListCache, isStripping = true) {
        if (isStripping) {
            if (codeSettings_1.CodeSettings.isOpenDebugCode === false) {
                if (this.startMS + 2000 < Date.now())
                    return;
            }
            let searchPrefixArray = Tools.splitToArrayByDot(searchPrefix);
            for (let index = searchPrefixArray.length - 1; index >= 0; index--) {
                tailListCache.push(searchPrefixArray.pop());
                let SCHName = searchPrefixArray.join('.');
                let findTagRetSymbArray = this.searchMethodforDef(uri, SCHName);
                if (!findTagRetSymbArray || findTagRetSymbArray.length == 0)
                    continue;
                if (findTagRetSymbArray.length > this.maxSymbolCount)
                    findTagRetSymbArray.length = this.maxSymbolCount;
                for (const key in findTagRetSymbArray) {
                    let uri = findTagRetSymbArray[key].containerURI;
                    this.recursiveSearchTagForDefinition(findTagRetSymbArray[key], uri, searchPrefix, tailListCache, isStripping);
                }
            }
        }
        else {
            let temptailCache = tailListCache.concat();
            let newName = searchPrefix + '.' + temptailCache.pop();
            let addPrefixSearchArray = this.searchMethodforComp(uri, newName, Tools.SearchMode.ExactlyEqual);
            if (addPrefixSearchArray.length > this.maxSymbolCount)
                addPrefixSearchArray.length = this.maxSymbolCount;
            for (const element of addPrefixSearchArray) {
                if (element.tagType) {
                    this.retArray.push(element);
                }
                else {
                    if (temptailCache.length > 0) {
                        this.recursiveProcessSymbolTagForDefinition(uri, newName, temptailCache, false);
                    }
                    else {
                        this.retArray.push(element);
                    }
                }
            }
        }
    }
    static recursiveProcessSymbolTagForCompletion(uri, searchPrefix, tailListCache, isStripping = true) {
        if (isStripping) {
            if (codeSettings_1.CodeSettings.isOpenDebugCode === false) {
                if (this.startMS + 2000 < Date.now())
                    return;
            }
            let searchPrefixArray = Tools.splitToArrayByDot(searchPrefix);
            for (let index = searchPrefixArray.length - 1; index > 0; index--) {
                tailListCache.push(searchPrefixArray.pop());
                let SCHName = searchPrefixArray.join('.');
                let findTagRetSymbArray = this.searchMethodforComp(uri, SCHName);
                if (!findTagRetSymbArray || findTagRetSymbArray.length == 0)
                    continue;
                if (findTagRetSymbArray.length > this.maxSymbolCount)
                    findTagRetSymbArray.length = this.maxSymbolCount;
                for (const key in findTagRetSymbArray) {
                    let uri = findTagRetSymbArray[key].containerURI;
                    this.recursiveSearchTagForCompletion(findTagRetSymbArray[key], uri, searchPrefix, tailListCache, isStripping);
                }
            }
        }
        else {
            let temptailCache = tailListCache.concat();
            let newName = searchPrefix + '.' + temptailCache.pop();
            let addPrefixSearchArray = this.searchMethodforComp(uri, newName, Tools.SearchMode.PrefixMatch);
            for (const element of addPrefixSearchArray) {
                if (element.tagType) {
                    this.retArray.push(element);
                }
                else {
                    if (temptailCache.length > 0) {
                        this.recursiveProcessSymbolTagForCompletion(uri, newName, temptailCache, false);
                    }
                    else {
                        this.retArray.push(element);
                    }
                }
            }
        }
    }
    static searchMethodCommon(uri, SCHName, method = Tools.SearchMode.ExactlyEqual, operation) {
        if (operation === 0) {
            return this.searchMethodforDef(uri, SCHName, method) || [];
        }
        else if (operation === 1) {
            return this.searchMethodforComp(uri, SCHName, method) || [];
        }
    }
    static searchMethodforComp(uri, SCHName, method = Tools.SearchMode.ExactlyEqual) {
        let findTagRetSymbArray = codeSymbol_1.CodeSymbol.searchSymbolinDoc(uri, SCHName, method);
        if (findTagRetSymbArray == null || (findTagRetSymbArray && findTagRetSymbArray.length <= 0)) {
            findTagRetSymbArray = codeSymbol_1.CodeSymbol.searchSymbolforCompletion(uri, SCHName, method, Tools.SearchRange.GlobalSymbols) || [];
        }
        return findTagRetSymbArray;
    }
    static searchMethodforDef(uri, SCHName, method = Tools.SearchMode.ExactlyEqual) {
        let findTagRetSymbArray = codeSymbol_1.CodeSymbol.searchSymbolinDoc(uri, SCHName, method);
        if (findTagRetSymbArray == null || (findTagRetSymbArray && findTagRetSymbArray.length <= 0)) {
            findTagRetSymbArray = codeSymbol_1.CodeSymbol.searchSymbolforGlobalDefinition(uri, SCHName, method, Tools.SearchRange.GlobalSymbols) || [];
        }
        return findTagRetSymbArray;
    }
    static searchTag(element, uri, operation) {
        let findoutSymbs;
        if (element.tagType && (element.tagReason === Tools.TagReason.UserTag || element.tagReason === Tools.TagReason.Equal)) {
            findoutSymbs = this.searchUserTag(uri, element, operation);
        }
        else if (element.tagType && element.tagReason == Tools.TagReason.MetaTable) {
            findoutSymbs = this.searchMetaTable(uri, element, operation);
        }
        else if (element.requireFile && element.requireFile.length > 0) {
            findoutSymbs = this.searchRequire(element);
        }
        else if (element.funcRets) {
            findoutSymbs = this.searchFunctionReturn(element);
        }
        else if (element.chunk && element.chunk.returnSymbol) {
            let chunkRet = element.chunk.returnSymbol;
            findoutSymbs = this.searchMethodCommon(uri, chunkRet, Tools.SearchMode.ExactlyEqual, operation);
        }
        for (const iterator in findoutSymbs) {
            if (findoutSymbs[iterator] === element) {
                findoutSymbs.splice(iterator, 1);
                break;
            }
        }
        return findoutSymbs;
    }
    static searchRequire(element) {
        let beRequiredUri = Tools.transFileNameToUri(element.requireFile);
        if (beRequiredUri.length === 0)
            return;
        let beRequiredFilesRet = codeSymbol_1.CodeSymbol.getOneDocReturnSymbol(beRequiredUri);
        if (beRequiredFilesRet && beRequiredFilesRet.length > 0) {
            let searchReturnSymbolInBeReqFile = codeSymbol_1.CodeSymbol.searchSymbolinDoc(beRequiredUri, beRequiredFilesRet, Tools.SearchMode.ExactlyEqual);
            return searchReturnSymbolInBeReqFile;
        }
        return [];
    }
    static searchFunctionReturn(element) {
        let uri = element.containerURI;
        let searchName = element.funcRets.name;
        let returnFuncList = codeSymbol_1.CodeSymbol.searchSymbolinDoc(uri, searchName, Tools.SearchMode.ExactlyEqual);
        if (returnFuncList == null || (returnFuncList && returnFuncList.length <= 0)) {
            returnFuncList = codeSymbol_1.CodeSymbol.searchSymbolforCompletion(uri, searchName, Tools.SearchMode.ExactlyEqual);
        }
        let retrunSymbol = new Array();
        if (returnFuncList && returnFuncList.length == 0) {
            let tempRetArray = this.retArray;
            this.retArray = [];
            this.recursiveProcessSymbolTagForDefinition(uri, searchName, []);
            if (this.retArray.length > 0) {
                returnFuncList = this.retArray;
                this.retArray = tempRetArray;
            }
        }
        if (returnFuncList && returnFuncList.length > 0) {
            const retFuncSymbol = returnFuncList[0];
            let chunks = codeSymbol_1.CodeSymbol.getCretainDocChunkDic(retFuncSymbol.containerURI);
            if (chunks[retFuncSymbol.searchName]) {
                let chunkRetSymbolName = chunks[retFuncSymbol.searchName].returnSymbol;
                if (retFuncSymbol.tagType !== undefined && retFuncSymbol.tagReason === Tools.TagReason.UserTag) {
                    chunkRetSymbolName = retFuncSymbol.tagType;
                }
                retrunSymbol = codeSymbol_1.CodeSymbol.searchSymbolinDoc(retFuncSymbol.containerURI, chunkRetSymbolName, Tools.SearchMode.ExactlyEqual);
                if (retrunSymbol == null || (retrunSymbol && retrunSymbol.length <= 0)) {
                    retrunSymbol = codeSymbol_1.CodeSymbol.searchSymbolforCompletion(retFuncSymbol.containerURI, chunkRetSymbolName, Tools.SearchMode.ExactlyEqual);
                }
                return retrunSymbol;
            }
        }
    }
    static searchUserTag(uri, element, operation) {
        let tag_type = element.tagType;
        if (tag_type) {
            return this.searchMethodCommon(uri, tag_type, Tools.SearchMode.ExactlyEqual, operation);
        }
        else {
            return [];
        }
    }
    static searchMetaTable(uri, element, operation) {
        let tag_type = element.tagType + ".__index";
        if (tag_type) {
            let index_symbol = this.searchMethodCommon(uri, tag_type, Tools.SearchMode.ExactlyEqual, operation);
            for (const element of index_symbol) {
                if (!element.tagType) {
                    continue;
                }
                let searchName = element.tagType;
                let tagRes = this.searchMethodCommon(element.containerURI, searchName, Tools.SearchMode.ExactlyEqual, operation);
                if (tagRes) {
                    return tagRes;
                }
            }
        }
        return [];
    }
}
TypeInfer.retArray = [];
TypeInfer.maxSymbolCount = 1;
exports.TypeInfer = TypeInfer;
//# sourceMappingURL=typeInfer.js.map