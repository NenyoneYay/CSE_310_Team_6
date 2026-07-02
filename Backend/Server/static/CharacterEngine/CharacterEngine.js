import {deepCopy, sanatizeKey} from "./helpers.js"
import {BaseNode, DataNode, ModifierNode, Container} from "./Nodes.js";
import {Path} from "./Path.js";
import {EventBus} from "./EventBus.js";

/* Future features
 * actions:
 * - set: sets a value to target
 * - add: adds a value to target
 * - multiply: multiplies target by value
 * - create: creates a new node/path structure
 * - remove: removes a node/path
 * - prompt: Tell the player anything
 * 
 * expression functions:
 * - data(path,fallback): gets data from path
 * - promptNumber(message): prompts a user for number input
 * - promptConfirm(message): prompts user for confirmation (yes:1/no:0)
 * - promptOption(message,optionsArr): prompts the user to select an option
 */

export class Character {
    constructor(fileData = undefined) {
        /** @type {BaseNode[]} */
        this.newNodes = [];
        
        this.root = undefined;
        if(fileData == undefined)
            fileData = `{"data":{}}`
        this.parseFile(fileData);

        // // here is some prototype data for rules
        // this.fileData = {
        //     "rules":{
        //         "Stats.*":[
        //             {
        //                 "mod":"floor(data('.score')/2) - 5",
        //                 "save":"data('.mod')"
        //             }
        //         ]
        //     },
        //     "data": ...
        // }

    }

    buildTree (rootData, parent = undefined, virtual = false) {
        const makeNode = (newNode) => {
            this.newNodes.push(newNode); 
            return newNode; 
        }

        const buildData = (dataTree,parent = undefined,virtual = false) => {
            const type = dataTree?.["__type"];
            let nextParent = dataTree
            if(dataTree instanceof Object) {
                if(parent != null && dataTree[Symbol.for("parent")] == undefined) {
                    dataTree[Symbol.for("parent")] = parent;
                }
            }

            if (dataTree == null || dataTree instanceof BaseNode) {
                return dataTree;
            } else if (["string","number","boolean"].includes(typeof(dataTree))) {

                return makeNode(new DataNode(virtual,parent,{value: dataTree}));

            } else if (Array.isArray(dataTree)) {
                for(const [idx,item] of dataTree.entries()) {
                    if(type != undefined) {
                        if(!Object.hasOwn(item, "__type")) item["__type"] = type;
                    }
                    dataTree[idx] = buildData(item,nextParent,virtual);
                }
                dataTree[Symbol.for("virtual")] = virtual;
                return dataTree;
            } else if (dataTree instanceof Object) {
                if(type != undefined) {
                    switch(type) {
                        case "data":
                            return makeNode(new DataNode(virtual,parent,dataTree));
                            break;
                        case "modifier":
                            return makeNode(new ModifierNode(virtual,parent,dataTree));
                            break;
                        case "container":
                            nextParent = parent;
                            if(dataTree["content"] instanceof Object) {
                                dataTree["content"][Symbol.for("parent")] = nextParent;
                            }
                            break;
                        default:
                            console.log(`Unknown node type: '${type}'`);
                    }
                } 

                for(const key of Object.keys(dataTree)) {
                    if(!key.startsWith("__")) 
                        dataTree[key] = buildData(dataTree[key],nextParent,virtual);
                }
                dataTree[Symbol.for("virtual")] = virtual;
                return dataTree;
            }
            return null;
        }

        return buildData(rootData, parent, virtual);
    }

