"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
let path = require('path');
const fs = require("fs");
const Tools = require("./codeTools");
const codeLogManager_1 = require("./codeLogManager");
const codeSymbol_1 = require("./codeSymbol");
const codeDefinition_1 = require("./codeDefinition");
const codeCompletion_1 = require("./codeCompletion");
const codeEditor_1 = require("./codeEditor");
const codeFormat_1 = require("./codeFormat");
const codeLinting_1 = require("./codeLinting");
const codeReference_1 = require("./codeReference");
const nativeCodeExportBase_1 = require("./codeExport/nativeCodeExportBase");
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
let documents = new vscode_languageserver_1.TextDocuments();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let analyzerTotalSwitch = true;
const defaultSettings = {
    codeLinting: {
        enable: true,
        luacheckPath: "",
        luaVersion: "5.1",
        checkWhileTyping: true,
        checkAfterSave: true,
        maxNumberOfProblems: 100,
        maxLineLength: 120,
        ignoreFolderRegularExpression: ".*/res/lua/\\w+\\.lua;.*vscode/LuaPanda/IntelliSenseRes/;",
        ignoreErrorCode: "",
        ignoreGlobal: "",
    }
};
let globalSettings = defaultSettings;
let documentSettings = new Map();
connection.onInitialize((initPara) => {
    let capabilities = initPara.capabilities;
    Tools.setInitPara(initPara);
    Tools.setToolsConnection(connection);
    codeLogManager_1.Logger.connection = connection;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    Tools.setVScodeExtensionPath(path.dirname(path.dirname(path.dirname(__dirname))));
    Tools.initLoadedExt();
    let snippetsPath = Tools.getVScodeExtensionPath() + "/res/snippets/snippets.json";
    let snipContent = fs.readFileSync(snippetsPath);
    setImmediate(() => {
        connection.sendNotification("setRootFolders", Tools.getVSCodeOpenedFolders());
    }, 0);
    if (snipContent.toString().trim() == '') {
        analyzerTotalSwitch = false;
        setImmediate(() => {
            connection.sendNotification("showProgress", "LuaPanda");
        }, 0);
        codeLogManager_1.Logger.InfoLog("LuaAnalyzer closed!");
        return {
            capabilities: {}
        };
    }
    for (const folder of Tools.getVSCodeOpenedFolders()) {
        codeSymbol_1.CodeSymbol.createSymbolswithExt('lua', folder);
        codeSymbol_1.CodeSymbol.createSymbolswithExt('lua.bytes', folder);
    }
    setTimeout(Tools.refresh_FileName_Uri_Cache, 0);
    let resLuaPath = Tools.getVScodeExtensionPath() + '/res/lua';
    codeSymbol_1.CodeSymbol.createLuaPreloadSymbols(resLuaPath);
    nativeCodeExportBase_1.NativeCodeExportBase.loadIntelliSenseRes();
    codeLogManager_1.Logger.InfoLog("LuaAnalyzer initialized!");
    return {
        capabilities: {
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            definitionProvider: true,
            referencesProvider: false,
            documentFormattingProvider: true,
            documentRangeFormattingProvider: false,
            documentHighlightProvider: false,
            textDocumentSync: documents.syncKind,
            completionProvider: {
                triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:".split(''),
                resolveProvider: false
            },
            renameProvider: false,
            colorProvider: false,
        }
    };
});
connection.onNotification("preAnalysisCpp", (message) => {
    let msgObj = JSON.parse(message);
    let anaPath = msgObj['path'];
    nativeCodeExportBase_1.NativeCodeExportBase.processNativeCodeDir(anaPath);
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            codeLogManager_1.Logger.DebugLog('Workspace folder change event received.');
            if (_event.added.length > 0) {
                Tools.addOpenedFolder(_event.added);
                for (const folder of Tools.getVSCodeOpenedFolders()) {
                    codeSymbol_1.CodeSymbol.refreshFolderSymbols(folder);
                }
            }
            if (_event.removed.length > 0) {
                Tools.removeOpenedFolder(_event.removed);
            }
            setTimeout(Tools.refresh_FileName_Uri_Cache, 0);
        });
    }
});
connection.onDocumentFormatting((handler) => {
    let uri = Tools.urlDecode(handler.textDocument.uri);
    let retCode = codeFormat_1.CodeFormat.format(uri);
    return retCode;
});
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.lua_analyzer || defaultSettings));
    }
    documents.all().forEach(validateTextDocument);
});
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
connection.onCompletion((_textDocumentPosition) => {
    let uri = Tools.urlDecode(_textDocumentPosition.textDocument.uri);
    let pos = _textDocumentPosition.position;
    try {
        return codeCompletion_1.CodeCompletion.completionEntry(uri, pos);
    }
    catch (error) {
        codeLogManager_1.Logger.ErrorLog("[Error] onCompletion " + error.stack);
    }
});
connection.onReferences((handler) => {
    return codeReference_1.CodeReference.getSymbalReferences(handler);
});
connection.onDefinition((handler) => {
    handler.textDocument.uri = Tools.urlDecode(handler.textDocument.uri);
    try {
        return codeDefinition_1.CodeDefinition.getSymbalDefine(handler);
    }
    catch (error) {
        codeLogManager_1.Logger.ErrorLog("[Error] onDefinition " + error.stack);
    }
});
connection.onDocumentSymbol((handler) => {
    let uri = handler.textDocument.uri;
    let decUri = Tools.urlDecode(uri);
    let retSyms = codeSymbol_1.CodeSymbol.getOneDocSymbolsArray(decUri, null, Tools.SearchRange.AllSymbols);
    let retSymsArr;
    try {
        retSymsArr = Tools.getOutlineSymbol(retSyms);
    }
    catch (error) {
        codeLogManager_1.Logger.DebugLog("Error detected while processing outline symbols, error: " + error + "\nstack:\n" + error.stack);
        retSymsArr = Tools.changeDicSymboltoArray(retSyms);
    }
    return retSymsArr;
});
connection.onWorkspaceSymbol((handler) => {
    try {
        let userInput = handler.query;
        return codeSymbol_1.CodeSymbol.searchSymbolinWorkSpace(userInput);
    }
    catch (error) {
        codeLogManager_1.Logger.ErrorLog("[Error] onWorkspaceSymbol " + error.stack);
    }
});
documents.onDidOpen(file => {
    if (file.document.languageId == "lua" && analyzerTotalSwitch) {
        try {
            let uri = Tools.urlDecode(file.document.uri);
            let luaExtname = Tools.getPathNameAndExt(uri);
            let ext = luaExtname['ext'];
            let loadedExt = Tools.getLoadedExt();
            if (loadedExt && loadedExt[ext] === true) {
                return;
            }
            else {
                for (const folder of Tools.getVSCodeOpenedFolders()) {
                    codeSymbol_1.CodeSymbol.createSymbolswithExt(ext, folder);
                }
                setTimeout(Tools.refresh_FileName_Uri_Cache, 0);
            }
        }
        catch (error) {
            codeLogManager_1.Logger.ErrorLog("[Error] onDidOpen " + error.stack);
        }
    }
});
documents.onDidChangeContent(change => {
    if (change.document.languageId == 'lua' && analyzerTotalSwitch) {
        try {
            const uri = Tools.urlDecode(change.document.uri);
            const text = change.document.getText();
            codeEditor_1.CodeEditor.saveCode(uri, text);
            if (!Tools.isinPreloadFolder(uri)) {
                codeSymbol_1.CodeSymbol.refreshOneDocSymbols(uri, text);
            }
            else {
                codeSymbol_1.CodeSymbol.refreshOneUserPreloadDocSymbols(Tools.uriToPath(uri));
            }
            getDocumentSettings(uri).then((settings) => {
                if (settings.codeLinting.checkWhileTyping == true) {
                    validateTextDocument(change.document);
                }
            });
        }
        catch (error) {
            codeLogManager_1.Logger.ErrorLog("[Error] onDidChangeContent " + error.stack);
        }
    }
});
documents.onDidSave(change => {
    if (!analyzerTotalSwitch)
        return;
    try {
        getDocumentSettings(change.document.uri).then((settings) => {
            if (settings.codeLinting.checkAfterSave == true) {
                validateTextDocument(change.document);
            }
        });
    }
    catch (error) {
        codeLogManager_1.Logger.ErrorLog("[Error] onDidSave " + error.stack);
    }
});
connection.onDocumentColor((handler) => {
    return new Array();
});
connection.onColorPresentation((handler) => {
    return new Array();
});
connection.onDocumentHighlight((handler) => {
    return new Array();
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'lua_analyzer'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        let settings = yield getDocumentSettings(textDocument.uri);
        if (settings.codeLinting.enable == false) {
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
            return;
        }
        let ignoreFolderRegExpArray = settings.codeLinting.ignoreFolderRegularExpression.split(';');
        if (ignoreFolderRegExpArray.length > 0) {
            if (Tools.isMatchedIgnoreRegExp(textDocument.uri, ignoreFolderRegExpArray)) {
                connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
                return;
            }
        }
        let globalSymbols = codeSymbol_1.CodeSymbol.getWorkspaceSymbols(Tools.SearchRange.GlobalSymbols);
        let globalVariables = Object.keys(globalSymbols);
        let luacheckProcess = codeLinting_1.CodeLinting.processLinting(textDocument, settings, globalVariables);
        luacheckProcess.then(() => {
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
        }, luaErrorOrWaining => {
            const diagnosticArray = codeLinting_1.CodeLinting.parseLuacheckResult(luaErrorOrWaining, settings);
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnosticArray });
        })
            .catch(() => {
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
        });
    });
}
documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map