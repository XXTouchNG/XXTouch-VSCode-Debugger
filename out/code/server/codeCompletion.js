"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeEditor_1 = require("./codeEditor");
const Tools = require("./codeTools");
const vscode_languageserver_1 = require("vscode-languageserver");
const codeSymbol_1 = require("./codeSymbol");
const codeDefinition_1 = require("./codeDefinition");
const typeInfer_1 = require("./typeInfer");
const util_1 = require("util");
class CodeCompletion {
    static completionEntry(uri, pos) {
        let luaText = codeEditor_1.CodeEditor.getCode(uri);
        let userInputString = Tools.getTextByPosition(luaText, pos);
        if (userInputString == "---") {
            let completingArray = this.completionComment(uri, pos, luaText);
            return completingArray;
        }
        userInputString = userInputString.replace(/:/g, ".");
        let searchResArray = this.commonCompletionSearch(uri, userInputString) || [];
        let retCompletionArray;
        let userInputSplitArr = this.splitStringwithTrigger(userInputString);
        if (userInputSplitArr && userInputSplitArr.length > 1) {
            let lastPrefixSearchRet = typeInfer_1.TypeInfer.SymbolTagForCompletionEntry(uri, userInputString) || [];
            searchResArray = searchResArray.concat(lastPrefixSearchRet);
            retCompletionArray = this.symbolToCompletionArray(searchResArray, true);
        }
        else {
            retCompletionArray = this.symbolToCompletionArray(searchResArray);
        }
        let retCompletionItem = this.completeItemDuplicateRemoval(retCompletionArray);
        return retCompletionItem;
    }
    static fmtParamToSnippet(paramArray) {
        let snippet = '(' + paramArray.map((param, i) => `\${${i + 1}:${param}}`).join(', ') + ')';
        return snippet;
    }
    static getDocCommentInsertText(functionName, paramArray) {
        let docCommentSnippet = functionName + " ${1:Description of the function}";
        let maxParamLength = 0;
        paramArray.forEach((param) => {
            maxParamLength = Math.max(maxParamLength, param.length);
        });
        let i = 2;
        paramArray.forEach((param) => {
            param += Tools.getNSpace(maxParamLength - param.length);
            docCommentSnippet += `\n---@param ${param} \${${i++}:Type} \${${i++}:Description}`;
        });
        docCommentSnippet += `\n\${${i++}:---@return } \${${i++}:Type} \${${i++}:Description}`;
        return docCommentSnippet;
    }
    static getReturnComment() {
        let completeItem = {
            label: "mark return",
            kind: vscode_languageserver_1.CompletionItemKind.Snippet,
            insertText: "@return ",
            detail: "Mark return type for this function. ",
            insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
        };
        return completeItem;
    }
    static getDocCommentCompletingItem(uri, line) {
        let functionInfo = codeDefinition_1.CodeDefinition.getFunctionInfoByLine(uri, line);
        if (functionInfo.functionName == "") {
            return null;
        }
        let completeItem = {
            label: functionInfo.functionName + " comment",
            kind: vscode_languageserver_1.CompletionItemKind.Snippet,
            insertText: this.getDocCommentInsertText(functionInfo.functionName, functionInfo.functionParam),
            detail: "Write comments or mark return type for this function. ",
            insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
        };
        return completeItem;
    }
    static commentVarTypeTips(uri, line) {
        let completeItem = {
            label: "@type",
            kind: vscode_languageserver_1.CompletionItemKind.Snippet,
            insertText: "@type ${1:Type} ${2:Description}",
            detail: "comment var type",
            insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
        };
        return completeItem;
    }
    static splitStringwithTrigger(str) {
        let userInputTxt_DotToBlank = str.replace(/[\.:]/g, ' ');
        let userInputArr = userInputTxt_DotToBlank.split(' ');
        return userInputArr;
    }
    static symbolToCompletionArray(retSymb, onlyKeepPostfix = false) {
        if (!util_1.isArray(retSymb)) {
            return [];
        }
        let completingArray = [];
        for (let idx = 0; idx < retSymb.length; idx++) {
            let finalInsertText = retSymb[idx].searchName;
            if (onlyKeepPostfix) {
                let userInputSplitArr = this.splitStringwithTrigger(finalInsertText);
                finalInsertText = userInputSplitArr.pop();
            }
            let completeKind;
            let labelTxt = finalInsertText;
            switch (retSymb[idx].kind) {
                case 12:
                    completeKind = vscode_languageserver_1.CompletionItemKind.Function;
                    finalInsertText = finalInsertText + this.fmtParamToSnippet(retSymb[idx].funcParamArray);
                    break;
                default:
                    completeKind = vscode_languageserver_1.CompletionItemKind.Text;
            }
            let completeItem = {
                label: labelTxt,
                kind: completeKind,
                insertText: finalInsertText,
                detail: retSymb[idx].name,
                insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
            };
            if (completeItem.label == undefined) {
                completeItem.label = "Undefined error";
            }
            else {
                completingArray.push(completeItem);
            }
        }
        return completingArray;
    }
    static commonCompletionSearch(uri, searchPrefix) {
        let retSymb = codeSymbol_1.CodeSymbol.searchSymbolforCompletion(uri, searchPrefix, Tools.SearchMode.PrefixMatch);
        if (!util_1.isArray(retSymb)) {
            return [];
        }
        return retSymb;
    }
    static completionComment(uri, pos, luaText) {
        let completingArray = new Array();
        if (Tools.isNextLineHasFunction(luaText, pos) == true) {
            completingArray.push(this.getDocCommentCompletingItem(uri, pos.line + 1));
            completingArray.push(this.getReturnComment());
        }
        else {
            completingArray.push(this.commentVarTypeTips(uri, pos.line));
        }
        return completingArray;
    }
    static completeItemDuplicateRemoval(completingArray) {
        let retCompItemList = new Array();
        for (let index = 0; index < completingArray.length; index++) {
            let DuplicateFlag = false;
            const completeItem = completingArray[index];
            for (let retIdx = 0, len = retCompItemList.length; retIdx < len; retIdx++) {
                if (this.ItemIsEq(completeItem, retCompItemList[retIdx])) {
                    DuplicateFlag = true;
                    break;
                }
            }
            if (!DuplicateFlag) {
                retCompItemList.push(completeItem);
            }
        }
        return retCompItemList;
    }
    static ItemIsEq(item1, item2) {
        if (item1.label === item2.label &&
            item1.kind === item2.kind &&
            item1.insertText === item2.insertText &&
            item1.insertTextFormat === item2.insertTextFormat) {
            return true;
        }
        return false;
    }
}
exports.CodeCompletion = CodeCompletion;
//# sourceMappingURL=codeCompletion.js.map