"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Tools_1 = require("../common/Tools");
const fs = require("fs");
const vscode = require("vscode");
const logManager_1 = require("../common/logManager");
class VisualSetting {
    static setLaunchjson(rootFolder, key, value, tag = '') {
        let settings = this.readLaunchjson(rootFolder);
        for (const keyLaunch in settings.configurations) {
            let valueLaunch = settings.configurations[keyLaunch];
            if (tag === '' || valueLaunch["tag"] === tag) {
                valueLaunch[key] = value;
            }
        }
        let launchJson = JSON.stringify(settings, null, 4);
        Tools_1.Tools.writeFileContent(rootFolder + "/.vscode/launch.json", launchJson);
    }
    static getLaunchjson(rootFolder, key, tag = '') {
        let settings = this.readLaunchjson(rootFolder);
        for (const keyLaunch in settings.configurations) {
            let valueLaunch = settings.configurations[keyLaunch];
            if (tag === '' || valueLaunch["tag"] === tag) {
                return valueLaunch[key];
            }
        }
    }
    static readLaunchjson(rootFolder) {
        let launchPath = rootFolder + "/.vscode/launch.json";
        let launchExist = fs.existsSync(launchPath);
        let jsonStr;
        if (!launchExist) {
            let dotVScodeDirExist = fs.existsSync(rootFolder + "/.vscode");
            if (!dotVScodeDirExist) {
                fs.mkdirSync(rootFolder + "/.vscode");
            }
            let launchTemplate = Tools_1.Tools.readFileContent(Tools_1.Tools.VSCodeExtensionPath + "/res/others/launch.json");
            Tools_1.Tools.writeFileContent(rootFolder + "/.vscode/launch.json", launchTemplate);
            jsonStr = launchTemplate;
        }
        else {
            jsonStr = Tools_1.Tools.readFileContent(launchPath);
        }
        if (jsonStr == null || jsonStr == '') {
            return null;
        }
        let reg = /[^:]((\/\/.*)|(\/\*[\s\S]*?\*\/))/g;
        jsonStr = jsonStr.replace(reg, '');
        let launchSettings = JSON.parse(jsonStr);
        return launchSettings;
    }
    static getLaunchData(rootFolderArray) {
        let jsonObj = new Object();
        let snippetsPath = Tools_1.Tools.VSCodeExtensionPath + "/res/snippets/snippets.json";
        let isOpenAnalyzer = true;
        let snipContent = fs.readFileSync(snippetsPath);
        if (snipContent.toString().trim() == '') {
            isOpenAnalyzer = false;
        }
        jsonObj["command"] = "init_setting";
        jsonObj["isOpenAnalyzer"] = isOpenAnalyzer;
        jsonObj["configs"] = [];
        let index = 0;
        for (const forderName in rootFolderArray) {
            let rootFolder = rootFolderArray[forderName];
            jsonObj["configs"][index] = { "path": rootFolder, "launch.json": {} };
            let settings = this.readLaunchjson(rootFolder);
            for (const key in settings.configurations) {
                const v = settings.configurations[key];
                if (v["tag"] === "normal" || v["name"] === "LuaPanda") {
                    jsonObj["configs"][index]["launch.json"][v["name"]] = v;
                }
                else if (v["tag"] === "attach" || v["name"] === "LuaPanda-Attach") {
                    jsonObj["configs"][index]["launch.json"][v["name"]] = v;
                }
                else if (v["tag"] === "independent_file" || v["name"] === "LuaPanda-IndependentFile") {
                    jsonObj["configs"][index]["launch.json"][v["name"]] = v;
                }
            }
            if (Object.keys(jsonObj["configs"][index]["launch.json"]).length === 0) {
                let launchTemplate = Tools_1.Tools.readFileContent(Tools_1.Tools.VSCodeExtensionPath + "/res/others/launch.json");
                let settings = JSON.parse(launchTemplate);
                for (const key in settings.configurations) {
                    const v = settings.configurations[key];
                    if (v["tag"] === "normal" || v["name"] === "LuaPanda") {
                        jsonObj["configs"][index]["launch.json"][v["name"]] = v;
                    }
                    if (v["tag"] === "attach" || v["name"] === "LuaPanda-Attach") {
                        jsonObj["configs"][index]["launch.json"][v["name"]] = v;
                    }
                    if (v["tag"] === "independent_file" || v["name"] === "LuaPanda-IndependentFile") {
                        jsonObj["configs"][index]["launch.json"][v["name"]] = v;
                    }
                }
            }
            index++;
        }
        return JSON.stringify(jsonObj);
    }
    static getWebMessage(message) {
        let messageObj = JSON.parse(message.webInfo);
        switch (messageObj.command) {
            case 'save_settings':
                this.processSaveSettings(messageObj);
                break;
            case 'adb_reverse':
                this.processADBReverse(messageObj);
                break;
            case 'on_off_analyzer':
                this.on_off_analyzer(messageObj);
                break;
            case 'preAnalysisCpp':
                if (!messageObj.path || messageObj.path.trim() == '') {
                    logManager_1.DebugLogger.showTips("C++ 文件分析失败, 传入路径为空! ", 2);
                }
                else {
                    if (!fs.existsSync(messageObj.path.trim())) {
                        logManager_1.DebugLogger.showTips("输入了不存在的路径! ", 2);
                        return;
                    }
                    Tools_1.Tools.client.sendNotification('preAnalysisCpp', message.webInfo);
                }
                break;
            case 'clearPreProcessFile':
                let removePath = messageObj.rootFolder + "/.vscode/LuaPanda/";
                let res = Tools_1.Tools.removeDir(removePath);
                if (res) {
                    logManager_1.DebugLogger.showTips("文件夹已经清除");
                }
                else {
                    logManager_1.DebugLogger.showTips("文件不存在", 2);
                }
                break;
        }
    }
    static on_off_analyzer(messageObj) {
        let userControlBool = messageObj.switch;
        let snippetsPath = Tools_1.Tools.VSCodeExtensionPath + "/res/snippets/snippets.json";
        let snippetsPathBackup = Tools_1.Tools.VSCodeExtensionPath + "/res/snippets/snippets_backup.json";
        if (!userControlBool) {
            fs.writeFileSync(snippetsPath, '');
            logManager_1.DebugLogger.showTips("您已关闭了代码辅助功能, 重启 VScode 后将不再有代码提示! ");
            return;
        }
        if (userControlBool) {
            if (fs.existsSync(snippetsPathBackup)) {
                fs.writeFileSync(snippetsPath, fs.readFileSync(snippetsPathBackup));
            }
            logManager_1.DebugLogger.showTips("您已打开了代码辅助功能, 重启 VScode 后将会启动代码提示! ");
            return;
        }
    }
    static processADBReverse(messageObj) {
        let connectionPort = messageObj["connectionPort"];
        if (this.ADBRevTerminal) {
            this.ADBRevTerminal.dispose();
        }
        this.ADBRevTerminal = vscode.window.createTerminal({
            name: "ADB Reverse (LuaPanda)",
            env: {},
        });
        let cmd = "adb reverse tcp:" + connectionPort + " tcp:" + connectionPort;
        this.ADBRevTerminal.sendText(cmd, true);
        this.ADBRevTerminal.show();
    }
    static processSaveSettings(messageObj) {
        try {
            const element = messageObj.configs;
            let rootFolder = element.path;
            let settings = this.readLaunchjson(rootFolder);
            let newConfig = element["launch.json"];
            for (const key in settings.configurations) {
                let target_name = settings.configurations[key]["name"];
                if (newConfig[target_name]) {
                    settings.configurations[key] = newConfig[target_name];
                }
            }
            let launchJson = JSON.stringify(settings, null, 4);
            Tools_1.Tools.writeFileContent(rootFolder + "/.vscode/launch.json", launchJson);
            logManager_1.DebugLogger.showTips("配置保存成功! ");
        }
        catch (error) {
            logManager_1.DebugLogger.showTips("配置保存失败, 可能是由于 launch.json 文件无法写入. 请手动修改 launch.json 中的配置项来完成配置! ", 2);
        }
    }
}
exports.VisualSetting = VisualSetting;
//# sourceMappingURL=visualSetting.js.map