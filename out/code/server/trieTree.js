"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class treeNode {
    constructor() {
        this.childrenNode = new Object();
        this.symbols = new Array();
    }
}
class trieTree {
    static createSymbolTree(symbolArray) {
        if (!Array.isArray(symbolArray) || symbolArray.length === 0) {
            return;
        }
        let root = new treeNode();
        root.thisChr = "TREE_ROOT";
        for (const symbol of symbolArray) {
            this.addNodeOnTrieTree(root, symbol);
        }
        return root;
    }
    static searchOnTrieTree(root, searchKey, searchChildren = true) {
        if (!root || !searchKey || searchKey == '') {
            return;
        }
        let currentPtr = root;
        searchKey = searchKey.toLowerCase();
        let searchArray = searchKey.split('');
        for (let index = 0; index < searchArray.length; index++) {
            const it = searchArray[index];
            if (!currentPtr.childrenNode[it]) {
                return;
            }
            currentPtr = currentPtr.childrenNode[it];
            if (index === searchArray.length - 1) {
                let searchResult = this.travelAllNode(currentPtr, searchChildren);
                return searchResult;
            }
        }
    }
    static searchOnTrieTreeWithoutTableChildren(root, searchKey) {
        return this.searchOnTrieTree(root, searchKey, false);
    }
    static addNodeOnTrieTree(root, symbol) {
        let currentPtr = root;
        let searchName = symbol.searchName.toLowerCase();
        let searchArray = searchName.split('');
        for (let index = 0; index < searchArray.length; index++) {
            const it = searchArray[index];
            if (!currentPtr.childrenNode[it]) {
                let newNode = new treeNode();
                newNode.thisChr = it;
                currentPtr.childrenNode[it] = newNode;
            }
            currentPtr = currentPtr.childrenNode[it];
            if (index === searchArray.length - 1) {
                currentPtr.symbols.push(symbol);
            }
        }
    }
    static travelAllNode(node, searchChildren) {
        let retArray;
        if (node.symbols && node.symbols.length > 0) {
            retArray = node.symbols;
        }
        for (const key in node.childrenNode) {
            const element = node.childrenNode[key];
            let childArray = [];
            if (searchChildren === false && (element.thisChr === '.' || element.thisChr === ':')) {
            }
            else {
                childArray = this.travelAllNode(element, searchChildren);
            }
            if (retArray == undefined) {
                retArray = childArray;
            }
            else {
                retArray = retArray.concat(childArray);
            }
        }
        return retArray;
    }
}
exports.trieTree = trieTree;
//# sourceMappingURL=trieTree.js.map