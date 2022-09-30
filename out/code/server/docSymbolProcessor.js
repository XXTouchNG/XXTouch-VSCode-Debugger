"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luaparse = require("luaparse");
const Tools = require("./codeTools");
const codeLogManager_1 = require("./codeLogManager");
const codeSymbol_1 = require("./codeSymbol");
const vscode_languageserver_1 = require("vscode-languageserver");
const trieTree_1 = require("./trieTree");
const util_1 = require("util");
var travelMode;
(function (travelMode) {
    travelMode[travelMode["BUILD"] = 0] = "BUILD";
    travelMode[travelMode["GET_DEFINE"] = 1] = "GET_DEFINE";
    travelMode[travelMode["FIND_REFS"] = 2] = "FIND_REFS";
})(travelMode || (travelMode = {}));
class DocSymbolProcessor {
    static create(luaText, uri) {
        let instance = new DocSymbolProcessor();
        let path = Tools.uriToPath(uri);
        try {
            let AST = luaparse.parse(luaText, { locations: true, scope: true, comments: true });
            instance.docInfo = new Tools.docInformation(AST, uri, path);
            instance.buildDocDefineSymbols();
            instance.docInfo.parseSucc = true;
            return instance;
        }
        catch (error) {
            instance.docInfo = new Tools.docInformation(new Object, uri, path);
            DocSymbolProcessor.tempSaveInstance = instance;
            try {
                luaparse.parse(luaText, { locations: true, scope: true, onCreateNode: instance.onCreateNode });
            }
            catch (_a) { }
            instance.docInfo.parseSucc = false;
            return instance;
        }
    }
    getUri() {
        return this.docInfo.docUri;
    }
    getAllSymbolsDic() {
        return this.docInfo.defineSymbols.allSymbols;
    }
    getAllSymbolsTrie() {
        return this.docInfo.defineSymbols.allSymbolsTrie;
    }
    getGlobalSymbolsDic() {
        return this.docInfo.defineSymbols.globalSymbols;
    }
    getLocalSymbolsDic() {
        return this.docInfo.defineSymbols.localSymbols;
    }
    getChunksDic() {
        return this.docInfo.defineSymbols.chunks;
    }
    getAllSymbolsArray() {
        return this.docInfo.defineSymbols.allSymbolsArray;
    }
    getGlobalSymbolsArray() {
        return this.docInfo.defineSymbols.globalSymbolsArray;
    }
    getGlobalSymbolsTrie() {
        return this.docInfo.defineSymbols.globalSymbolsTrie;
    }
    getLocalSymbolsArray() {
        return this.docInfo.defineSymbols.localSymbolsArray;
    }
    getLocalSymbolsTrie() {
        return this.docInfo.defineSymbols.localSymbolsTrie;
    }
    getChunksArray() {
        return this.docInfo.defineSymbols.chunksArray;
    }
    getFileReturnArray() {
        let chunks = this.docInfo.defineSymbols.chunks;
        return chunks[this.docInfo.docPath].returnSymbol;
    }
    getRequiresArray() {
        return this.docInfo.requires;
    }
    getReferencesArray() {
        return this.docInfo.references;
    }
    setReferences(references) {
        return this.docInfo.references = references;
    }
    buildSymbolTrie() {
        let all = this.getAllSymbolsArray();
        this.docInfo.defineSymbols.allSymbolsTrie = trieTree_1.trieTree.createSymbolTree(all);
        let global = this.getGlobalSymbolsArray();
        this.docInfo.defineSymbols.globalSymbolsTrie = trieTree_1.trieTree.createSymbolTree(global);
        let local = this.getLocalSymbolsArray();
        this.docInfo.defineSymbols.localSymbolsTrie = trieTree_1.trieTree.createSymbolTree(local);
    }
    buildDocDefineSymbols() {
        let deepLayer = new Array();
        this.docCommentType = new Array();
        this.callFunctionRecoder = new Array();
        this.traversalAST(this.docInfo["docAST"], travelMode.BUILD, deepLayer);
        this.processRequireArrayPath();
        this.buildSymbolTag();
        this.buildSymbolReturns();
        this.buildSymbolTrie();
    }
    searchDocSymbolfromPosition(pos) {
        this.searchPosition = pos;
        let container = new Array();
        this.posSearchRet = new Tools.searchRet();
        this.traversalAST(this.docInfo["docAST"], travelMode.GET_DEFINE, container);
        return { sybinfo: this.posSearchRet.retSymbol, container: container };
    }
    searchDocSymbolReference(info) {
        this.searchInfo = info;
        this.refsLink = new Array();
        this.traversalAST(this.docInfo["docAST"], travelMode.FIND_REFS, new Array());
        return this.refsLink;
    }
    searchDocRequireFileNameFromPosition(pos) {
        let reqFiles = this.getRequiresArray();
        for (let index = 0; index < reqFiles.length; index++) {
            const element = reqFiles[index];
            let res = this.isInASTLoc(element.loc, pos);
            if (res) {
                return element.reqName;
            }
        }
    }
    searchMatchSymbal(symbalName, matchMode, searchRange) {
        searchRange = searchRange || Tools.SearchRange.AllSymbols;
        let retSymbols = [];
        let SymbolArrayForSearch;
        if (matchMode === Tools.SearchMode.ExactlyEqual) {
            if (searchRange == Tools.SearchRange.AllSymbols) {
                SymbolArrayForSearch = this.getAllSymbolsDic();
            }
            else if (searchRange == Tools.SearchRange.GlobalSymbols) {
                SymbolArrayForSearch = this.getGlobalSymbolsDic();
            }
            else if (searchRange == Tools.SearchRange.LocalSymbols) {
                SymbolArrayForSearch = this.getLocalSymbolsDic();
            }
            let tgtSymbol = SymbolArrayForSearch[symbalName];
            if (tgtSymbol) {
                if (Array.isArray(tgtSymbol)) {
                    retSymbols = tgtSymbol;
                }
                else {
                    retSymbols.push(tgtSymbol);
                }
            }
        }
        else if (matchMode === Tools.SearchMode.PrefixMatch) {
            let root;
            if (searchRange == Tools.SearchRange.AllSymbols) {
                root = this.getAllSymbolsTrie();
            }
            else if (searchRange == Tools.SearchRange.GlobalSymbols) {
                root = this.getGlobalSymbolsTrie();
            }
            else if (searchRange == Tools.SearchRange.LocalSymbols) {
                root = this.getLocalSymbolsTrie();
            }
            let trieRes = trieTree_1.trieTree.searchOnTrieTreeWithoutTableChildren(root, symbalName);
            if (util_1.isArray(trieRes)) {
                retSymbols = trieRes;
            }
        }
        else if (matchMode === Tools.SearchMode.FuzzyMatching) {
            if (searchRange == Tools.SearchRange.AllSymbols) {
                SymbolArrayForSearch = this.getAllSymbolsArray();
            }
            else if (searchRange == Tools.SearchRange.GlobalSymbols) {
                SymbolArrayForSearch = this.getGlobalSymbolsArray();
            }
            else if (searchRange == Tools.SearchRange.LocalSymbols) {
                SymbolArrayForSearch = this.getLocalSymbolsArray();
            }
            for (let idx in SymbolArrayForSearch) {
                let sym = SymbolArrayForSearch[idx];
                let searchName = sym.name;
                if (searchName) {
                    let reg = new RegExp(symbalName, 'i');
                    let hit = searchName.match(reg);
                    if (hit) {
                        retSymbols.push(sym);
                    }
                }
            }
        }
        return retSymbols;
    }
    isInLocation(loc1, loc2) {
        if (loc1.range.start.line <= loc2.line && loc1.range.end.line >= loc2.line) {
            if (loc1.range.start.line === loc2.line) {
                let character = loc1.range.start.character || loc1.range.start.column;
                if (character > loc2.character)
                    return false;
            }
            if (loc1.range.end.line === loc2.line) {
                let character = loc1.range.end.character || loc1.range.end.column;
                if (character < loc2.character)
                    return false;
            }
            return true;
        }
        return false;
    }
    isInASTLoc(loc1, loc2) {
        if (loc1["start"].line <= loc2.line && loc1["end"].line >= loc2.line) {
            if (loc1.start.line === loc2.line) {
                let character = loc1.start.character || loc1.start.column;
                if (character > loc2.character)
                    return false;
            }
            if (loc1.end.line === loc2.line) {
                let character = loc1.end.character || loc1.end.column;
                if (character < loc2.character)
                    return false;
            }
            return true;
        }
        return false;
    }
    createSymbolInfo(name, searchName, originalName, kind, location, isLocal, containerName, containerList, funcParamArray, tagType, reason) {
        if (searchName.match(':')) {
            searchName = searchName.replace(/:/g, ".");
        }
        return {
            name: name,
            searchName: searchName,
            originalName: originalName,
            kind: kind,
            location: location,
            isLocal: isLocal,
            containerURI: this.docInfo["docUri"],
            containerPath: this.docInfo["docPath"],
            containerName: containerName,
            containerList: containerList,
            funcParamArray: funcParamArray,
            tagType: tagType,
            tagReason: reason
        };
    }
    checkIsSymbolExist(name) {
        if (this.getAllSymbolsDic()[name] != undefined) {
            return true;
        }
        return false;
    }
    pushToAllList(symbol) {
        if (this.docInfo.defineSymbols.allSymbols[symbol.searchName]) {
            let travlSymbol = this.docInfo.defineSymbols.allSymbols[symbol.searchName];
            if (Array.isArray(travlSymbol)) {
                travlSymbol.push(symbol);
            }
            else {
                let newArray = new Array();
                newArray.push(travlSymbol);
                newArray.push(symbol);
                this.docInfo.defineSymbols.allSymbols[symbol.searchName] = newArray;
            }
        }
        else {
            this.docInfo.defineSymbols.allSymbols[symbol.searchName] = symbol;
        }
        this.docInfo.defineSymbols.allSymbolsArray.push(symbol);
    }
    pushToLocalList(symbol) {
        if (this.docInfo.defineSymbols.localSymbols[symbol.searchName]) {
            let travlSymbol = this.docInfo.defineSymbols.localSymbols[symbol.searchName];
            if (Array.isArray(travlSymbol)) {
                travlSymbol.push(symbol);
            }
            else {
                let newArray = new Array();
                newArray.push(travlSymbol);
                newArray.push(symbol);
                this.docInfo.defineSymbols.localSymbols[symbol.searchName] = newArray;
            }
        }
        else {
            this.docInfo.defineSymbols.localSymbols[symbol.searchName] = symbol;
        }
        this.docInfo.defineSymbols.localSymbolsArray.push(symbol);
    }
    pushToGlobalList(symbol) {
        if (this.docInfo.defineSymbols.globalSymbols[symbol.searchName]) {
            let travlSymbol = this.docInfo.defineSymbols.globalSymbols[symbol.searchName];
            if (Array.isArray(travlSymbol)) {
                travlSymbol.push(symbol);
            }
            else {
                let newArray = new Array();
                newArray.push(travlSymbol);
                newArray.push(symbol);
                this.docInfo.defineSymbols.globalSymbols[symbol.searchName] = newArray;
            }
        }
        else {
            this.docInfo.defineSymbols.globalSymbols[symbol.searchName] = symbol;
        }
        this.docInfo.defineSymbols.globalSymbolsArray.push(symbol);
    }
    pushToAutoList(symbol) {
        if (symbol.isLocal) {
            this.pushToLocalList(symbol);
        }
        else {
            this.pushToGlobalList(symbol);
        }
        this.pushToAllList(symbol);
    }
    pushToChunkList(name, chunk) {
        if (name.match(':')) {
            if (!name.match(new RegExp(/^\w:[\\\/]/))) {
                name = name.replace(/:/g, ".");
            }
        }
        if (this.docInfo.defineSymbols["chunks"][name]) {
            let travlSymbol = this.docInfo.defineSymbols["chunks"][name];
            if (Array.isArray(travlSymbol)) {
                travlSymbol.push(chunk);
            }
            else {
                let newArray = new Array();
                newArray.push(travlSymbol);
                newArray.push(chunk);
                this.docInfo.defineSymbols["chunks"][name] = newArray;
            }
        }
        else {
            this.docInfo.defineSymbols["chunks"][name] = chunk;
        }
        this.docInfo.defineSymbols.chunksArray.push(chunk);
    }
    pushToCommentList(cmt) {
        this.docCommentType.push(cmt);
    }
    recordFuncCall(cmt) {
        this.callFunctionRecoder.push(cmt);
    }
    traversalAST(node, type, deepLayer, prefix, isBody) {
        if (Array.isArray(node) === true) {
            let ASTArray = Array.prototype.slice.call(node);
            for (let idx = 0, len = ASTArray.length; idx < len; idx++) {
                this.traversalAST(ASTArray[idx], type, deepLayer, prefix, isBody);
                if (this.posSearchRet && this.posSearchRet.isFindout)
                    return;
            }
        }
        else {
            let nodeType = node["type"];
            switch (nodeType) {
                case 'Chunk':
                    this.processChunk(node, type, deepLayer, prefix);
                    break;
                case 'LocalStatement':
                    this.LocalStatement(node, type, deepLayer, prefix);
                    break;
                case 'FunctionDeclaration':
                    this.processFunction(node, type, deepLayer, prefix);
                    break;
                case 'AssignmentStatement':
                    this.processAssignment(node, type, deepLayer, prefix);
                    break;
                case 'CallExpression':
                    this.processCallExpression(node, type, deepLayer, prefix);
                    break;
                case 'StringCallExpression':
                    this.processStringCallExpression(node, type, deepLayer, prefix);
                    break;
                case 'CallStatement':
                    this.processCallStatement(node, type, deepLayer, prefix);
                    break;
                case 'WhileStatement':
                    this.processWhileStatement(node, type, deepLayer, prefix);
                    break;
                case 'RepeatStatement':
                    this.processRepeatStatement(node, type, deepLayer, prefix);
                    break;
                case 'IfStatement':
                    this.processIfStatement(node, type, deepLayer, prefix);
                    break;
                case 'ReturnStatement':
                    this.processReturnStatement(node, type, deepLayer, prefix, isBody);
                    break;
                case 'ForNumericStatement':
                    this.processForNumericStatement(node, type, deepLayer, prefix);
                    break;
                case 'ForGenericStatement':
                    this.processForGenericStatement(node, type, deepLayer, prefix);
                    break;
                case 'BinaryExpression':
                    this.processBinaryExpression(node, type, deepLayer, prefix);
                    break;
                case 'UnaryExpression':
                    this.processUnaryExpression(node, type, deepLayer, prefix);
                    break;
                case 'MemberExpression':
                    this.processMemberExpression(node, type, deepLayer, prefix);
                    break;
                case 'IndexExpression':
                    this.processIndexExpression(node, type, deepLayer, prefix);
                    break;
                case 'Identifier':
                    this.processIdentifier(node, type, deepLayer, prefix);
                    break;
            }
        }
        if (this.posSearchRet && this.posSearchRet.isFindout)
            return;
    }
    onCreateNode(node) {
        let deepLayer = new Array();
        if (node['type'] == 'CallExpression' || node['type'] == 'StringCallExpression') {
            DocSymbolProcessor.tempSaveInstance.traversalAST(node, travelMode.BUILD, deepLayer);
        }
        if (node['type'] == "LocalStatement") {
            DocSymbolProcessor.tempSaveInstance.traversalAST(node, travelMode.BUILD, deepLayer);
        }
        if (node['type'] == "FunctionDeclaration") {
            DocSymbolProcessor.tempSaveInstance.traversalAST(node, travelMode.BUILD, deepLayer);
        }
    }
    processComments(commentArray) {
        for (let idx = 0, len = commentArray.length; idx < len; idx++) {
            let comValue = commentArray[idx].value;
            let strArr = comValue.split(' ');
            for (let j = 0; j < strArr.length; j++) {
                const element = strArr[j];
                if (element.match('-@type') || element.match('-@return') || element.match('-@param')) {
                    let commentTypeIdx = j + 1;
                    for (let k = commentTypeIdx; k < strArr.length; k++) {
                        if (strArr[k] != '') {
                            commentTypeIdx = k;
                            break;
                        }
                    }
                    if (element.match('-@param')) {
                        let functionParameter = strArr[commentTypeIdx];
                        let newType = strArr[commentTypeIdx + 1];
                        let info = {
                            reason: Tools.TagReason.UserTag,
                            functionParameter: functionParameter,
                            newType: newType,
                            location: commentArray[idx].loc
                        };
                        this.pushToCommentList(info);
                    }
                    else {
                        let multiTypeArray = strArr[commentTypeIdx].split(',');
                        for (const multiElement of multiTypeArray) {
                            let info = {
                                reason: Tools.TagReason.UserTag,
                                newType: multiElement,
                                location: commentArray[idx].loc
                            };
                            this.pushToCommentList(info);
                        }
                    }
                    break;
                }
            }
        }
    }
    recordReference(fileUri, requireName) {
        let requireFileUri = Tools.transFileNameToUri(requireName);
        if (requireFileUri == "") {
            return;
        }
        if (codeSymbol_1.CodeSymbol.docSymbolMap.has(requireFileUri) == false) {
            codeSymbol_1.CodeSymbol.createOneDocSymbols(requireFileUri);
        }
        let references = codeSymbol_1.CodeSymbol.docSymbolMap.get(requireFileUri).getReferencesArray();
        if (references.includes(fileUri)) {
            return;
        }
        references.push(fileUri);
    }
    createRetBase(baseName, baseLocal, identifer) {
        let retBase = {
            name: baseName,
            isLocal: baseLocal,
            identiferStr: identifer
        };
        let ret = { isFindout: false, baseinfo: retBase };
        return ret;
    }
    createRetSymbol(sybName, sybisLocal, sybLocation, sybPath) {
        sybPath = sybPath || this.docInfo["docPath"];
        let retSymbol = {
            name: sybName,
            isLocal: sybisLocal,
            location: sybLocation,
            containerURI: sybPath
        };
        let ret = { isFindout: true, retSymbol: retSymbol };
        return ret;
    }
    setTagTypeToSymbolInfo(symbol, tagType, tagReason) {
        if (symbol.tagReason != undefined && symbol.tagReason == Tools.TagReason.UserTag) {
            return false;
        }
        symbol.tagType = tagType;
        symbol.tagReason = tagReason;
        return true;
    }
    buildSymbolTag() {
        let tagArray = this.docCommentType;
        for (var key in tagArray) {
            let tagInfo = tagArray[key];
            let loc = tagInfo.location;
            let reason = tagInfo.reason;
            let functionParam = tagInfo.functionParameter;
            let paramRealLine = 0;
            for (let index = 0; index < this.getAllSymbolsArray().length; index++) {
                const elm = this.getAllSymbolsArray()[index];
                if (functionParam) {
                    if (tagInfo.newType === "Type") {
                        break;
                    }
                    if (reason == Tools.TagReason.UserTag && elm.location.range.start.line + 1 > loc['end'].line) {
                        if (paramRealLine === 0) {
                            paramRealLine = elm.location.range.start.line;
                        }
                        else if (elm.location.range.start.line > paramRealLine) {
                            break;
                        }
                        if (functionParam === elm.searchName) {
                            this.setTagTypeToSymbolInfo(elm, tagInfo.newType, tagInfo.reason);
                            break;
                        }
                    }
                }
                else {
                    if (reason == Tools.TagReason.UserTag && elm.location.range.start.line + 1 === loc['end'].line) {
                        let mulitTypeIdx = 0;
                        while (this.getAllSymbolsArray()[mulitTypeIdx + index].location.range.start.line + 1 === loc['end'].line) {
                            const elm = this.getAllSymbolsArray()[mulitTypeIdx + index];
                            let res = this.setTagTypeToSymbolInfo(elm, tagInfo.newType, tagInfo.reason);
                            if (res) {
                                break;
                            }
                            else {
                                mulitTypeIdx++;
                            }
                        }
                        break;
                    }
                    if (reason == Tools.TagReason.UserTag && elm.location.range.start.line === loc['end'].line) {
                        this.setTagTypeToSymbolInfo(elm, tagInfo.newType, tagInfo.reason);
                        break;
                    }
                    if (reason == Tools.TagReason.Equal && elm.location.range.start.line + 1 === loc['end'].line) {
                        if (tagInfo.name && tagInfo.name == elm.searchName) {
                            this.setTagTypeToSymbolInfo(elm, tagInfo.newType, tagInfo.reason);
                            break;
                        }
                    }
                    if (reason == Tools.TagReason.MetaTable && elm.searchName == tagInfo.oldType) {
                        this.setTagTypeToSymbolInfo(elm, tagInfo.newType, tagInfo.reason);
                        break;
                    }
                }
            }
        }
    }
    processRequireArrayPath() {
        let reqArray = this.getRequiresArray();
        for (const reqPath of reqArray) {
            reqPath.reqName = reqPath.reqName.replace(/\./g, '/');
        }
    }
    buildSymbolReturns() {
        let reqArray = this.getRequiresArray();
        for (const element of reqArray) {
            let loc = element.loc;
            let reqName = element.reqName;
            for (let index = 0; index < this.getAllSymbolsArray().length; index++) {
                const elm = this.getAllSymbolsArray()[index];
                let aling = elm.location.range.start.line + 1;
                let bling = loc['start'].line;
                if (aling == bling) {
                    elm.requireFile = reqName;
                }
            }
        }
        for (const element of this.callFunctionRecoder) {
            let loc = element.loc;
            let funcName = element.functionName;
            for (let index = 0; index < this.getAllSymbolsArray().length; index++) {
                const elm = this.getAllSymbolsArray()[index];
                let aling = elm.location.range.start.line + 1;
                let bling = loc['start'].line;
                if (aling == bling) {
                    elm.funcRets = funcName;
                }
            }
        }
    }
    baseProcess(baseNode) {
        if (baseNode['type'] == 'MemberExpression') {
            let ret = this.baseProcess(baseNode['base']);
            if (!ret) {
                return;
            }
            let str = ret.name;
            let isLocal = ret.isLocal;
            let retStr = str + baseNode['indexer'] + baseNode['identifier']['name'];
            let retObj = { name: retStr, isLocal: isLocal, origion: baseNode['identifier']['name'] };
            return retObj;
        }
        else if (baseNode['type'] == 'Identifier') {
            return { name: baseNode['name'], isLocal: baseNode['isLocal'] };
        }
        else if (baseNode['type'] == 'StringLiteral') {
            return { name: baseNode['value'], isLocal: false };
        }
        else if (baseNode['type'] == 'NumericLiteral') {
            return { name: baseNode['value'], isLocal: false };
        }
        else if (baseNode['type'] == 'IndexExpression') {
            let ret = this.baseProcess(baseNode['base']);
            let str = ret.name;
            let isLocal = ret.isLocal;
            let retObj;
            if (baseNode['index']['type'] == "NumericLiteral") {
                let retStr = str + '[' + baseNode['index']['raw'] + ']';
                retObj = { name: retStr, isLocal: isLocal, origion: baseNode['index']['raw'] };
            }
            if (baseNode['index']['type'] == "Identifier") {
                let retStr = str + '[' + baseNode['index']['name'] + ']';
                retObj = { name: retStr, isLocal: isLocal, origion: baseNode['index']['name'] };
            }
            if (baseNode['index']['type'] == "MemberExpression") {
                let ret = this.baseProcess(baseNode['index']);
                let retStr = str + '[' + ret.name + ']';
                retObj = { name: retStr, isLocal: isLocal, origion: ret.name };
            }
            if (baseNode['index']['type'] == "IndexExpression") {
                let ret = this.baseProcess(baseNode['index']);
                let retStr = str + '[' + ret.name + ']';
                retObj = { name: retStr, isLocal: isLocal, origion: ret.name };
            }
            if (baseNode['index']['type'] == "StringLiteral") {
                let ret = this.baseProcess(baseNode['index']);
                let retStr = str + '["' + ret.name + '"]';
                retObj = { name: retStr, isLocal: isLocal, origion: ret.name };
            }
            if (baseNode['index']['type'] == "BinaryExpression") {
                let retL = this.baseProcess(baseNode['index']['left']);
                let retR = this.baseProcess(baseNode['index']['right']);
                let retStr = str + '[' + retL.name + baseNode['index'].operator + retR.name + ']';
                retObj = { name: retStr, isLocal: isLocal, origion: ret.name };
            }
            return retObj;
        }
        return { name: '', isLocal: false };
    }
    MemberExpressionFind(baseNode) {
        if (baseNode == null) {
            codeLogManager_1.Logger.log("baseNode == null");
        }
        if (baseNode['type'] == 'MemberExpression') {
            let ret = this.MemberExpressionFind(baseNode['base']);
            if (ret == null || ret.isInStat == undefined) {
                ret.isInStat = 0;
            }
            let nodeLoc = vscode_languageserver_1.Location.create(this.docInfo["docUri"], baseNode['identifier']['loc']);
            let isIn = this.isInLocation(nodeLoc, this.searchPosition);
            if (isIn === true && ret.isInStat === 0) {
                ret.isInStat = 1;
            }
            if (isIn === false && ret.isInStat === 1) {
                return ret;
            }
            let str = ret.name;
            let isLocal = ret.isLocal;
            let retStr = str + baseNode['indexer'] + baseNode['identifier']['name'];
            return { name: retStr, isLocal: isLocal, isInStat: ret.isInStat };
        }
        else if (baseNode['type'] == 'IndexExpression') {
            let ret = this.MemberExpressionFind(baseNode['base']);
            if (ret == null || ret.isInStat == undefined) {
                ret.isInStat = 0;
            }
            let nodeLoc = vscode_languageserver_1.Location.create(this.docInfo["docUri"], baseNode['index']['loc']);
            let isIn = this.isInLocation(nodeLoc, this.searchPosition);
            if (isIn === true && ret.isInStat === 0) {
                ret.isInStat = 1;
            }
            if (isIn === false && ret.isInStat === 1) {
                return ret;
            }
            let str = ret.name;
            let isLocal = ret.isLocal;
            let retStr;
            if (baseNode['index']['value']) {
                retStr = str + '.' + baseNode['index']['value'];
            }
            if (baseNode['index']['name']) {
                retStr = this.MemberExpressionFind(baseNode['index']).name;
            }
            return { name: retStr, isLocal: isLocal, isInStat: ret.isInStat };
        }
        else if (baseNode['type'] == 'CallExpression') {
            this.processCallExpression(baseNode, travelMode.GET_DEFINE, null, "call EXp");
            if (this.posSearchRet && this.posSearchRet.isFindout) {
                return { name: this.posSearchRet.retSymbol.name, isLocal: this.posSearchRet.retSymbol.isLocal, isInStat: 1 };
            }
            else {
                return { name: '', isLocal: true, isInStat: 0 };
            }
        }
        else if (baseNode['type'] == 'StringCallExpression') {
            this.processStringCallExpression(baseNode, travelMode.GET_DEFINE, null, "call EXp");
            if (this.posSearchRet && this.posSearchRet.isFindout) {
                return { name: this.posSearchRet.retSymbol.name, isLocal: this.posSearchRet.retSymbol.isLocal, isInStat: 1 };
            }
            else {
                return { name: '', isLocal: true, isInStat: 0 };
            }
        }
        else if (baseNode['type'] == 'Identifier') {
            let nodeLoc = vscode_languageserver_1.Location.create(this.docInfo["docUri"], baseNode['loc']);
            let isIn = this.isInLocation(nodeLoc, this.searchPosition);
            if (isIn === true) {
                return { name: baseNode['name'], isLocal: baseNode['isLocal'], isInStat: 1 };
            }
            else {
                return { name: baseNode['name'], isLocal: baseNode['isLocal'], isInStat: 0 };
            }
        }
    }
    processChunk(node, type, deepLayer, prefix) {
        if (type === travelMode.BUILD) {
            this.processComments(node['comments']);
            let newChunk = new Tools.chunkClass(this.docInfo["docPath"], this.docInfo.docAST.loc);
            this.pushToChunkList(this.docInfo["docPath"], newChunk);
            deepLayer.push(newChunk);
            this.traversalAST(node["body"], type, deepLayer, prefix, true);
        }
        if (type === travelMode.GET_DEFINE) {
            let newChunk = new Tools.chunkClass(this.docInfo["docPath"], this.docInfo.docAST.loc);
            deepLayer.push(newChunk);
            this.traversalAST(node["body"], type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (type === travelMode.FIND_REFS) {
            this.traversalAST(node["body"], type, deepLayer, prefix);
        }
    }
    processFunction(node, type, deepLayer, prefix) {
        let searchRes = false;
        let paraRecoder = new Array();
        if (type === travelMode.GET_DEFINE) {
            let nodeLoc = vscode_languageserver_1.Location.create(this.docInfo["docUri"], node["loc"]);
            searchRes = this.isInLocation(nodeLoc, this.searchPosition);
            if (searchRes == false) {
                this.posSearchRet = new Tools.searchRet();
            }
        }
        let searchHitPara = false;
        let searchHitParaIdx = 0;
        let paramArray = new Array();
        for (let idx = 0; idx < node["parameters"].length; idx++) {
            let paraNode = node["parameters"][idx];
            if (paraNode.type == 'VarargLiteral') {
                paramArray.push(paraNode['value']);
            }
            else {
                paramArray.push(paraNode['name']);
            }
            if (type === travelMode.GET_DEFINE && searchRes === true && searchHitPara === false) {
                let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], node["parameters"][idx]["loc"]);
                searchHitPara = this.isInLocation(nodeLoc1, this.searchPosition);
                if (searchHitPara === true) {
                    searchHitParaIdx = idx;
                    continue;
                }
            }
            if (type === travelMode.BUILD) {
                let loc = paraNode["loc"];
                let name;
                if (paraNode.type == 'VarargLiteral') {
                    name = paraNode.value;
                }
                else {
                    name = paraNode["name"];
                }
                let isLocal = true;
                let loct = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(loc["start"]["line"] - 1, loc["start"]["column"]), vscode_languageserver_1.Position.create(loc["end"]["line"] - 1, loc["end"]["column"])));
                let smbInfo = this.createSymbolInfo(name, name, name, vscode_languageserver_1.SymbolKind.Variable, loct, isLocal, prefix, deepLayer.concat());
                paraRecoder.push(smbInfo);
            }
        }
        let paramString = "(" + paramArray.join(", ") + ")";
        let newChunk;
        let functionName;
        let functionSearchName = "NONAME";
        if (node["identifier"] && node["identifier"]['type'] == 'Identifier') {
            let loc = node["identifier"]["loc"];
            functionSearchName = node["identifier"]["name"];
            functionName = "function " + functionSearchName + paramString;
            if (type === travelMode.GET_DEFINE && searchRes === true) {
                let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], loc);
                let res1 = this.isInLocation(nodeLoc1, this.searchPosition);
                if (res1 === true) {
                    this.posSearchRet = this.createRetSymbol(node["identifier"].name, node["identifier"].isLocal);
                    return;
                }
            }
            if (type === travelMode.FIND_REFS) {
                if (functionSearchName == this.searchInfo.originalName) {
                    let loc = node["identifier"]["loc"];
                    let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], loc);
                    this.refsLink.push(nodeLoc1);
                }
            }
            if (type === travelMode.BUILD) {
                let loct = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(loc["start"]["line"] - 1, loc["start"]["column"]), vscode_languageserver_1.Position.create(loc["end"]["line"] - 1, loc["end"]["column"])));
                let pushObj = this.createSymbolInfo(functionSearchName, functionSearchName, functionSearchName, vscode_languageserver_1.SymbolKind.Function, loct, node["identifier"]["isLocal"], prefix, deepLayer.concat(), paramArray);
                newChunk = new Tools.chunkClass(functionSearchName, node.loc);
                this.pushToChunkList(newChunk.chunkName, newChunk);
                pushObj.chunk = newChunk;
                this.pushToAutoList(pushObj);
            }
        }
        else if (node["identifier"] && node["identifier"]['type'] == 'MemberExpression') {
            let baseInfo = this.baseProcess(node["identifier"]);
            functionSearchName = baseInfo.name;
            functionName = 'function ' + functionSearchName + paramString;
            if (type === travelMode.GET_DEFINE && searchRes === true) {
                let bname = this.MemberExpressionFind(node["identifier"]);
                if (bname.isInStat && bname.isInStat > 0) {
                    this.posSearchRet = this.createRetSymbol(bname.name, bname.isLocal);
                    return;
                }
            }
            if (type === travelMode.FIND_REFS) {
                if (functionSearchName == this.searchInfo.originalName) {
                    let loc = node["identifier"]["loc"];
                    let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], loc);
                    this.refsLink.push(nodeLoc1);
                }
            }
            if (type === travelMode.BUILD) {
                let bname = this.baseProcess(node["identifier"]);
                let originalName = bname.origion;
                let loc = node['identifier']['loc'];
                let rg = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(loc["start"]["line"] - 1, loc["start"]["column"]), vscode_languageserver_1.Position.create(loc["end"]["line"] - 1, loc["end"]["column"])));
                let symbInfo = this.createSymbolInfo(functionName, functionSearchName, originalName, vscode_languageserver_1.SymbolKind.Function, rg, bname.isLocal, prefix, deepLayer.concat(), paramArray);
                newChunk = new Tools.chunkClass(functionSearchName, node.loc);
                this.pushToChunkList(newChunk.chunkName, newChunk);
                symbInfo.chunk = newChunk;
                this.pushToAutoList(symbInfo);
                let sepArr = bname.name.split(':');
                if (sepArr.length > 1) {
                    let tagname = sepArr[0];
                    let funcself = "self";
                    let isLocal = true;
                    let posChunk = new Tools.chunkClass(functionSearchName, node.loc);
                    deepLayer.push(posChunk);
                    let selfInfo = this.createSymbolInfo(funcself, funcself, funcself, vscode_languageserver_1.SymbolKind.Variable, rg, isLocal, prefix, deepLayer.concat(), null, tagname, Tools.TagReason.Equal);
                    this.pushToAutoList(selfInfo);
                    deepLayer.pop();
                }
            }
        }
        let posChunk = new Tools.chunkClass(functionSearchName, node.loc);
        deepLayer.push(posChunk);
        if (type === travelMode.BUILD) {
            for (let idx = 0, len = paraRecoder.length; idx < len; idx++) {
                let parainfo = paraRecoder.pop();
                parainfo.containerName = functionSearchName;
                parainfo.containerList = deepLayer.concat();
                this.pushToAllList(parainfo);
            }
        }
        if (type === travelMode.GET_DEFINE) {
            if (searchHitPara === true) {
                this.posSearchRet = this.createRetSymbol(node["parameters"][searchHitParaIdx].name, node["parameters"][searchHitParaIdx].isLocal);
                return;
            }
        }
        this.funcReturnRecoder = null;
        this.traversalAST(node["body"], type, deepLayer, functionName);
        if (type === travelMode.GET_DEFINE) {
            if (this.posSearchRet && this.posSearchRet.isFindout) {
                return;
            }
        }
        if (type === travelMode.BUILD) {
            if (this.funcReturnRecoder) {
                if (newChunk) {
                    newChunk.returnSymbol = this.funcReturnRecoder;
                }
                else {
                }
            }
        }
        deepLayer.pop();
    }
    LocalStatement(node, type, deepLayer, prefix) {
        let searchRes = false;
        let baseInfo;
        if (type === travelMode.GET_DEFINE) {
            searchRes = this.isInLocation(vscode_languageserver_1.Location.create(this.docInfo["docUri"], node["loc"]), this.searchPosition);
        }
        for (let idx = 0, len = node["variables"].length; idx < len; idx++) {
            if (type === travelMode.BUILD) {
                baseInfo = this.buildLvalueSymbals(node["variables"][idx], type, deepLayer, prefix);
            }
            if (type === travelMode.GET_DEFINE) {
                this.searchLvalueSymbals(node["variables"][idx], type, deepLayer, prefix, searchRes);
                if (this.posSearchRet && this.posSearchRet.isFindout)
                    return;
                baseInfo = this.posSearchRet.baseinfo;
            }
            if (type === travelMode.FIND_REFS) {
                this.searchLvalueSymbals(node["variables"][idx], type, deepLayer, prefix, searchRes);
            }
        }
        for (let idx = 0, len = node['init'].length; idx < len; idx++) {
            if (type === travelMode.BUILD) {
                this.buildRvalueSymbals(node['init'][idx], type, deepLayer, prefix, baseInfo);
            }
            if (type === travelMode.GET_DEFINE) {
                this.searchRvalueSymbals(node['init'][idx], type, deepLayer, prefix, baseInfo, searchRes);
                if (this.posSearchRet && this.posSearchRet.isFindout)
                    return;
            }
            if (type === travelMode.FIND_REFS) {
                this.searchRvalueSymbals(node['init'][idx], type, deepLayer, prefix, baseInfo, searchRes);
            }
        }
    }
    processCallExpisSetMetatable(node, type, arg) {
        if (type == travelMode.BUILD) {
            let len = arg.length;
            if (node["base"].type == 'Identifier' && node["base"].name == 'setmetatable' && node["base"].isLocal === false && len == 2) {
                let oldName = this.baseProcess(arg[0]);
                let newName = this.baseProcess(arg[1]);
                let info = {
                    reason: Tools.TagReason.MetaTable,
                    newType: newName.name,
                    oldType: oldName.name,
                    location: null
                };
                this.pushToCommentList(info);
            }
        }
    }
    processCallExpisFunctionCall(node, type, arg) {
        if (type == travelMode.BUILD) {
            let functionName = this.baseProcess(node['base']);
            let info = {
                functionName: functionName,
                loc: node['loc']
            };
            this.recordFuncCall(info);
        }
    }
    processCallExpisRequire(node, type, arg) {
        if (type == travelMode.BUILD) {
            let len = arg.length;
            if (node["base"].type == 'Identifier' && node["base"].name == 'require' && node["base"].isLocal === false && len == 1) {
                if (arg[0].type == 'StringLiteral' && arg[0].value) {
                    let info = { reqName: arg[0].value, loc: arg[0].loc };
                    this.docInfo.requires.push(info);
                    this.recordReference(this.docInfo["docUri"], arg[0].value);
                }
            }
        }
    }
    processStringCallExpisRequire(node, type, arg) {
        if (type == travelMode.BUILD) {
            if (arg.type == 'StringLiteral' && arg.value) {
                let info = { reqName: arg.value, loc: arg.loc };
                this.docInfo["requires"].push(info);
                this.recordReference(this.docInfo["docUri"], arg.value);
            }
        }
    }
    processStringCallExpression(node, type, deepLayer, prefix) {
        if (type == travelMode.BUILD) {
            this.processStringCallExpisRequire(node, type, node['argument']);
        }
        if (type == travelMode.GET_DEFINE) {
            let bname = this.MemberExpressionFind(node["base"]);
            if (bname.isInStat && bname.isInStat > 0) {
                this.posSearchRet = this.createRetSymbol(bname.name, bname.isLocal);
                return;
            }
        }
    }
    processCallExpression(node, type, deepLayer, prefix) {
        let varArray = Array.prototype.slice.call(node['arguments']);
        let len = varArray.length;
        this.processCallExpisRequire(node, type, varArray);
        this.processCallExpisSetMetatable(node, type, varArray);
        this.processCallExpisFunctionCall(node, type, varArray);
        for (let idx = 0; idx < len; idx++) {
            this.traversalAST(node['arguments'][idx], type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (type === travelMode.GET_DEFINE) {
            let bname = this.MemberExpressionFind(node["base"]);
            if (bname.isInStat && bname.isInStat > 0) {
                this.posSearchRet = this.createRetSymbol(bname.name, bname.isLocal);
                return;
            }
        }
        if (type === travelMode.FIND_REFS) {
            let bname = this.MemberExpressionFind(node["base"]);
            if (bname == this.searchInfo.name) {
                let loc = node["identifier"]["loc"];
                let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], loc);
                this.refsLink.push(nodeLoc1);
            }
        }
    }
    processCallStatement(node, type, deepLayer, prefix) {
        this.traversalAST(node['expression'], type, deepLayer, prefix);
        if (this.posSearchRet && this.posSearchRet.isFindout)
            return;
    }
    processIndexExpression(node, type, deepLayer, prefix) {
        if (type === travelMode.GET_DEFINE) {
            let loc = node['index']['loc'];
            let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], loc);
            let retBool = this.isInLocation(nodeLoc1, this.searchPosition);
            if (retBool === true) {
                if (node['base'].type == 'MemberExpression') {
                    this.posSearchRet = this.processMemberExpression(node['base'], type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        return;
                }
                else if (node['base'].type == 'Identifier') {
                    this.processIdentifier(node['base'], type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        return;
                    this.processIdentifier(node['index'], type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout == true)
                        return;
                }
                else if (node['base'].type == 'IndexExpression') {
                    this.processIdentifier(node['index'], type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout == true)
                        return;
                }
            }
            let bname = this.MemberExpressionFind(node['base']);
            if (bname.isInStat && bname.isInStat > 0) {
                this.posSearchRet = this.createRetSymbol(bname.name, bname.isLocal);
                return;
            }
            return this.createRetBase(bname.name, bname.isLocal, node['index']['value']);
        }
    }
    processAssignment(node, type, deepLayer, prefix) {
        let searchRes = false;
        let baseInfo;
        if (type === travelMode.GET_DEFINE) {
            let nodeLoc = vscode_languageserver_1.Location.create(this.docInfo["docUri"], node["loc"]);
            searchRes = this.isInLocation(nodeLoc, this.searchPosition);
        }
        if (Array.isArray(node['variables']) === true) {
            let varArray = Array.prototype.slice.call(node['variables']);
            let len = varArray.length;
            for (let idx = 0; idx < len; idx++) {
                if (type === travelMode.BUILD) {
                    baseInfo = this.buildLvalueSymbals(node["variables"][idx], type, deepLayer, prefix, null, 1);
                }
                if (type === travelMode.GET_DEFINE) {
                    this.searchLvalueSymbals(node["variables"][idx], type, deepLayer, prefix, searchRes);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        return;
                    if (this.posSearchRet.baseinfo)
                        baseInfo = this.posSearchRet.baseinfo;
                }
                if (type === travelMode.FIND_REFS) {
                    this.searchLvalueSymbals(node["variables"][idx], type, deepLayer, prefix, searchRes);
                }
            }
        }
        if (Array.isArray(node['init']) === true) {
            let varArray = Array.prototype.slice.call(node['init']);
            let len = varArray.length;
            for (let idx = 0; idx < len; idx++) {
                if (type === travelMode.BUILD) {
                    this.buildRvalueSymbals(node['init'][idx], type, deepLayer, prefix, baseInfo);
                }
                if (type === travelMode.GET_DEFINE) {
                    this.searchRvalueSymbals(node['init'][idx], type, deepLayer, prefix, baseInfo, searchRes);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        return;
                }
                if (type === travelMode.FIND_REFS) {
                    this.searchRvalueSymbals(node['init'][idx], type, deepLayer, prefix, baseInfo, searchRes);
                }
            }
        }
    }
    processTableConstructorExpression(node, type, deepLayer, prefix, baseInfo) {
        for (let idx = 0, len = node['fields'].length; idx < len; idx++) {
            let idxNode = node['fields'][idx];
            if (type === travelMode.BUILD) {
                if (idxNode['type'] === 'TableKeyString') {
                    let retInfo = this.buildLvalueSymbals(idxNode['key'], type, deepLayer, prefix, baseInfo);
                    this.buildRvalueSymbals(idxNode["value"], type, deepLayer, prefix, retInfo);
                }
                if (idxNode['type'] === 'TableKey') {
                    if (idxNode['key']['type'] === "StringLiteral") {
                        let orgname = idxNode['key']['value'];
                        let displayName = baseInfo.name + '.' + orgname;
                        let rg = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(idxNode['loc']["start"]["line"] - 1, idxNode['loc']["start"]["column"]), vscode_languageserver_1.Position.create(idxNode['loc']["end"]["line"] - 1, idxNode['loc']["end"]["column"])));
                        let symb = this.createSymbolInfo(displayName, displayName, orgname, vscode_languageserver_1.SymbolKind.Variable, rg, baseInfo.isLocal, prefix, deepLayer.concat());
                        this.pushToAutoList(symb);
                        let retInfo = { name: displayName, isLocal: baseInfo.isLocal };
                        this.buildRvalueSymbals(idxNode["value"], type, deepLayer, prefix, retInfo);
                    }
                    if (idxNode['key']['type'] === "NumericLiteral") {
                        let orgname = idxNode['key']['raw'];
                        let displayName = baseInfo.name + '[' + orgname + ']';
                        let rg = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(idxNode['loc']["start"]["line"] - 1, idxNode['loc']["start"]["column"]), vscode_languageserver_1.Position.create(idxNode['loc']["end"]["line"] - 1, idxNode['loc']["end"]["column"])));
                        let symb = this.createSymbolInfo(displayName, displayName, orgname, vscode_languageserver_1.SymbolKind.Variable, rg, baseInfo.isLocal, prefix, deepLayer.concat());
                        this.pushToAutoList(symb);
                        let retInfo = { name: displayName, isLocal: baseInfo.isLocal };
                        this.buildRvalueSymbals(idxNode["value"], type, deepLayer, prefix, retInfo);
                    }
                }
            }
            if (type === travelMode.GET_DEFINE) {
                if (idxNode['type'] === 'TableKeyString') {
                    let recBaseName = baseInfo.name;
                    this.searchLvalueSymbals(idxNode['key'], type, deepLayer, prefix, true, baseInfo);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        return;
                    this.searchRvalueSymbals(idxNode["value"], type, deepLayer, prefix, this.posSearchRet.baseinfo, true);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        return;
                    baseInfo.name = recBaseName;
                }
                if (idxNode['type'] === 'TableKey') {
                    if (idxNode['key']['type'] === "NumericLiteral") {
                        let recBaseName = baseInfo.name;
                        baseInfo.name = baseInfo.name + '[' + idxNode['key']['value'] + ']';
                        this.searchRvalueSymbals(idxNode["value"], type, deepLayer, prefix, baseInfo, true);
                        if (this.posSearchRet && this.posSearchRet.isFindout)
                            return;
                        baseInfo.name = recBaseName;
                    }
                    if (idxNode['key']['type'] === "StringLiteral") {
                        let recBaseName = baseInfo.name;
                        baseInfo.name = baseInfo.name + '.' + idxNode['key']['value'];
                        this.searchRvalueSymbals(idxNode["value"], type, deepLayer, prefix, baseInfo, true);
                        if (this.posSearchRet && this.posSearchRet.isFindout)
                            return;
                        baseInfo.name = recBaseName;
                    }
                }
                if (idxNode['type'] === 'TableValue') {
                    if (idxNode['value']['type'] === 'TableConstructorExpression') {
                        let recBaseName = baseInfo.name;
                        this.processTableConstructorExpression(idxNode['value'], type, deepLayer, prefix, baseInfo);
                        if (this.posSearchRet && this.posSearchRet.isFindout)
                            return;
                        baseInfo.name = recBaseName;
                    }
                }
            }
            if (type === travelMode.FIND_REFS) {
                if (idxNode['type'] === 'TableKeyString') {
                    this.searchLvalueSymbals(idxNode['key'], type, deepLayer, prefix, true, baseInfo);
                    this.searchRvalueSymbals(idxNode["value"], type, deepLayer, prefix, this.posSearchRet.baseinfo, true);
                }
            }
        }
    }
    processWhileStatement(node, type, deepLayer, prefix) {
        this.traversalAST(node['body'], type, deepLayer, prefix);
        if (this.posSearchRet && this.posSearchRet.isFindout)
            return;
    }
    processRepeatStatement(node, type, deepLayer, prefix) {
        this.traversalAST(node['body'], type, deepLayer, prefix);
        if (this.posSearchRet && this.posSearchRet.isFindout)
            return;
    }
    processMemberExpression(node, type, deepLayer, prefix, baseInfo, searchRes) {
        if (type === travelMode.GET_DEFINE) {
            if (node['type'] === 'MemberExpression') {
                let loc = node['identifier']['loc'];
                let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], loc);
                let retBool = this.isInLocation(nodeLoc1, this.searchPosition);
                if (retBool === true) {
                    let bname = this.baseProcess(node);
                    this.posSearchRet = this.createRetSymbol(bname.name, bname.isLocal);
                }
                let bname = this.MemberExpressionFind(node['base']);
                if (bname.isInStat && bname.isInStat > 0) {
                    this.posSearchRet = this.createRetSymbol(bname.name, bname.isLocal);
                }
                return this.createRetBase(bname.name, bname.isLocal, node['identifier']['name']);
            }
        }
    }
    processIdentifier(node, type, deepLayer, prefix, baseInfo, searchRes) {
        if (type === travelMode.GET_DEFINE) {
            if (node['type'] === 'Identifier') {
                if (baseInfo == undefined || baseInfo.name == undefined || baseInfo.name === '') {
                    baseInfo = { name: node["name"], isLocal: node['isLocal'] };
                }
                else {
                    if (baseInfo.identiferStr) {
                        baseInfo.name = baseInfo.name + '.' + baseInfo.identiferStr + '.' + node["name"];
                    }
                    else {
                        baseInfo.name = baseInfo.name + '.' + node["name"];
                    }
                }
                let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], node["loc"]);
                if (this.isInLocation(nodeLoc1, this.searchPosition)) {
                    this.posSearchRet = this.createRetSymbol(baseInfo.name, baseInfo.isLocal);
                }
                else {
                    this.posSearchRet = this.createRetBase(baseInfo.name, baseInfo.isLocal);
                }
            }
            if (node['type'] === 'BinaryExpression') {
            }
        }
        if (type === travelMode.FIND_REFS) {
            if (node['type'] === 'Identifier') {
                if (baseInfo == undefined || baseInfo.name == undefined || baseInfo.name === '') {
                    baseInfo = { name: node["name"], isLocal: node['isLocal'] };
                }
                else {
                    if (baseInfo.identiferStr) {
                        baseInfo.name = baseInfo.name + '.' + baseInfo.identiferStr + '.' + node["name"];
                    }
                    else {
                        baseInfo.name = baseInfo.name + '.' + node["name"];
                    }
                }
                if (baseInfo.name == this.searchInfo.searchName) {
                    let nodeLoc1 = vscode_languageserver_1.Location.create(this.docInfo["docUri"], node["loc"]);
                    this.refsLink.push(nodeLoc1);
                }
            }
        }
    }
    processBinaryExpression(node, type, deepLayer, prefix) {
        if (type === travelMode.GET_DEFINE) {
            this.traversalAST(node['left'], type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            this.traversalAST(node['right'], type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (type === travelMode.FIND_REFS) {
            this.traversalAST(node['left'], type, deepLayer, prefix);
            this.traversalAST(node['right'], type, deepLayer, prefix);
        }
    }
    processUnaryExpression(node, type, deepLayer, prefix) {
        if (type === travelMode.GET_DEFINE) {
            let argumentType = node['argument']['type'];
            switch (argumentType) {
                case 'Identifier':
                    this.processIdentifier(node['argument'], type, deepLayer, prefix);
                    break;
                case 'LogicalExpression':
                    this.searchRvalueSymbals(node['argument']['left'], type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout)
                        break;
                    this.searchRvalueSymbals(node['argument']['right'], type, deepLayer, prefix);
                    break;
                case 'IndexExpression':
                    this.processIndexExpression(node['argument'], type, deepLayer, prefix);
                    break;
                case 'BinaryExpression':
                    this.processBinaryExpression(node['argument'], type, deepLayer, prefix);
                    break;
                case 'CallExpression':
                    this.processCallExpression(node['argument'], type, deepLayer, prefix);
                    break;
                case 'MemberExpression':
                    this.processMemberExpression(node['argument'], type, deepLayer, prefix);
                    break;
                case 'UnaryExpression':
                    this.processUnaryExpression(node['argument'], type, deepLayer, prefix);
                    break;
            }
            if (this.posSearchRet && this.posSearchRet.isFindout) {
                return;
            }
        }
    }
    processIfStatement(ASTNode, type, deepLayer, prefix) {
        let node = ASTNode['clauses'];
        if (Array.isArray(node) === true) {
            let ASTArray = Array.prototype.slice.call(node);
            for (let idx = 0, len = ASTArray.length; idx < len; idx++) {
                if (ASTArray[idx].type == 'IfClause' || ASTArray[idx].type == 'ElseifClause') {
                    if (ASTArray[idx]['condition']['type'] === 'Identifier') {
                        this.processIdentifier(ASTArray[idx]['condition'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout) {
                            return;
                        }
                    }
                    if (ASTArray[idx]['condition']['type'] === 'LogicalExpression') {
                        let node = ASTArray[idx]['condition'];
                        this.searchRvalueSymbals(node['left'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout)
                            return;
                        this.searchRvalueSymbals(node['right'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout)
                            return;
                    }
                    if (ASTArray[idx]['condition']['type'] === 'IndexExpression') {
                        this.processIndexExpression(ASTArray[idx]['condition'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout)
                            return;
                    }
                    if (ASTArray[idx]['condition']['type'] === 'BinaryExpression') {
                        this.processBinaryExpression(ASTArray[idx]['condition'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout) {
                            return;
                        }
                    }
                    if (ASTArray[idx]['condition']['type'] === 'CallExpression') {
                        this.processCallExpression(ASTArray[idx]['condition'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout) {
                            return;
                        }
                    }
                    if (ASTArray[idx]['condition']['type'] === 'MemberExpression') {
                        this.processMemberExpression(ASTArray[idx]['condition'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout) {
                            return;
                        }
                    }
                    if (ASTArray[idx]['condition']['type'] === 'UnaryExpression') {
                        this.processUnaryExpression(ASTArray[idx]['condition'], type, deepLayer, prefix);
                        if (this.posSearchRet && this.posSearchRet.isFindout) {
                            return;
                        }
                    }
                    this.traversalAST(ASTArray[idx].body, type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout) {
                        return;
                    }
                }
                if (ASTArray[idx].type == 'ElseClause') {
                    this.traversalAST(ASTArray[idx].body, type, deepLayer, prefix);
                    if (this.posSearchRet && this.posSearchRet.isFindout) {
                        return;
                    }
                }
            }
        }
    }
    processReturnStatement(ASTNode, type, deepLayer, prefix, isBody) {
        if (type === travelMode.GET_DEFINE) {
            let node = ASTNode;
            let varArray = Array.prototype.slice.call(node['arguments']);
            for (let idx = 0; idx < varArray.length; idx++) {
                this.traversalAST(varArray[idx], type, deepLayer, prefix);
                if (this.posSearchRet && this.posSearchRet.isFindout)
                    return;
            }
        }
        if (type === travelMode.BUILD) {
            if (isBody == true) {
                if (ASTNode['arguments'].length == 1) {
                    if (ASTNode['arguments'][0]['type'] === 'Identifier') {
                        let name = ASTNode['arguments'][0]['name'];
                        this.docInfo.defineSymbols.chunks[this.docInfo.docPath].returnSymbol = name;
                    }
                }
            }
            else {
                if (ASTNode['arguments'].length == 1) {
                    if (ASTNode['arguments'][0]['type'] === 'Identifier') {
                        let name = ASTNode['arguments'][0]['name'];
                        this.funcReturnRecoder = name;
                    }
                }
            }
        }
    }
    processForGenericStatement(node, type, deepLayer, prefix) {
        this.traversalAST(node['body'], type, deepLayer, prefix);
        if (this.posSearchRet && this.posSearchRet.isFindout)
            return;
    }
    processForNumericStatement(node, type, deepLayer, prefix) {
        this.traversalAST(node['body'], type, deepLayer, prefix);
        if (this.posSearchRet && this.posSearchRet.isFindout)
            return;
    }
    buildLvalueSymbals(node, type, deepLayer, prefix, baseInfo, isAssign) {
        let baseName = '';
        let baseLocal = true;
        let displayName = '';
        let searchName = '';
        if (node['type'] === 'Identifier') {
            if (baseInfo == undefined) {
                baseName = node["name"];
                baseLocal = node["isLocal"];
                displayName = node["name"];
            }
            else {
                baseLocal = baseInfo.isLocal;
                baseName = baseInfo.name + '.' + node["name"];
                displayName = baseName;
            }
            searchName = baseName;
            let isPush = true;
            if (isAssign == 1) {
                if (baseLocal) {
                    isPush = false;
                }
                else {
                    if (this.getGlobalSymbolsDic()[searchName] != undefined) {
                        isPush = false;
                    }
                }
            }
            if (isPush === true) {
                let loct = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(node['loc']["start"]["line"] - 1, node['loc']["start"]["column"]), vscode_languageserver_1.Position.create(node['loc']["end"]["line"] - 1, node['loc']["end"]["column"])));
                let symb = this.createSymbolInfo(displayName, baseName, node["name"], vscode_languageserver_1.SymbolKind.Variable, loct, baseLocal, prefix, deepLayer.concat());
                this.pushToAutoList(symb);
            }
            return { name: baseName, isLocal: baseLocal };
        }
        if ('MemberExpression' === node['type']) {
            let bname = this.baseProcess(node);
            let rg = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(node['loc']["start"]["line"] - 1, node['loc']["start"]["column"]), vscode_languageserver_1.Position.create(node['loc']["end"]["line"] - 1, node['loc']["end"]["column"])));
            baseName = bname.name;
            baseLocal = bname.isLocal;
            if (this.checkIsSymbolExist(bname.name) === false) {
                let symb = this.createSymbolInfo(bname.name, bname.name, node['identifier']['name'], vscode_languageserver_1.SymbolKind.Variable, rg, bname.isLocal, prefix, deepLayer.concat());
                this.pushToAutoList(symb);
            }
            return { name: baseName, isLocal: baseLocal };
        }
        else if ('IndexExpression' === node['type']) {
            let baseInfo = this.baseProcess(node['base']);
            if (node['index'].type == 'StringLiteral') {
                let rg = vscode_languageserver_1.Location.create(this.docInfo["docUri"], vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(node['loc']["start"]["line"] - 1, node['loc']["start"]["column"]), vscode_languageserver_1.Position.create(node['loc']["end"]["line"] - 1, node['loc']["end"]["column"])));
                let displayName = baseInfo.name + '.' + node['index'].value;
                if (this.checkIsSymbolExist(displayName) === false) {
                    let symb = this.createSymbolInfo(displayName, displayName, node['index'].value, vscode_languageserver_1.SymbolKind.Variable, rg, baseInfo.isLocal, prefix, deepLayer.concat());
                    this.pushToAutoList(symb);
                }
            }
            return { name: baseInfo.name, isLocal: baseInfo.isLocal };
        }
    }
    buildRvalueSymbals(node, type, deepLayer, prefix, baseInfo) {
        if (node == undefined)
            return;
        if (node['type'] === 'TableConstructorExpression') {
            this.processTableConstructorExpression(node, type, deepLayer, prefix, baseInfo);
        }
        if (node['type'] === 'Identifier') {
            let info = {
                reason: Tools.TagReason.Equal,
                newType: node['name'],
                location: node['loc'],
                name: baseInfo.name
            };
            this.pushToCommentList(info);
        }
        if (node['type'] === 'MemberExpression') {
            let bname = this.baseProcess(node);
            let info = {
                reason: Tools.TagReason.Equal,
                newType: bname.name,
                location: node['loc'],
                name: baseInfo.name
            };
            this.pushToCommentList(info);
        }
        this.traversalAST(node, type, deepLayer, prefix);
    }
    searchLvalueSymbals(node, type, deepLayer, prefix, searchRes, baseInfo) {
        let localBaseInfo = baseInfo;
        if (node['type'] === 'Identifier') {
            this.processIdentifier(node, type, deepLayer, prefix, localBaseInfo, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            if (this.posSearchRet && this.posSearchRet.isFindout === false)
                localBaseInfo = this.posSearchRet.baseinfo;
        }
        if (node['type'] === 'MemberExpression') {
            this.processMemberExpression(node, type, deepLayer, prefix, localBaseInfo, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            if (this.posSearchRet && this.posSearchRet.isFindout === false)
                localBaseInfo = this.posSearchRet.baseinfo;
        }
        if (node['type'] === 'CallExpression') {
            this.processCallExpression(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            if (this.posSearchRet && this.posSearchRet.isFindout === false)
                localBaseInfo = this.posSearchRet.baseinfo;
        }
        if (node['type'] === 'BinaryExpression') {
            this.processBinaryExpression(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            if (this.posSearchRet && this.posSearchRet.isFindout === false)
                localBaseInfo = this.posSearchRet.baseinfo;
        }
        if (node['type'] === 'IndexExpression') {
            this.processIndexExpression(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            if (this.posSearchRet && this.posSearchRet.isFindout === false)
                localBaseInfo = this.posSearchRet.baseinfo;
        }
    }
    searchRvalueSymbals(node, type, deepLayer, prefix, baseInfo, searchRes) {
        if (node['type'] === 'Identifier') {
            this.processIdentifier(node, type, deepLayer, prefix, null, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node['type'] === 'MemberExpression') {
            this.processMemberExpression(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout) {
                return;
            }
        }
        if (node['type'] === 'TableConstructorExpression') {
            this.processTableConstructorExpression(node, type, deepLayer, prefix, baseInfo);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node.type === 'CallExpression') {
            this.traversalAST(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node.type === 'FunctionDeclaration') {
            this.traversalAST(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node.type === 'LogicalExpression') {
            this.searchRvalueSymbals(node['left'], type, deepLayer, prefix, baseInfo, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            this.searchRvalueSymbals(node['right'], type, deepLayer, prefix, baseInfo, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node.type === 'BinaryExpression') {
            this.searchRvalueSymbals(node['left'], type, deepLayer, prefix, baseInfo, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
            this.searchRvalueSymbals(node['right'], type, deepLayer, prefix, baseInfo, searchRes);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node['type'] === 'IndexExpression') {
            this.processIndexExpression(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout)
                return;
        }
        if (node['type'] === 'UnaryExpression') {
            this.processUnaryExpression(node, type, deepLayer, prefix);
            if (this.posSearchRet && this.posSearchRet.isFindout) {
                return;
            }
        }
    }
}
exports.DocSymbolProcessor = DocSymbolProcessor;
//# sourceMappingURL=docSymbolProcessor.js.map