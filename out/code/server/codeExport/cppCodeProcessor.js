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
const path = require("path");
const dir = require("path-reader");
const fs = require("fs");
const univac_1 = require("univac");
const codeLogManager_1 = require("../codeLogManager");
const codeSymbol_1 = require("../codeSymbol");
const Tools = require("../codeTools");
class CppCodeProcessor {
    static get cppInterfaceIntelliSenseResPath() {
        if (!this._cppInterfaceIntelliSenseResPath) {
            if (Tools.getVSCodeOpenedFolders() && Tools.getVSCodeOpenedFolders().length > 0) {
                this._cppInterfaceIntelliSenseResPath = Tools.getVSCodeOpenedFolders()[0] + "/.vscode/LuaPanda/IntelliSenseRes/UECppInterface/";
            }
        }
        return this._cppInterfaceIntelliSenseResPath;
    }
    static loadIntelliSenseRes() {
        if (fs.existsSync(this.cppInterfaceIntelliSenseResPath)) {
            codeSymbol_1.CodeSymbol.refreshUserPreloadSymbals(this.cppInterfaceIntelliSenseResPath);
        }
    }
    static processCppDir(cppDir) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cppInterfaceIntelliSenseResPath === null) {
                codeLogManager_1.Logger.ErrorLog('未打开文件夹，无法使用此功能！');
                Tools.showTips('未打开文件夹，无法使用此功能！');
                return;
            }
            Tools.showTips('正在分析处理中，请稍后。分析完成后会有提示，请不要重复点击。');
            let subDir = cppDir;
            subDir = subDir.replace(/\//g, ' ');
            subDir = subDir.replace(/\\/g, ' ');
            subDir = subDir.replace(/:/g, '');
            subDir = subDir.trim();
            subDir = subDir.replace(/ /g, '-');
            this.removeCppInterfaceIntelliSenseRes(path.join(this.cppInterfaceIntelliSenseResPath, subDir));
            let cppHeaderFiles = this.getCppHeaderFiles(cppDir);
            let cppSourceFiles = this.getCppSourceFiles(cppDir);
            let totalProcessNum = yield this.processParse(cppHeaderFiles, cppSourceFiles, subDir);
            return totalProcessNum;
        });
    }
    static processParse(cppHeaderFiles, cppSourceFiles, subDir) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.parseCppFiles(cppHeaderFiles, CppFileType.CppHeaderFile, subDir);
            yield this.parseCppFiles(cppSourceFiles, CppFileType.CppSourceFile, subDir);
            let totalProcessNum = cppHeaderFiles.length + cppSourceFiles.length;
            return Promise.resolve(totalProcessNum);
        });
    }
    static parseCppFiles(filePaths, cppFileType, subDir) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < filePaths.length; i++) {
                let cppText = this.getCppCode(filePaths[i], cppFileType);
                if (cppText === '') {
                    continue;
                }
                let astNode;
                try {
                    astNode = yield univac_1.parseAst({
                        input: cppText,
                        language: univac_1.Language.cpp,
                        omitPosition: true,
                        text: true,
                        basePath: this.getWasmDir()
                    });
                    if (cppFileType === CppFileType.CppHeaderFile) {
                        this.parseCppHeaderAST2LuaCode(astNode, subDir);
                    }
                    else if (cppFileType === CppFileType.CppSourceFile) {
                        let classFunctionInfo = this.getClassFunctionInfo(astNode);
                        this.parseCppSourceAST2LuaCode(astNode, classFunctionInfo, subDir);
                    }
                }
                catch (e) {
                    codeLogManager_1.Logger.ErrorLog("Parse cpp file failed, filePath: " + filePaths[i] + " error: ");
                    codeLogManager_1.Logger.ErrorLog(e);
                }
            }
        });
    }
    static getCppCode(filePath, cppFileType) {
        let content = Tools.getFileContent(filePath);
        if (this.isFileNeedParse(cppFileType, content) === false) {
            return '';
        }
        content = this.pretreatCppCode(content);
        return content;
    }
    static isFileNeedParse(cppFileType, content) {
        let regex;
        let result;
        switch (cppFileType) {
            case CppFileType.CppHeaderFile:
                regex = URegex.UCLASS;
                if ((result = regex.exec(content)) !== null) {
                    return true;
                }
                regex = URegex.USTRUCT;
                if ((result = regex.exec(content)) !== null) {
                    return true;
                }
                regex = URegex.UENUM;
                if ((result = regex.exec(content)) !== null) {
                    return true;
                }
                break;
            case CppFileType.CppSourceFile:
                regex = URegex.DefLuaClass;
                if ((result = regex.exec(content)) !== null) {
                    return true;
                }
                break;
        }
        return false;
    }
    static pretreatCppCode(content) {
        let regex;
        let result;
        regex = /\s*(class\s+[A-Z0-9_]+)\s+\w+.+/;
        while ((result = regex.exec(content)) !== null) {
            content = content.replace(result[1], 'class');
        }
        regex = /\s*(struct\s+[A-Z0-9_]+)\s+\w+.+/;
        while ((result = regex.exec(content)) !== null) {
            content = content.replace(result[1], 'struct');
        }
        let regex2CommentArray = new Array();
        regex2CommentArray.push(URegex.GENERATED_BODY);
        regex2CommentArray.push(URegex.GENERATED_UCLASS_BODY);
        regex2CommentArray.push(URegex.GENERATED_USTRUCT_BODY);
        regex2CommentArray.push(URegex.UE_DEPRECATED);
        regex2CommentArray.push(URegex.DEPRECATED);
        regex2CommentArray.push(URegex.DECLARE);
        regex2CommentArray.push(URegex.PRAGMA);
        let regex2BlankArray = new Array();
        regex2BlankArray.push(URegex.UMETA);
        regex2BlankArray.push(URegex.ENGINE_API);
        content = this.removeByRegex(content, regex2CommentArray, regex2BlankArray);
        return content;
    }
    static removeByRegex(content, regex2CommentArray, regex2BlankArray) {
        let result;
        regex2CommentArray.forEach((regex) => {
            while ((result = regex.exec(content)) !== null) {
                content = content.replace(result[1], '//');
            }
        });
        regex2BlankArray.forEach((regex) => {
            while ((result = regex.exec(content)) !== null) {
                content = content.replace(result[1], '');
            }
        });
        return content;
    }
    static parseCppHeaderAST2LuaCode(astNode, subDir) {
        let foundUCLASS = false;
        let foundUSTRUCT = false;
        let foundUENUM = false;
        astNode.children.forEach((child) => {
            if (child.type === 'comment') {
                return;
            }
            if (child.type === 'expression_statement' && child.text.match(URegex.UCLASS)) {
                foundUCLASS = true;
            }
            else if (child.type === 'expression_statement' && child.text.match(URegex.USTRUCT)) {
                foundUSTRUCT = true;
            }
            else if (child.type === 'expression_statement' && child.text.match(URegex.UENUM)) {
                foundUENUM = true;
            }
            else if (foundUCLASS === true) {
                let result = this.handleUCLASS(child);
                foundUCLASS = false;
                if (result.className !== '') {
                    let filePath = path.join(this.cppInterfaceIntelliSenseResPath, subDir, result.className + '.lua');
                    this.appendText2File(result.luaText, filePath);
                    codeSymbol_1.CodeSymbol.refreshOneUserPreloadDocSymbols(filePath);
                }
            }
            else if (foundUSTRUCT === true) {
                let result = this.handleUSTRUCT(child);
                foundUSTRUCT = false;
                if (result.structName !== '') {
                    let filePath = path.join(this.cppInterfaceIntelliSenseResPath, subDir, result.structName + '.lua');
                    this.appendText2File(result.luaText, filePath);
                    codeSymbol_1.CodeSymbol.refreshOneUserPreloadDocSymbols(filePath);
                }
            }
            else if (foundUENUM === true) {
                let result = this.handleUENUM(child);
                foundUENUM = false;
                if (result.enumType !== '') {
                    let filePath = path.join(this.cppInterfaceIntelliSenseResPath, subDir, result.enumType + '.lua');
                    this.appendText2File(result.luaText, filePath);
                    codeSymbol_1.CodeSymbol.refreshOneUserPreloadDocSymbols(filePath);
                }
                child.children.forEach((child) => {
                    if (child.type === 'declaration_list') {
                        this.parseCppHeaderAST2LuaCode(child, subDir);
                    }
                });
            }
        });
    }
    static handleUCLASS(astNode) {
        let luaText = '';
        let className = '';
        let baseClass = [];
        let declarationList = { uPropertys: '', uFunctions: '' };
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'type_identifier':
                    className = child.text;
                    break;
                case 'base_class_clause':
                    baseClass = baseClass.concat(this.handleBaseClassClause(child, className));
                    break;
                case 'field_declaration_list':
                    declarationList = this.handleDeclarationList(child, className);
                    break;
            }
        });
        luaText = declarationList.uPropertys + declarationList.uFunctions;
        let classDeclaration;
        if (baseClass.length > 0) {
            classDeclaration = className + ' = {} ---@type ' + baseClass[0] + '\n';
        }
        else {
            classDeclaration = className + ' = {}\n';
        }
        return { luaText: classDeclaration + luaText, className: className };
    }
    static handleUSTRUCT(astNode) {
        let luaText = '';
        let structName = '';
        let declarationList = { uPropertys: '', uFunctions: '' };
        if (astNode.type === 'struct_specifier') {
            astNode.children.forEach((child) => {
                switch (child.type) {
                    case 'type_identifier':
                        structName = child.text;
                        break;
                    case 'field_declaration_list':
                        declarationList = this.handleDeclarationList(child, structName);
                        break;
                }
            });
            luaText = declarationList.uPropertys + declarationList.uFunctions;
            let structDeclaration;
            structDeclaration = structName + ' = {}\n';
            luaText = structDeclaration + luaText;
        }
        else if (astNode.type === 'declaration') {
            astNode.children.forEach((child) => {
                if (child.type === 'struct_specifier') {
                    let result = this.handleUSTRUCT(child);
                    luaText = result.luaText;
                    structName = result.structName;
                }
            });
        }
        return { luaText: luaText, structName: structName };
    }
    static handleUENUM(astNode) {
        let luaText = '';
        let enumType = '';
        if (astNode.type === 'namespace_definition') {
            astNode.children.forEach((child) => {
                switch (child.type) {
                    case 'identifier':
                        enumType = child.text;
                        break;
                    case 'declaration_list':
                        child.children.forEach((child) => {
                            if (child.type === 'enum_specifier') {
                                let result = this.handleEnumSpecifier(child);
                                luaText += enumType + ' = {}\n';
                                result.enumeratorList.forEach((enumerator) => {
                                    luaText += enumType + '.' + enumerator + ' = nil\n';
                                });
                            }
                        });
                        break;
                }
            });
        }
        else if (astNode.type === 'enum_specifier') {
            let result = this.handleEnumSpecifier(astNode);
            enumType = result.enumType;
            luaText += enumType + ' = {}\n';
            result.enumeratorList.forEach((enumerator) => {
                luaText += enumType + '.' + enumerator + ' = nil\n';
            });
        }
        else if (astNode.type === 'declaration') {
            astNode.children.forEach((child) => {
                if (child.type === 'init_declarator') {
                    let result = this.handleInitDeclarator(child);
                    enumType = result.enumType;
                    luaText += enumType + ' = {}\n';
                    result.enumeratorList.forEach((enumerator) => {
                        luaText += enumType + '.' + enumerator + ' = nil\n';
                    });
                }
            });
        }
        return { enumType: enumType, luaText: luaText };
    }
    static handleInitDeclarator(astNode) {
        let enumType = '';
        let enumeratorList = [];
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'identifier':
                    enumType = child.text;
                    break;
                case 'initializer_list':
                    enumeratorList = this.handleEnumeratorList(child);
                    break;
            }
        });
        return { enumType: enumType, enumeratorList: enumeratorList };
    }
    static handleEnumSpecifier(astNode) {
        let enumType = '';
        let enumeratorList = [];
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'type_identifier':
                    enumType = child.text;
                    break;
                case 'enumerator_list':
                    enumeratorList = this.handleEnumeratorList(child);
                    break;
            }
        });
        return { enumType: enumType, enumeratorList: enumeratorList };
    }
    static handleEnumeratorList(astNode) {
        let enumeratorList = [];
        astNode.children.forEach((child) => {
            if (child.type === 'identifier') {
                enumeratorList.push(child.text);
            }
            else if (child.type === 'enumerator') {
                child.children.forEach((child) => {
                    if (child.type === 'identifier') {
                        enumeratorList.push(child.text);
                    }
                });
            }
        });
        return enumeratorList;
    }
    static handleBaseClassClause(astNode, className) {
        let baseClass = [];
        astNode.children.forEach((child) => {
            if (child.type === 'type_identifier') {
                baseClass.push(child.text);
            }
        });
        return baseClass;
    }
    static handleDeclarationList(astNode, className) {
        let uPropertys = '';
        let uFunctions = '';
        let foundUFUNCTION = false;
        let foundUPROPERTY = false;
        astNode.children.forEach((child) => {
            if (child.type === 'comment') {
                return;
            }
            if (foundUFUNCTION === true) {
                uFunctions += this.handleUFUNCTION(child, className);
                foundUFUNCTION = false;
            }
            else if (foundUPROPERTY === true) {
                uPropertys += this.handleUPROPERTY(child, className);
                foundUPROPERTY = false;
            }
            else if ((child.type === 'field_declaration' || child.type === 'declaration') && child.text.match(URegex.UFUNCTION)) {
                foundUFUNCTION = true;
            }
            else if ((child.type === 'field_declaration' || child.type === 'declaration') && child.text.match(URegex.UPROPERTY)) {
                foundUPROPERTY = true;
            }
            else if (child.type === 'preproc_if' || child.type === 'preproc_ifdef') {
                let declarationList = this.handleDeclarationList(child, className);
                uPropertys += declarationList.uPropertys;
                uFunctions += declarationList.uFunctions;
            }
        });
        return { uPropertys: uPropertys, uFunctions: uFunctions };
    }
    static handleUFUNCTION(astNode, className) {
        let luaText = 'function ';
        let returnType = '';
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'type_identifier':
                case 'primitive_type':
                    returnType = child.text;
                    break;
                case 'template_type':
                    returnType = this.getTemplateType(child);
                    break;
                case 'class_specifier':
                    returnType = this.getClassInfo(child).className;
                    break;
                case 'struct_specifier':
                    returnType = this.getStructType(child);
                    break;
                case 'function_declarator':
                    luaText += this.handleFunctionDeclarator(child, className);
                    break;
                case 'pointer_declarator':
                case 'reference_declarator':
                    child.children.forEach((child) => {
                        if (child.type === 'function_declarator') {
                            luaText += this.handleFunctionDeclarator(child, className);
                        }
                    });
                    break;
            }
        });
        luaText += ' end\n';
        if (this.returnTypeMap.has(returnType)) {
            returnType = this.returnTypeMap.get(returnType);
        }
        if (returnType !== '') {
            luaText = '---@return ' + returnType + '\n' + luaText;
        }
        return luaText;
    }
    static handleFunctionDeclarator(astNode, className) {
        let luaText = '';
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'identifier':
                case 'field_identifier':
                    luaText += className + '.' + child.text;
                    break;
                case 'parameter_list':
                    luaText += this.handleParameterList(child, className);
                    break;
            }
        });
        luaText += ')';
        return luaText;
    }
    static handleParameterList(astNode, className) {
        let luaText = '(';
        let params = [];
        astNode.children.forEach((child) => {
            if (child.type === 'parameter_declaration') {
                params = params.concat(this.handleParameterDeclaration(child));
            }
        });
        for (let i = 0; i < params.length; i++) {
            if (i === 0) {
                luaText += params[i];
            }
            else {
                luaText += ", " + params[i];
            }
        }
        return luaText;
    }
    static handleParameterDeclaration(astNode) {
        let params = [];
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'reference_declarator':
                    params.push(this.handleReferenceDeclarator(child));
                    break;
                case 'pointer_declarator':
                    params.push(this.handlePointerDeclarator(child));
                    break;
                case 'identifier':
                    params.push(child.text);
                    break;
            }
        });
        return params;
    }
    static handleReferenceDeclarator(astNode) {
        let param = '';
        astNode.children.forEach((child) => {
            if (child.type === 'identifier') {
                param = child.text;
            }
        });
        return param;
    }
    static handlePointerDeclarator(astNode) {
        let param = '';
        astNode.children.forEach((child) => {
            if (child.type === 'identifier') {
                param = child.text;
            }
        });
        return param;
    }
    static getTemplateType(astNode) {
        let templateType = '';
        astNode.children.forEach((child) => {
            if (child.type === 'type_identifier') {
                templateType = child.text;
            }
        });
        return templateType;
    }
    static getStructType(astNode) {
        let structType = '';
        astNode.children.forEach((child) => {
            if (child.type === 'type_identifier') {
                structType = child.text;
            }
        });
        return structType;
    }
    static handleUPROPERTY(astNode, className) {
        let luaText = '';
        astNode.children.forEach((child) => {
            switch (child.type) {
                case 'identifier':
                case 'field_identifier':
                    luaText += className + '.' + child.text + " = nil\n";
                    break;
                case 'init_declarator':
                    child.children.forEach((child) => {
                        if (child.type === 'identifier') {
                            luaText += className + '.' + child.text + " = nil\n";
                        }
                    });
                    break;
                case 'pointer_declarator':
                case 'reference_declarator':
                    child.children.forEach((child) => {
                        if (child.type === 'field_identifier') {
                            luaText += className + '.' + child.text + " = nil\n";
                        }
                    });
                    break;
            }
        });
        return luaText;
    }
    static getClassFunctionInfo(astNode) {
        let classFunctionInfo = new Map();
        astNode.children.forEach((child) => {
            if (child.type === 'namespace_definition') {
                child.children.forEach((child) => {
                    if (child.type === 'declaration_list') {
                        child.children.forEach((child) => {
                            if (child.type === 'class_specifier') {
                                let classInfo = this.getClassInfo(child);
                                if (classInfo.className !== '' && classInfo.functionListMap !== undefined) {
                                    classFunctionInfo.set(classInfo.className, classInfo.functionListMap);
                                }
                            }
                        });
                    }
                });
            }
            else if (child.type === 'class_specifier') {
                let classInfo = this.getClassInfo(child);
                classFunctionInfo.set(classInfo.className, classInfo.functionListMap);
            }
        });
        return classFunctionInfo;
    }
    static getClassInfo(astNode) {
        let className = '';
        let functionListMap = new Map();
        astNode.children.forEach((child) => {
            if (child.type === 'type_identifier') {
                className = child.text;
            }
            else if (child.type === 'field_declaration_list') {
                child.children.forEach((child) => {
                    if (child.type === 'function_definition') {
                        let functionInfo = this.getFunctionInfo(child);
                        if (functionInfo.functionName !== '') {
                            functionListMap.set(functionInfo.functionName, functionInfo.paramList);
                        }
                    }
                });
            }
        });
        return { className: className, functionListMap: functionListMap };
    }
    static getFunctionInfo(astNode) {
        let functionName = '';
        let paramList = [];
        astNode.children.forEach((child) => {
            if (child.type === 'function_declarator') {
                child.children.forEach((child) => {
                    if (child.type === 'identifier' || child.type === 'field_identifier') {
                        functionName = child.text;
                    }
                    else if (child.type === 'parameter_list') {
                        paramList = this.getParamList(child);
                    }
                });
            }
        });
        return { functionName: functionName, paramList: paramList };
    }
    static getParamList(astNode) {
        let paramList = [];
        astNode.children.forEach((child) => {
            if (child.type === 'parameter_declaration') {
                paramList = paramList.concat(this.handleParameterDeclaration(child));
            }
        });
        return paramList;
    }
    static parseCppSourceAST2LuaCode(astNode, classFunctionInfo, subDir) {
        let className = "";
        let baseClass = [];
        let methodList = [];
        astNode.children.forEach((child) => {
            if (child.type === 'comment') {
                return;
            }
            if (child.type === 'expression_statement' && child.text.match(URegex.DefLuaClass)) {
                let result = this.handleDefLuaClass(child);
                className = result.className;
                baseClass = result.baseClass;
            }
            else if (child.type === 'expression_statement' && child.text.match(URegex.DefLuaMethod)) {
                let functionInfo = classFunctionInfo.get(className);
                methodList.push(this.handleDefLuaMethod(child, className, functionInfo));
            }
            else if (child.type === 'expression_statement' && child.text.match(URegex.EndDef)) {
                if (className !== '') {
                    let filePath = path.join(this.cppInterfaceIntelliSenseResPath, subDir, className + '.lua');
                    let luaText = this.assembleLuaClassText(className, baseClass, methodList);
                    this.appendText2File(luaText, filePath);
                    codeSymbol_1.CodeSymbol.refreshOneUserPreloadDocSymbols(filePath);
                    className = '';
                    baseClass.length = 0;
                    methodList.length = 0;
                }
            }
            else if (child.type === 'namespace_definition') {
                child.children.forEach((child) => {
                    if (child.type === 'declaration_list') {
                        this.parseCppSourceAST2LuaCode(child, classFunctionInfo, subDir);
                    }
                });
            }
        });
    }
    static handleDefLuaClass(astNode) {
        let argumentList = [];
        let argumentListNode;
        astNode.children.forEach((child) => {
            if (child.type === 'call_expression') {
                child.children.forEach((child) => {
                    if (child.type === 'argument_list') {
                        argumentListNode = child;
                    }
                });
            }
        });
        argumentListNode.children.forEach((child) => {
            if (child.type === 'identifier') {
                argumentList.push(child.text);
            }
        });
        return { className: argumentList[0], baseClass: argumentList.slice(1) };
    }
    static handleDefLuaMethod(astNode, className, functionInfo) {
        let luaText = 'function ';
        astNode.children.forEach((child) => {
            if (child.type === 'call_expression') {
                child.children.forEach((child) => {
                    if (child.type === 'argument_list') {
                        child.children.forEach((child) => {
                            if (child.type === 'identifier') {
                                luaText += className + '.' + child.text + '(';
                                if (functionInfo.has(child.text)) {
                                    let paramList = functionInfo.get(child.text);
                                    for (let i = 0; i < paramList.length; i++) {
                                        if (i === 0) {
                                            luaText += paramList[i];
                                        }
                                        else {
                                            luaText += ", " + paramList[i];
                                        }
                                    }
                                }
                                luaText += ')';
                            }
                        });
                    }
                });
            }
        });
        luaText += ' end\n';
        return luaText;
    }
    static assembleLuaClassText(className, baseClass, methodList) {
        let luaText = className + ' = {}';
        if (baseClass.length > 0) {
            luaText += ' ---@type ' + baseClass[0] + '\n';
        }
        else {
            luaText += '\n';
        }
        methodList.forEach((method) => {
            luaText += method;
        });
        return luaText;
    }
    static get returnTypeMap() {
        if (!this._returnTypeMap) {
            this._returnTypeMap = new Map();
            this._returnTypeMap.set('void', '');
            this._returnTypeMap.set('int', 'number');
            this._returnTypeMap.set('int8', 'number');
            this._returnTypeMap.set('int16', 'number');
            this._returnTypeMap.set('int32', 'number');
            this._returnTypeMap.set('int64', 'number');
            this._returnTypeMap.set('uint8', 'number');
            this._returnTypeMap.set('uint16', 'number');
            this._returnTypeMap.set('uint32', 'number');
            this._returnTypeMap.set('uint64', 'number');
            this._returnTypeMap.set('float', 'number');
            this._returnTypeMap.set('double', 'number');
            this._returnTypeMap.set('bool', 'boolean');
            this._returnTypeMap.set('FName', 'string');
            this._returnTypeMap.set('FString', 'string');
            this._returnTypeMap.set('FText', 'string');
        }
        return this._returnTypeMap;
    }
    static getWasmDir() {
        return path.join(Tools.getVScodeExtensionPath(), "node_modules/univac/dist/static/");
    }
    static getCppHeaderFiles(dirPath) {
        let options = {
            sync: true,
            recursive: true,
            valuetizer: function (stat, fileShortName, fileFullPath) {
                if (stat.isDirectory()) {
                    return fileFullPath;
                }
                return fileShortName.match(/\.h$/) ? fileFullPath : null;
            }
        };
        return dir.files(dirPath, 'file', null, options);
    }
    static getCppSourceFiles(dirPath) {
        let options = {
            sync: true,
            recursive: true,
            valuetizer: function (stat, fileShortName, fileFullPath) {
                if (stat.isDirectory()) {
                    return fileFullPath;
                }
                return fileShortName.match(/\.cpp$/) ? fileFullPath : null;
            }
        };
        return dir.files(dirPath, 'file', null, options);
    }
    static appendText2File(text, filePath) {
        let dirPath = path.dirname(filePath);
        this.makeDirSync(dirPath);
        let options = {
            flag: 'a'
        };
        try {
            fs.writeFileSync(filePath, text, options);
        }
        catch (e) {
            codeLogManager_1.Logger.ErrorLog('写入文件出错，filePath: ' + filePath + 'error: ');
            codeLogManager_1.Logger.ErrorLog(e);
        }
    }
    static makeDirSync(dirPath) {
        if (fs.existsSync(dirPath)) {
            return;
        }
        let baseDir = path.dirname(dirPath);
        this.makeDirSync(baseDir);
        fs.mkdirSync(dirPath);
    }
    static removeCppInterfaceIntelliSenseRes(dirPath) {
        if (fs.existsSync(dirPath)) {
            let files = fs.readdirSync(dirPath);
            files.forEach((file) => {
                let currentPath = path.join(dirPath, file);
                if (fs.statSync(currentPath).isDirectory()) {
                    this.removeCppInterfaceIntelliSenseRes(currentPath);
                }
                else {
                    fs.writeFileSync(currentPath, '');
                    codeSymbol_1.CodeSymbol.refreshOneUserPreloadDocSymbols(currentPath);
                    fs.unlinkSync(currentPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }
}
exports.CppCodeProcessor = CppCodeProcessor;
class URegex {
}
URegex.UCLASS = new RegExp(/\s*(UCLASS\s*\(.*\))/);
URegex.USTRUCT = new RegExp(/\s*(USTRUCT\s*\(.*\))/);
URegex.UENUM = new RegExp(/\s*(UENUM\s*\(.*\))/);
URegex.UFUNCTION = new RegExp(/\s*(UFUNCTION\s*\(.*\))/);
URegex.UPROPERTY = new RegExp(/\s*(UPROPERTY\s*\(.*\))/);
URegex.GENERATED_BODY = new RegExp(/\s*(GENERATED_BODY\s*\(.*\))/);
URegex.GENERATED_UCLASS_BODY = new RegExp(/\s*(GENERATED_UCLASS_BODY\s*\(.*\))/);
URegex.GENERATED_USTRUCT_BODY = new RegExp(/\s*(GENERATED_USTRUCT_BODY\s*\(.*\))/);
URegex.DEPRECATED = new RegExp(/\s*(DEPRECATED\s*\(.*\))/);
URegex.UE_DEPRECATED = new RegExp(/\s*(UE_DEPRECATED\s*\(.*\))/);
URegex.PRAGMA = new RegExp(/\s*(PRAGMA_\w+WARNINGS)/);
URegex.DECLARE = new RegExp(/\s*(DECLARE_\w+\s*\(.*\))/);
URegex.UMETA = new RegExp(/\s*(UMETA\s*\(.*\))/);
URegex.ENGINE_API = new RegExp(/(ENGINE_API\s*)/);
URegex.DefLuaClass = new RegExp(/\s*(DefLuaClass\s*\(.*\))/);
URegex.DefLuaMethod = new RegExp(/\s*(DefLuaMethod\s*\(.*\))/);
URegex.EndDef = new RegExp(/\s*(EndDef\s*\(.*\))/);
var CppFileType;
(function (CppFileType) {
    CppFileType[CppFileType["CppHeaderFile"] = 0] = "CppHeaderFile";
    CppFileType[CppFileType["CppSourceFile"] = 1] = "CppSourceFile";
})(CppFileType || (CppFileType = {}));
//# sourceMappingURL=cppCodeProcessor.js.map