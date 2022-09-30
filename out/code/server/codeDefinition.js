"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const codeLogManager_1 = require("./codeLogManager");
const codeSymbol_1 = require("./codeSymbol");
const typeInfer_1 = require("./typeInfer");
const Tools = require("./codeTools");
const util_1 = require("util");
class CodeDefinition {
    static getSymbalDefine(info, isRetSymbol) {
        isRetSymbol = isRetSymbol || false;
        Tools.transPosStartLineTo1(info.position);
        let uri = info.textDocument.uri;
        let astContainer = codeSymbol_1.CodeSymbol.docSymbolMap.get(uri);
        if (!astContainer) {
            codeLogManager_1.Logger.InfoLog("[Error] getSymbalDefine cannot find AST. ");
            return null;
        }
        let symbRet = astContainer.searchDocSymbolfromPosition(info.position);
        if (symbRet != undefined && symbRet['sybinfo'] != undefined) {
            let symbolInfo = symbRet['sybinfo'];
            let containerList = symbRet['container'];
            if (symbolInfo.name.match(':')) {
                symbolInfo.name = symbolInfo.name.replace(/:/g, ".");
            }
            let symbInstance = this.directSearch(uri, symbolInfo.name, Tools.SearchMode.ExactlyEqual);
            if (util_1.isArray(symbInstance) && symbInstance.length > 0) {
            }
            else {
                symbInstance = typeInfer_1.TypeInfer.SymbolTagForDefinitionEntry(symbolInfo, uri);
            }
            if (!symbInstance || symbInstance.length == 0)
                return;
            Tools.transPosStartLineTo0(info.position);
            let finalRetSymbols;
            if (symbolInfo.isLocal) {
                finalRetSymbols = this.judgeLocalDefinition(symbInstance, containerList, info);
                if (!finalRetSymbols && symbInstance && symbInstance.length > 0) {
                    finalRetSymbols = symbInstance[0];
                }
            }
            else {
                finalRetSymbols = symbInstance[0];
            }
            if (!finalRetSymbols)
                return;
            if (isRetSymbol)
                return finalRetSymbols;
            let retLoc = vscode_languageserver_1.Location.create(finalRetSymbols['containerURI'], finalRetSymbols['location'].range);
            return retLoc;
        }
        else {
            let reqFileName = astContainer.searchDocRequireFileNameFromPosition(info.position);
            let uri = Tools.transFileNameToUri(reqFileName);
            if (uri.length > 0) {
                return Tools.createEmptyLocation(uri);
            }
            return;
        }
    }
    static directSearch(uri, symbolStr, method) {
        let ret = codeSymbol_1.CodeSymbol.searchSymbolinDoc(uri, symbolStr, method) || [];
        if (ret.length === 0) {
            ret = codeSymbol_1.CodeSymbol.searchSymbolforGlobalDefinition(uri, symbolStr, method, Tools.SearchRange.GlobalSymbols) || [];
        }
        return ret;
    }
    static judgeLocalDefinition(findoutSymbols, containerList, docPosition) {
        if (!findoutSymbols || findoutSymbols.length <= 0 || !docPosition || !containerList || containerList.length <= 0)
            return;
        if (findoutSymbols.length == 1)
            return findoutSymbols[0];
        let commonDepth = this.findCommonDepth(containerList, findoutSymbols);
        let maxComDep = 0;
        for (let index = 0; index < commonDepth.length; index++) {
            if (maxComDep < commonDepth[index]) {
                maxComDep = commonDepth[index];
            }
        }
        let maxArray = new Array();
        for (let index = 0; index < commonDepth.length; index++) {
            if (maxComDep == commonDepth[index]) {
                maxArray.push(findoutSymbols[index]);
            }
        }
        if (maxArray.length == 1) {
            return maxArray[0];
        }
        return this.findUpNearestSymbol(docPosition.position, maxArray);
    }
    static findUpNearestSymbol(docPosition, maxArray) {
        let distanceLineNumber = new Array();
        let standardLine = docPosition.line;
        for (const key in maxArray) {
            const element = maxArray[key];
            let upLine = element.location.range.start.line;
            distanceLineNumber[key] = standardLine - upLine;
        }
        let minComDep = 99999;
        for (let index = 0; index < distanceLineNumber.length; index++) {
            if (distanceLineNumber[index] < minComDep && distanceLineNumber[index] >= 0) {
                minComDep = distanceLineNumber[index];
            }
        }
        let minSymbolIdx = 0;
        for (let index = 0; index < distanceLineNumber.length; index++) {
            if (minComDep == distanceLineNumber[index]) {
                minSymbolIdx = index;
                break;
            }
        }
        return maxArray[minSymbolIdx];
    }
    static findCommonDepth(standradDepth, beFindSymbolList) {
        let retArray = new Array();
        for (const key in beFindSymbolList) {
            const element = beFindSymbolList[key];
            if (standradDepth.length < element.containerList.length) {
                retArray[key] = -1;
                continue;
            }
            for (let index = 0; index < standradDepth.length; index++) {
                let standardChunk = standradDepth[index];
                let beAnalyzeDepth = element.containerList[index];
                if (standardChunk && beAnalyzeDepth && standardChunk.chunkName == beAnalyzeDepth.chunkName && standardChunk.loc.start.line == beAnalyzeDepth.loc.start.line && standardChunk.loc.end.line == beAnalyzeDepth.loc.end.line) {
                    retArray[key] = index + 1;
                }
                else {
                    if (standardChunk && !beAnalyzeDepth) {
                    }
                    else {
                        retArray[key] = -1;
                    }
                }
            }
        }
        return retArray;
    }
    static getFunctionInfoByLine(uri, line) {
        let displaySymbolArray = codeSymbol_1.CodeSymbol.getOneDocSymbolsArray(uri, null, Tools.SearchRange.AllSymbols);
        let result = { functionName: "", functionParam: [] };
        for (const key in displaySymbolArray) {
            const docDisplaySymbol = displaySymbolArray[key];
            if (docDisplaySymbol.kind == vscode_languageserver_1.SymbolKind.Function && docDisplaySymbol.location.range.start.line == line) {
                result.functionName = docDisplaySymbol.searchName;
                result.functionParam = docDisplaySymbol.funcParamArray;
                return result;
            }
        }
        return result;
    }
}
exports.CodeDefinition = CodeDefinition;
//# sourceMappingURL=codeDefinition.js.map