"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeSymbol_1 = require("./codeSymbol");
const codeDefinition_1 = require("./codeDefinition");
class CodeReference {
    static getSymbalReferences(info) {
        let refRet = new Array();
        let def = codeDefinition_1.CodeDefinition.getSymbalDefine(info, true);
        let findDocRes = codeSymbol_1.CodeSymbol.searchSymbolReferenceinDoc(def);
        refRet.concat(findDocRes);
        for (let index = 0; index < findDocRes.length; index++) {
            findDocRes[index].range.start.line = findDocRes[index].range.start.line - 1;
            findDocRes[index].range.start.character = findDocRes[index].range.start.column;
            findDocRes[index].range.end.line = findDocRes[index].range.end.line - 1;
            findDocRes[index].range.end.character = findDocRes[index].range.end.column;
        }
        return findDocRes;
    }
}
exports.CodeReference = CodeReference;
//# sourceMappingURL=codeReference.js.map