    buildRules (ruleData, root = null) {
        for(const [key,rawData] of Object.entries(ruleData)) {
            if(key.startsWith("__")) continue;

            const {__type:ruleType,...ruleObj} = rawData;
            let virtual = true;
            switch(ruleType) {
                case "requirement":
                    virtual = false;
                    break;
            }

            const targetPath = new Path(key);
            const targetObjs = targetPath.resolve({root:root ?? this.root, flat:true});

            for(const result of targetObjs) {
                if (result?.__type === "pathResult") {
                    const targetObj = result.result;
                    if (targetObj instanceof BaseNode) {
                        return; // don't replace existing nodes
                    }

                    const recursor = (_ruleobj, _targetobj) => {
                        if (_targetobj == undefined) {
                            // TODO: make buildFrom(Path) to build new structures from rule paths.
                            // also should merge new structure with existing objects along path if they exist.

                        } else if (Array.isArray(_ruleobj) && Array.isArray(_targetobj) && virtual) {
                            for (const val of _ruleobj) {
                                const clone = deepCopy(val);
                                if(clone instanceof Object) {
                                    clone[Symbol.for("parent")] = _targetobj;
                                    _targetobj.push(this.buildTree(clone,_targetobj,virtual));
                                }
                            }
                        } else if (_ruleobj instanceof Object && _targetobj instanceof Object) {
                            for(const [objKey,objVal] of Object.entries(_ruleobj)) {
                                if(!Object.hasOwn(_targetobj, objKey)) {
                                    const clone = deepCopy(objVal);
                                    if(clone instanceof Object) clone[Symbol.for("parent")] = _targetobj;
                                    _targetobj[objKey] = this.buildTree(clone,_targetobj,virtual);
                                    _targetobj[Symbol.for("okeys")].push(objKey);
                                } else {
                                    const idx = _targetobj[Symbol.for("okeys")].indexOf(objKey);
                                    const [moved] = _targetobj[Symbol.for("okeys")].splice(idx,1);
                                    _targetobj[Symbol.for("okeys")].push(moved);
                                    recursor(objVal,_targetobj[objKey]);
                                }
                            }
                        }
                    }

                    recursor(ruleObj,targetObj);
                } 
            }
        }
    }

    processNewNodes() {
        this.newNodes.forEach((newNode) => {
            // register dependencies
            newNode.evaluateDependencies();
        });
        this.newNodes.forEach((newNode) => {
            // evaluate node values
            newNode.update();
        });

        this.newNodes = [];
    }

    parseFile(fileData){
        this.destroy();
        const jsonData = JSON.parse(fileData,function (key,value) {
            const sanatizedKey = sanatizeKey(key);
            const [baseKey,sigil] = sanatizedKey.split('#');
            let rval = value;
            
            if(!Array.isArray(this) && !baseKey.startsWith("__")) {
                if(Object.hasOwn(this,Symbol.for("okeys")) && Array.isArray(this[Symbol.for("okeys")])) {
                    this[Symbol.for("okeys")].push(baseKey)
                } else {
                    this[Symbol.for("okeys")] = [baseKey];
                }
            }
            
            if (sanatizedKey != key && rval != undefined) {
                this[baseKey] = rval; // sanatize object prototype keys
                rval = undefined;
            }
            if (sigil != undefined) {
                this[baseKey] = rval;
                if(this[baseKey] instanceof Object){
                    this[baseKey]["__type"] = sigil;
                }
                rval = undefined;
            }

            return rval;
        });

        // Make "data" into a root object
        const contextData = jsonData.data ?? {};
        if(Object.hasOwn(contextData,Symbol.for("parent")))
            delete contextData[Symbol.for("parent")];

        // Make "rules" into a root object
        const ruleData = jsonData?.rules ?? {};
        if(Object.hasOwn(ruleData,Symbol.for("parent")))
            delete ruleData[Symbol.for("parent")];

        this.root = this.buildTree(contextData);
        this.root[Symbol.for("EventBus")] = new EventBus();
        if(this.root[Symbol.for("okeys")] == undefined)
            this.root[Symbol.for("okeys")] = [];

        this.rules = ruleData;
        this.buildRules(this.rules);

        this.processNewNodes();
        return jsonData;
    }
    
