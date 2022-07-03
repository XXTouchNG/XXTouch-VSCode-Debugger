"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeLogManager_1 = require("./codeLogManager");
const vscode_uri_1 = require("vscode-uri");
let path = require('path');
let dir = require('path-reader');
let os = require('os');
let urlencode = require('urlencode');
const vscode_languageserver_1 = require("vscode-languageserver");
const fs = require("fs");
let initParameter;
function setInitPara(para) {
    initParameter = para;
}
exports.setInitPara = setInitPara;
let VScodeExtensionPath;
function getVScodeExtensionPath() {
    return VScodeExtensionPath;
}
exports.getVScodeExtensionPath = getVScodeExtensionPath;
let VSCodeOpenedFolders = [];
function getVSCodeOpenedFolders() {
    if (VSCodeOpenedFolders.length === 0 && initParameter && initParameter.workspaceFolders) {
        for (const rootFold of initParameter.workspaceFolders) {
            VSCodeOpenedFolders.push(uriToPath(rootFold.uri));
        }
    }
    return VSCodeOpenedFolders;
}
exports.getVSCodeOpenedFolders = getVSCodeOpenedFolders;
function addOpenedFolder(newFolders) {
    let rootFolders = getVSCodeOpenedFolders();
    for (const folder of newFolders) {
        rootFolders.push(uriToPath(folder.uri));
    }
}
exports.addOpenedFolder = addOpenedFolder;
function removeOpenedFolder(beDelFolders) {
    let rootFolders = getVSCodeOpenedFolders();
    for (const folder of beDelFolders) {
        for (let idx = 0; idx < rootFolders.length; idx++) {
            if (uriToPath(folder.uri) === rootFolders[idx]) {
                rootFolders.splice(idx, 1);
                break;
            }
        }
    }
}
exports.removeOpenedFolder = removeOpenedFolder;
function setVScodeExtensionPath(_VScodeExtensionPath) {
    VScodeExtensionPath = _VScodeExtensionPath;
}
exports.setVScodeExtensionPath = setVScodeExtensionPath;
let loadedExt;
function initLoadedExt() {
    loadedExt = new Object();
}
exports.initLoadedExt = initLoadedExt;
function getLoadedExt() {
    return loadedExt;
}
exports.getLoadedExt = getLoadedExt;
function setLoadedExt(key) {
    loadedExt[key] = true;
}
exports.setLoadedExt = setLoadedExt;
let connection;
function setToolsConnection(conn) {
    connection = conn;
}
exports.setToolsConnection = setToolsConnection;
let fileName_Uri_Cache;
let uriToPathCache = new Object();
let pathToUriCache = new Object();
var SearchMode;
(function (SearchMode) {
    SearchMode[SearchMode["ExactlyEqual"] = 0] = "ExactlyEqual";
    SearchMode[SearchMode["FuzzyMatching"] = 1] = "FuzzyMatching";
    SearchMode[SearchMode["PrefixMatch"] = 2] = "PrefixMatch";
})(SearchMode = exports.SearchMode || (exports.SearchMode = {}));
var SearchRange;
(function (SearchRange) {
    SearchRange[SearchRange["AllSymbols"] = 0] = "AllSymbols";
    SearchRange[SearchRange["GlobalSymbols"] = 1] = "GlobalSymbols";
    SearchRange[SearchRange["LocalSymbols"] = 2] = "LocalSymbols";
})(SearchRange = exports.SearchRange || (exports.SearchRange = {}));
var TagReason;
(function (TagReason) {
    TagReason[TagReason["UserTag"] = 0] = "UserTag";
    TagReason[TagReason["Equal"] = 1] = "Equal";
    TagReason[TagReason["MetaTable"] = 2] = "MetaTable";
})(TagReason = exports.TagReason || (exports.TagReason = {}));
class searchRet {
    constructor() {
        this.isFindout = false;
    }
}
exports.searchRet = searchRet;
class chunkClass {
    constructor(name, loc) {
        this.chunkName = name;
        this.loc = loc;
    }
}
exports.chunkClass = chunkClass;
class docInformation {
    constructor(docAST, docUri, docPath) {
        this.parseSucc = true;
        this.docAST = docAST;
        this.docUri = docUri;
        this.docPath = docPath;
        this.defineSymbols = new Object();
        this.defineSymbols["allSymbols"] = new Array();
        this.defineSymbols["allSymbolsArray"] = new Array();
        this.defineSymbols["allSymbolsTrie"];
        this.defineSymbols["globalSymbols"] = new Array();
        this.defineSymbols["globalSymbolsArray"] = new Array();
        this.defineSymbols["globalSymbolsTrie"];
        this.defineSymbols["localSymbols"] = new Array();
        this.defineSymbols["localSymbolsArray"] = new Array();
        this.defineSymbols["localSymbolsTrie"];
        this.defineSymbols["chunks"] = new Array();
        this.defineSymbols["chunksArray"] = new Array();
        this.requires = new Array();
        this.references = new Array();
    }
}
exports.docInformation = docInformation;
function urlDecode(url) {
    return urlencode.decode(url);
}
exports.urlDecode = urlDecode;
function getPathNameAndExt(UriOrPath) {
    let name_and_ext = path.basename(UriOrPath).split('.');
    let name = name_and_ext[0];
    let ext = name_and_ext[1];
    for (let index = 2; index < name_and_ext.length; index++) {
        ext = ext + '.' + name_and_ext[index];
    }
    return { name, ext };
}
exports.getPathNameAndExt = getPathNameAndExt;
function get_FileName_Uri_Cache() {
    return fileName_Uri_Cache;
}
exports.get_FileName_Uri_Cache = get_FileName_Uri_Cache;
function AddTo_FileName_Uri_Cache(name, uri) {
    fileName_Uri_Cache[name] = urlDecode(uri);
}
exports.AddTo_FileName_Uri_Cache = AddTo_FileName_Uri_Cache;
function isinPreloadFolder(uri) {
    if (!uri)
        return false;
    let matchRes = uri.match('.vscode/LuaPanda/IntelliSenseRes');
    if (matchRes) {
        return true;
    }
    return false;
}
exports.isinPreloadFolder = isinPreloadFolder;
function refresh_FileName_Uri_Cache() {
    let totalFileNum = 0;
    fileName_Uri_Cache = new Array();
    let processFilNum = 0;
    for (const rootFolder of getVSCodeOpenedFolders()) {
        let rootFiles = dir.files(rootFolder, { sync: true });
        totalFileNum += rootFiles.length;
        for (let idx = 0, len = rootFiles.length; idx < len; idx++) {
            let name_and_ext = getPathNameAndExt(rootFiles[idx]);
            let trname = name_and_ext['name'];
            let ext = name_and_ext['ext'];
            let validExt = getLoadedExt();
            if (validExt[ext]) {
                let trUri = pathToUri(rootFiles[idx]);
                fileName_Uri_Cache[trname] = urlDecode(trUri);
                codeLogManager_1.Logger.DebugLog(trUri);
                processFilNum = processFilNum + 1;
            }
        }
    }
    codeLogManager_1.Logger.InfoLog("文件缓存刷新完毕, 共计 " + totalFileNum + " 个文件, 其中 " + processFilNum + " 个 lua 类型文件. ");
    showProgressMessage(100, "Done!");
}
exports.refresh_FileName_Uri_Cache = refresh_FileName_Uri_Cache;
function transFileNameToUri(requireName) {
    if (requireName == null) {
        return '';
    }
    let parseName = path.parse(requireName);
    let cacheUri = fileName_Uri_Cache[parseName.name];
    if (cacheUri) {
        return cacheUri;
    }
    return '';
}
exports.transFileNameToUri = transFileNameToUri;
function transWinDiskToUpper(uri) {
    if (os.type() == "Windows_NT") {
        let reg = /^file:\/\/\/(\w)/;
        uri = uri.replace(reg, function (m) {
            let diskSymbol = m.charAt(8);
            diskSymbol = 'file:///' + diskSymbol.toUpperCase();
            return diskSymbol;
        });
        return uri;
    }
}
exports.transWinDiskToUpper = transWinDiskToUpper;
function pathToUri(pathStr) {
    if (pathToUriCache[pathStr]) {
        return pathToUriCache[pathStr];
    }
    let retUri;
    if (os.type() == "Windows_NT") {
        let pathArr = pathStr.split(path.sep);
        let stdPath = pathArr.join('/');
        retUri = 'file:///' + stdPath;
    }
    else {
        retUri = 'file://' + pathStr;
    }
    pathToUriCache[pathStr] = retUri;
    return retUri;
}
exports.pathToUri = pathToUri;
function uriToPath(uri) {
    if (uriToPathCache[uri]) {
        return uriToPathCache[uri];
    }
    let pathStr = vscode_uri_1.default.parse(uri).fsPath;
    uriToPathCache[uri] = pathStr;
    return pathStr;
}
exports.uriToPath = uriToPath;
function getDirFiles(path) {
    if (path) {
        return dir.files(path, { sync: true });
    }
}
exports.getDirFiles = getDirFiles;
function getFileContent(path) {
    if (path == '' || path == undefined) {
        return '';
    }
    let data = fs.readFileSync(path);
    let dataStr = data.toString();
    return dataStr;
}
exports.getFileContent = getFileContent;
function transPosStartLineTo1(position) {
    position.line = position.line + 1;
}
exports.transPosStartLineTo1 = transPosStartLineTo1;
function transPosStartLineTo0(position) {
    position.line = position.line - 1;
}
exports.transPosStartLineTo0 = transPosStartLineTo0;
function getTextByPosition(luaText, pos) {
    if (luaText == null) {
        return '';
    }
    let stringArr = luaText.split(/\r\n|\r|\n/);
    let startStr = stringArr[pos.line].substring(0, pos.character);
    let reg = /[~!#%&\t\*\(\)\|,<>\?"';\+\=\[\]\{\}]/g;
    let blankStr = startStr.replace(reg, ' ');
    let finalArr = blankStr.split(' ');
    let retStr = finalArr.pop();
    return retStr;
}
exports.getTextByPosition = getTextByPosition;
function isNextLineHasFunction(luaText, position) {
    let luaTextArray = luaText.split(/\r\n|\r|\n/);
    if (luaTextArray.length <= position.line + 1) {
        return false;
    }
    let nextLineText = luaTextArray[position.line + 1];
    let regExp = /\bfunction\b/;
    if (regExp.exec(nextLineText)) {
        return true;
    }
    return false;
}
exports.isNextLineHasFunction = isNextLineHasFunction;
function createEmptyLocation(uri) {
    let pos = vscode_languageserver_1.Position.create(0, 0);
    let rg = vscode_languageserver_1.Range.create(pos, pos);
    let retLoc = vscode_languageserver_1.Location.create(uri, rg);
    return retLoc;
}
exports.createEmptyLocation = createEmptyLocation;
function isMatchedIgnoreRegExp(uri, ignoreRegExp) {
    for (let i = 0; i < ignoreRegExp.length; i++) {
        if (ignoreRegExp[i] === "") {
            continue;
        }
        let regExp = new RegExp(ignoreRegExp[i]);
        if (regExp.exec(uri)) {
            return true;
        }
    }
    return false;
}
exports.isMatchedIgnoreRegExp = isMatchedIgnoreRegExp;
function getNSpace(n) {
    let str = "";
    for (let i = 0; i < n; i++) {
        str += " ";
    }
    return str;
}
exports.getNSpace = getNSpace;
function showProgressMessage(progress, message) {
    connection.sendNotification("showProgress", progress + "% " + message);
    if (progress == 100) {
        connection.sendNotification("showProgress", "LuaPanda 👍");
    }
}
exports.showProgressMessage = showProgressMessage;
function showTips(str, level) {
    if (level === 2) {
        connection.sendNotification("showErrorMessage", str);
    }
    else if (level === 1) {
        connection.sendNotification("showWarningMessage", str);
    }
    else {
        connection.sendNotification("showInformationMessage", str);
    }
}
exports.showTips = showTips;
function changeDicSymboltoArray(dic) {
    let array = new Array();
    for (const key in dic) {
        const element = dic[key];
        if (Array.isArray(element)) {
            for (const k in element) {
                const ele = element[k];
                array.push(ele);
            }
        }
        else {
            array.push(element);
        }
    }
    return array;
}
exports.changeDicSymboltoArray = changeDicSymboltoArray;
function getVerboseSymbolContainer(verboseSymbolInfo) {
    let searchName = verboseSymbolInfo.searchName;
    let searchNameArray = Array();
    if (searchName != "...") {
        searchName = searchName.replace(/\[/g, '.');
        searchName = searchName.replace(/]/g, '');
        searchNameArray = splitToArrayByDot(searchName);
    }
    let searchNameContainer = Array();
    for (let i = 0; i < searchNameArray.length - 1; i++) {
        searchNameContainer.push(new chunkClass(searchNameArray[i], undefined));
    }
    let containerList = Array();
    containerList.push(verboseSymbolInfo.containerList[0]);
    for (let i = 1; i < verboseSymbolInfo.containerList.length; i++) {
        let chunkNameArray = splitToArrayByDot(verboseSymbolInfo.containerList[i].chunkName);
        if (chunkNameArray.length > 1) {
            for (let j = 0; j < chunkNameArray.length; j++) {
                containerList.push(new chunkClass(chunkNameArray[j], undefined));
            }
        }
        else {
            containerList.push(verboseSymbolInfo.containerList[i]);
        }
    }
    let verboseSymbolContainer = containerList.concat(searchNameContainer);
    return verboseSymbolContainer;
}
function handleDocumentSymbolChildren(symbolContainer, documentSymbol, outlineSymbolArray, chunkMap) {
    let index = chunkMap.get(symbolContainer[1].chunkName);
    if (index === undefined) {
        return;
    }
    let parent = outlineSymbolArray[index];
    for (let i = 2; i < symbolContainer.length; i++) {
        for (let j = 0; j < parent.children.length; j++) {
            if (symbolContainer[i].chunkName == parent.children[j]["originalName"]) {
                parent = parent.children[j];
                break;
            }
        }
    }
    if (!parent.children) {
        parent.children = new Array();
    }
    parent.children.push(documentSymbol);
}
function getOutlineSymbol(symbolInfoArray) {
    let outlineSymbolArray = Array();
    let chunkMap = new Map();
    for (let i = 0; i < symbolInfoArray.length; i++) {
        let symbolInfo = symbolInfoArray[i];
        let documentSymbol = {
            name: symbolInfo.originalName,
            kind: symbolInfo.kind,
            range: symbolInfo.location.range,
            selectionRange: symbolInfo.location.range,
            children: Array()
        };
        documentSymbol["originalName"] = symbolInfo.originalName;
        if (symbolInfo.kind == vscode_languageserver_1.SymbolKind.Function) {
            documentSymbol.name = symbolInfo.name;
        }
        let verboseSymbolContainer = getVerboseSymbolContainer(symbolInfoArray[i]);
        if (verboseSymbolContainer.length > 1) {
            handleDocumentSymbolChildren(verboseSymbolContainer, documentSymbol, outlineSymbolArray, chunkMap);
            continue;
        }
        outlineSymbolArray.push(documentSymbol);
        chunkMap.set(symbolInfo.searchName, outlineSymbolArray.length - 1);
    }
    return outlineSymbolArray;
}
exports.getOutlineSymbol = getOutlineSymbol;
function splitToArrayByDot(input) {
    let userInputTxt_DotToBlank = input.replace(/[\.:]/g, ' ');
    let L = userInputTxt_DotToBlank.split(' ');
    return L;
}
exports.splitToArrayByDot = splitToArrayByDot;
//# sourceMappingURL=codeTools.js.map