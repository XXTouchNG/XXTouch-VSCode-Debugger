"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThreadManager {
    constructor() {
        this._CUR_THREAD_ID = ThreadManager.NEXT_THREAD_ID;
        ThreadManager.NEXT_THREAD_ID++;
        ThreadManager.THREAD_ID_COUNTER++;
    }
    get CUR_THREAD_ID() {
        return this._CUR_THREAD_ID;
    }
    destructor() {
        ThreadManager.THREAD_ID_COUNTER--;
        if (ThreadManager.THREAD_ID_COUNTER === 0) {
            ThreadManager.NEXT_THREAD_ID = 0;
        }
    }
}
ThreadManager.THREAD_ID_COUNTER = 0;
ThreadManager.NEXT_THREAD_ID = 0;
exports.ThreadManager = ThreadManager;
//# sourceMappingURL=ThreadManager.js.map