    getSaveData() {
        const objSerializer = (obj, spaces = undefined, depth = 0) => {
            const [spaceInsertA,spaceInsertB] = typeof(spaces) === "number" 
                ? ["\n" + " ".repeat(spaces*(depth)),"\n" + " ".repeat(spaces*(depth+1))] 
                : ["",""];

            if(Array.isArray(obj)) {
                const processedArr = obj
                    .filter((val) => {
                        if(val instanceof Object && val[Symbol.for("virtual")])
                            return false;
                        return true;
                    })
                    .map((val) => objSerializer(val,spaces,depth+1));
                return `[${spaceInsertB}${processedArr.join("," + spaceInsertB)}${spaceInsertA}]`;
            } else if (obj instanceof ModifierNode) {
                return JSON.stringify(obj.getSaveData(),undefined,spaces).replaceAll("\n",spaceInsertA);
            } else if (obj instanceof BaseNode) {
                return JSON.stringify(obj.getSaveData(),undefined);
            } else if (obj instanceof Container) {
                return objSerializer(obj.getSaveData());
            } else if (obj instanceof Object) {
                let keys = obj[Symbol.for("okeys")];
                if (keys == undefined) {
                    keys = Object.keys(obj);
                } else {
                    keys = [...keys,...Object.keys(obj).filter(key => key.startsWith("__"))];
                }
                const processedKeys = keys
                    .filter((key) => {
                        if(obj[key] instanceof Object && obj[key][Symbol.for("virtual")])
                            return false;
                        return true;
                    })
                    .map((key) => `"${key}": ${objSerializer(obj[key],spaces,depth+1)}`);
                
                return `{${spaceInsertB}${processedKeys.join(","+spaceInsertB)}${spaceInsertA}}`
            }
            return JSON.stringify(obj,undefined,spaces).replaceAll("\n",spaceInsertA);
        }
        return `{\n    "data":${objSerializer(this.root,4,1)},\n    "rules":${objSerializer(this.rules,4,1)}\n}`;
    }

    renderHTML(container) {
        // do the html rendering here
        const recursor = (treeRoot, level = 0) => {
            if (treeRoot == null) return null;

            if (treeRoot instanceof Object && treeRoot?.["__type"] === "container") {
                return recursor(treeRoot?.content ?? null);
            }
            
            if (treeRoot instanceof BaseNode) {
                return treeRoot.renderHTML();
            } else if (Array.isArray(treeRoot)) {
                let ul = document.createElement("ul");
                treeRoot.forEach((item) => {
                    let li = document.createElement("li");
                    li.appendChild(recursor(item, level+1)  ?? document.createElement("div"))
                    ul.appendChild(li);
                })
                return ul;
            } else if (treeRoot instanceof Object) {
                let div = document.createElement("div");
                treeRoot[Symbol.for("okeys")].forEach((key) => {
                    if(key.startsWith("__")) return;
                    let name = (key.length > 0 && key[0] ==="~") ? key.slice(1) : key;
                    if(treeRoot[key] instanceof BaseNode) {
                        let container = document.createElement("div");
                        let label = document.createElement("label");
                        label.innerHTML = name+": ";
                        container.appendChild(label)
                        container.appendChild(recursor(treeRoot[key], level+1) ?? document.createElement("div"));
                        div.appendChild(container);
                    } else {
                        let detail = document.createElement("details");
                        let summary = document.createElement("summary");
                        summary.innerHTML = name;
                        detail.appendChild(summary);
                        detail.appendChild(recursor(treeRoot[key], level+1) ?? document.createElement("div"));
                        div.appendChild(detail)
                    }
                });
                return div;
            }
            return null;
        }
        
        this.detachHTML();
        container.innerHTML = "";
        container.appendChild(recursor(this.root));

        // container = document.createElement("div")
        // container.appendChild(...)
    }

    detachHTML() {
        const recursor = (treeRoot, level = 0) => {
            if (treeRoot == null) return;
            if (treeRoot instanceof DataNode) {
                treeRoot.detachInput();
                return;
            } else if (treeRoot instanceof BaseNode) {
                return;
            }else if (Array.isArray(treeRoot)) {
                treeRoot.forEach((item) => {
                    recursor(item, level + 1);
                })
                return;
            } else if (treeRoot instanceof Object) {
                Object.keys(treeRoot).forEach((key) => {
                    if(!key.startsWith("__")) {
                        recursor(treeRoot[key], level+1);
                    }
                });
                return;
            }
            return;
        }
        recursor(this.root);
    }

    destroy() {
        const recursor = (treeRoot) => {
            if (treeRoot == null) return;
            if (treeRoot instanceof BaseNode) {
                treeRoot.destroy();
                return;
            }
            if (Array.isArray(treeRoot)) {
                treeRoot.forEach((item) => {
                    recursor(item);
                })
                return;
            } else if (treeRoot instanceof Object) {
                Object.keys(treeRoot).forEach((key) => {
                    if(!key.startsWith("__")) {
                        recursor(treeRoot[key]);
                    }
                });
                return;
            }
            return;
        }
        recursor(this.root);
        delete this.root;
        this.root = undefined;
    }

}









