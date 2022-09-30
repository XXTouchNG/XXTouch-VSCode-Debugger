"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logManager_1 = require("../common/logManager");
class DataProcessor {
    constructor() {
        this.isNeedB64EncodeStr = true;
        this.orderList = new Array();
        this.recvMsgQueue = new Array();
        this.cutoffString = "";
        this.getDataJsonCatch = "";
    }
    processMsg(orgData) {
        let data = orgData.trim();
        if (this.cutoffString.length > 0) {
            data = this.cutoffString + data;
            this.cutoffString = "";
        }
        let pos = data.indexOf(this._runtime.TCPSplitChar);
        if (pos < 0) {
            this.processCutoffMsg(data);
        }
        else {
            do {
                let data_save = data.substring(0, pos);
                data = data.substring(pos + this._runtime.TCPSplitChar.length, data.length);
                this.recvMsgQueue.push(data_save);
                pos = data.indexOf(this._runtime.TCPSplitChar);
                if (pos < 0) {
                    this.processCutoffMsg(data);
                }
            } while (pos > 0);
            while (this.recvMsgQueue.length > 0) {
                let dt1 = this.recvMsgQueue.shift();
                this.getData(String(dt1));
            }
        }
        for (let index = 0; index < this.orderList.length; index++) {
            const element = this.orderList[index];
            if (element["timeOut"] && Date.now() > element["timeOut"]) {
                let cb = element["callback"];
                cb(element["callbackArgs"]);
                this.orderList.splice(index, 1);
            }
        }
    }
    processCutoffMsg(orgData) {
        let data = orgData.trim();
        if (data.length > 0) {
            this.cutoffString = this.cutoffString + data;
        }
    }
    getData(data) {
        let cmdInfo;
        try {
            if (this.getDataJsonCatch != "") {
                data = this.getDataJsonCatch + data;
            }
            cmdInfo = JSON.parse(data);
            if (this.isNeedB64EncodeStr && cmdInfo.info !== undefined) {
                for (let i = 0, len = cmdInfo.info.length; i < len; i++) {
                    if (cmdInfo.info[i].type === "string") {
                        cmdInfo.info[i].value = Buffer.from(cmdInfo.info[i].value, 'base64').toString();
                    }
                }
            }
            this.getDataJsonCatch = "";
        }
        catch (e) {
            if (this.isNeedB64EncodeStr) {
                this._runtime.showError("JSON 解析失败! " + data);
                logManager_1.DebugLogger.AdapterInfo("[Adapter Error]: JSON 解析失败! " + data);
            }
            else {
                this.getDataJsonCatch = data + "|*|";
            }
            return;
        }
        if (this._runtime != null) {
            if (cmdInfo == null) {
                this._runtime.showError("JSON 解析失败! no cmdInfo: " + data);
                logManager_1.DebugLogger.AdapterInfo("[Adapter Error]: JSON 解析失败 no cmdInfo: " + data);
                return;
            }
            if (cmdInfo["cmd"] == undefined) {
                this._runtime.showError("JSON 解析失败! no cmd:" + data);
                logManager_1.DebugLogger.AdapterInfo("[Adapter Warning]: JSON 解析失败 no cmd: " + data);
            }
            if (cmdInfo["callbackId"] != undefined && cmdInfo["callbackId"] != "0") {
                for (let index = 0; index < this.orderList.length; index++) {
                    const element = this.orderList[index];
                    if (element["callbackId"] == cmdInfo["callbackId"]) {
                        let cb = element["callback"];
                        if (cmdInfo["info"] != null) {
                            cb(element["callbackArgs"], cmdInfo["info"]);
                        }
                        else {
                            cb(element["callbackArgs"]);
                        }
                        this.orderList.splice(index, 1);
                        return;
                    }
                }
                logManager_1.DebugLogger.AdapterInfo("[Adapter Error]: 没有在列表中找到回调");
            }
            else {
                switch (cmdInfo["cmd"]) {
                    case "refreshLuaMemory":
                        this._runtime.refreshLuaMemoty(cmdInfo["info"]["memInfo"]);
                        break;
                    case "tip":
                        this._runtime.showTip(cmdInfo["info"]["logInfo"]);
                        break;
                    case "tipError":
                        this._runtime.showError(cmdInfo["info"]["logInfo"]);
                        break;
                    case "stopOnCodeBreakpoint":
                    case "stopOnBreakpoint":
                    case "stopOnEntry":
                    case "stopOnStep":
                    case "stopOnStepIn":
                    case "stopOnStepOut":
                        let stackInfo = cmdInfo["stack"];
                        this._runtime.stop(stackInfo, cmdInfo["cmd"]);
                        break;
                    case "output":
                        let outputLog = cmdInfo["info"]["logInfo"];
                        if (outputLog != null) {
                            this._runtime.printLog(outputLog);
                        }
                        break;
                    case "debug_console":
                        let consoleLog = cmdInfo["info"]["logInfo"];
                        if (consoleLog != null) {
                            this._runtime.logInDebugConsole(consoleLog);
                        }
                        break;
                }
            }
        }
    }
    commandToDebugger(cmd, sendObject, callbackFunc = null, callbackArgs = null, timeOutSec = 0) {
        let max = 999999999;
        let min = 10;
        let isSame = false;
        let ranNum = 0;
        let sendObj = new Object();
        if (callbackFunc != null) {
            do {
                isSame = false;
                ranNum = Math.floor(Math.random() * (max - min + 1) + min);
                this.orderList.forEach(element => {
                    if (element["callbackId"] == ranNum) {
                        isSame = true;
                    }
                });
            } while (isSame);
            let dic = new Object();
            dic["callbackId"] = ranNum;
            dic["callback"] = callbackFunc;
            if (timeOutSec > 0) {
                dic["timeOut"] = Date.now() + timeOutSec * 1000;
            }
            if (callbackArgs != null) {
                dic["callbackArgs"] = callbackArgs;
            }
            this.orderList.push(dic);
            sendObj["callbackId"] = ranNum.toString();
        }
        sendObj["cmd"] = cmd;
        sendObj["info"] = sendObject;
        const str = JSON.stringify(sendObj) + " " + this._runtime.TCPSplitChar + "\n";
        if (this._socket != undefined) {
            logManager_1.DebugLogger.AdapterInfo("[Send Msg]: " + str);
            this._socket.write(str);
        }
        else {
            logManager_1.DebugLogger.AdapterInfo("[Send Msg but socket deleted]: " + str);
        }
    }
}
exports.DataProcessor = DataProcessor;
//# sourceMappingURL=dataProcessor.js.map