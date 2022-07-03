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
const Tools = require("../codeTools");
const codeSymbol_1 = require("../codeSymbol");
const cppCodeProcessor_1 = require("./cppCodeProcessor");
const sluaCSharpProcessor_1 = require("./sluaCSharpProcessor");
const codeLogManager_1 = require("../codeLogManager");
const fs = require("fs");
class NativeCodeExportBase {
    static get LuaPandaInterfaceIntelliSenseResPath() {
        if (!this._LuaPandaInterfaceIntelliSenseResPath) {
            if (Tools.getVSCodeOpenedFolders() && Tools.getVSCodeOpenedFolders().length > 0) {
                this._LuaPandaInterfaceIntelliSenseResPath = Tools.getVSCodeOpenedFolders()[0] + "/.vscode/LuaPanda/IntelliSenseRes/";
            }
        }
        return this._LuaPandaInterfaceIntelliSenseResPath;
    }
    static loadIntelliSenseRes() {
        let dirPath = this.LuaPandaInterfaceIntelliSenseResPath;
        if (fs.existsSync(dirPath)) {
            codeSymbol_1.CodeSymbol.refreshUserPreloadSymbals(dirPath);
        }
    }
    static processNativeCodeDir(anaPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!fs.existsSync(anaPath)) {
                codeLogManager_1.Logger.ErrorLog("输入了不存在的路径! ");
                return;
            }
            anaPath = anaPath.trim();
            let cppfileCount = yield cppCodeProcessor_1.CppCodeProcessor.processCppDir(anaPath);
            let csfileCount = sluaCSharpProcessor_1.SluaCSharpProcessor.processluaCSDir(anaPath);
            let tipString = '处理完成，解析了 ';
            if (cppfileCount > 0) {
                tipString += cppfileCount + ' 个 cpp 文件, ';
            }
            if (csfileCount > 0) {
                tipString += csfileCount + ' 个 C# 文件. ';
            }
            tipString += '请重启 VSCode 以加载解析出的 lua 符号文件! ';
            Tools.showTips(tipString);
        });
    }
}
exports.NativeCodeExportBase = NativeCodeExportBase;
//# sourceMappingURL=nativeCodeExportBase.js.map