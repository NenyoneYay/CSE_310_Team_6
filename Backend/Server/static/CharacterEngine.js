
/** @type {(Character|null)} */
var loadedChar = null;
var saveFileName = null;

/**
 * 
 * @param {InputEvent} ev 
 * @returns 
 */
async function readSingleFile(ev) {
    const errElement = document.getElementById('error-content');
    errElement.textContent = '';

    /** @type {File} */
    const file = ev.target.files[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        let contents = e.target.result;
        displayContents(contents);
        saveFileName = file.name;
    };
    reader.readAsText(file);
}  

function clearFile(ev) {
    const errElement = document.getElementById('error-content');
    const fileElement = document.getElementById('file-input');
    const contentElement = document.getElementById('html-content')
    errElement.textContent = '';
    fileElement.value = '';
    loadedChar?.destroy();
    loadedChar = null;
    saveFileName = null;
    document.getElementById("save-button").classList.add("hidden");
    contentElement.innerHTML = '';
}

function displayContents(contents) {
    try {
        if(loadedChar == null)
            loadedChar = new Character(contents);
        else
            loadedChar.parseFile(contents);
        loadedChar.renderHTML(document.getElementById("html-content"));
        document.getElementById("save-button").classList.remove("hidden");
    } catch (err) {
        const element = document.getElementById('error-content');
        element.textContent = `Error: ${err.name}: ${err.message}`;
        document.getElementById('file-input').value = '';
        throw err
    }
}

function downloadSave() {

    const blob = new Blob([loadedChar.getSaveData()], {
        type: "application/json" 
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a"); 
    a.href = url; 
    a.download = saveFileName ?? "character-sheet.json"; 

    a.click();
    URL.revokeObjectURL(url);

};

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

function sanatizeKey(key) {
    if (key in Array.prototype) return '~'+key;
    return key;
}

function getWrappedIdx (idx,arr) {
    return arr.at(idx);
}

function orderedObjectSerializer (obj, spaces = undefined, depth = 0) {
    const [spaceInsertA,spaceInsertB] = typeof(spaces) === "number" 
        ? ["\n" + " ".repeat(spaces*(depth)),"\n" + " ".repeat(spaces*(depth+1))] 
        : ["",""];

    if(Array.isArray(obj)) {
        const processedArr = obj.map((val) => orderedObjectSerializer(val,spaces,depth+1));
        return `[${spaceInsertB}${processedArr.join("," + spaceInsertB)}${spaceInsertA}]`;
    } else if (obj instanceof Object) {
        let keys = obj[Symbol.for("okeys")];
        if (keys == undefined) {
            keys = Object.keys(obj);
        }
        const processedKeys = keys.map((key) => `"${key}": ${orderedObjectSerializer(obj[key],spaces,depth+1)}`);
        return `{${spaceInsertB}${processedKeys.join(","+spaceInsertB)}${spaceInsertA}}`
    }
    return JSON.stringify(obj,undefined,spaces);
}

function deepCopy (obj, filterFunc = null) {
    if(filterFunc == null) filterFunc = ((k,v) => "continue");

    const recursor = (obj) => {
        let rval = undefined;
        if(Array.isArray(obj)) {
            if(Object.hasOwn(obj,Symbol.for("deepCopy_visited")))
                return obj[Symbol.for("deepCopy_visited")];
            rval = [];
            obj[Symbol.for("deepCopy_visited")] = rval;
            for(const [idx,item] of obj.entries()) {
                switch(filterFunc(idx,item)) {
                    case "collect":
                        rval.push(item);
                        break;
                    case "skip":
                    case false:
                        break;
                    case "continue":
                    case true:
                    default:
                        rval.push(recursor(item));
                        break;
                }
            }
        } else if(obj instanceof Object) {
            if(Object.hasOwn(obj,Symbol.for("deepCopy_visited")))
                return obj[Symbol.for("deepCopy_visited")];
            rval = {};
            obj[Symbol.for("deepCopy_visited")] = rval;
            for(const key of Object.keys(obj)) {
                switch(filterFunc(key,obj[key])) {
                    case "collect":
                        rval[key] = obj[key];
                        break;
                    case "skip":
                    case false:
                        break;
                    case "continue":
                    case true:
                    default:
                        rval[key] = recursor(obj[key]);
                        break;
                }
            }
        } else {
            return obj;
        }
        for(const sym of Object.getOwnPropertySymbols(obj)) {
            if(sym === Symbol.for("deepCopy_visited")) continue;
            switch(filterFunc(sym,obj[sym])) {
                case "collect":
                    rval[sym] = obj[sym];
                    break;
                case "skip":
                case false:
                    break;
                case "continue":
                case true:
                default:
                    rval[sym] = recursor(obj[sym]);
                    break;
            }
        }
        delete obj[Symbol.for("deepCopy_visited")];
        return rval;
    }

    return recursor(obj);
}

function compareObj(obj1, obj2, keyWhitelist = []) {
    if(!(obj1 instanceof Object) || !(obj2 instanceof Object)) {
        if(!(obj1 instanceof Object) && !(obj2 instanceof Object)) {
            return obj1 === obj2;
        }
        return false;
    }
    
    if(obj1?.[Symbol.for("compareObj_visited")] != undefined || obj2?.[Symbol.for("compareObj_visited")] != undefined) {
        const rval = obj1?.[Symbol.for("compareObj_visited")] != undefined && obj2?.[Symbol.for("compareObj_visited")] != undefined;
        delete obj1[Symbol.for("compareObj_visited")];
        delete obj2[Symbol.for("compareObj_visited")];
        return rval;
    }

    if(obj1 === obj2) {
        return true;
    }

    rval = true;
    obj1[Symbol.for("compareObj_visited")] = true;
    obj2[Symbol.for("compareObj_visited")] = true;
    for(const key of Object.keys({...obj1,...obj2})) {
        if(keyWhitelist.includes(key)) continue;

        if(obj1?.[key] !== undefined && obj2?.[key] !== undefined) {
            if(!compareObj(obj1[key], obj2[key])) {
                rval = false;
                break;
            }
        } else if (!(obj1?.[key] === undefined && obj2?.[key] === undefined)){
            rval = false;
            break;
        }
    }
    delete obj1[Symbol.for("compareObj_visited")];
    delete obj2[Symbol.for("compareObj_visited")];
    return rval;
}


class Character {
    constructor(fileData) {
        /** @type {BaseNode[]} */
        this.newNodes = [];
        
        this.root = undefined;
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
                if (result?.__type === "pathResult" && result?.node != undefined) {
                    return; // do nothing to existing nodes found
                } else if (result?.__type === "pathResult") {
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
            newNode.evaluate();
        });

        this.newNodes = [];
    }

    parseFile(fileData){
        this.destroy();
        const jsonData = JSON.parse(fileData,function (key,value) {
            const sanatizedKey = sanatizeKey(key);
            const [baseKey,sigil] = sanatizedKey.split('#');
            let rval = value;
            
            if(!Array.isArray(this)) {
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
            } else if (obj instanceof BaseNode) {
                return JSON.stringify(obj.getSaveData(),undefined,spaces).replaceAll("\n",spaceInsertA);;
            } else if (obj instanceof Container) {
                return objSerializer(obj.getSaveData());
            } else if (obj instanceof Object) {
                let keys = obj[Symbol.for("okeys")];
                if (keys == undefined) {
                    keys = Object.keys(obj);
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
        const recursor = (treeRoot, level = 0) => {
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
                        recursor(treeRoot[key], level+1);
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

class Path {
    /* Tokens Regex Group Explination:
     * Group 1: Path from root object. Path starts with '$'
     * Group 2: '.' or ',' for path separator logics
     * Group 3: Key token. Expressed: Key1.Key2
     * - Each of these keys can have array accessors. These are singleton
     *   object paths.
     * Group 4: Array index list accessor. Expressed: [1,2,3] or [2]
     * - Can be negative numbers. Negatives are wrapped around to end of array.
     * - Comes after Key or Group tokens.
     * Group 5: Array index slice accessor. Expressed: [:5](beginning -> 5), [3:] (3 -> end), [:] (Everything)
     * - Can be negative numbers. Also wrapped to end of array.
     * - Comes after Key or Group tokens.
     * Group 6: "*" Wildcard array accessor. Expressed: [*]
     * - refers to entire array
     * - Comes after Key or Group tokens.
     * Group 7: "#" accessor sigils. Expressed: #accessor1,accessor2,...
     * - Access node accessors (i.e. value, min, or max)
     * Group 8: ';,' semicoln or comma to separate full path queries. 
     * - Commas cannot be used for this purpose after accessor sigils, 
     *   but semicolns can.
     * - Can be used in groups to specify multiple sub paths.
     * Group 9: '(' Start of Group token. 
     * Group 10: ')' End of Group token.
     * - Groups are expressed by: (Subpath 1;subpath 2,...)
     *   - Each subpath may be a full path to something from previous path 
     *     endpoint, each separated by either a comma or semicolon. Must all 
     *     start with same accessor type (i.e. all  start a key, array acceesor,
     *     or accessor sigil).  Expected to return  same container type 
     *     (i.e. object, arrray, node) as well.
     *   - Tokens are recursively parsed inside.
     */
    static tokensRegex = /(?<=^|[\(;,])\s*(\$)\s*|(?<=^|[\(;,\.])\s*(\.+)|(?:(?<=^|[\.;,\($])\s*(?:([\w~][\w: ~\-]*?|\*))\s*(?=$|[\.\[;#,\)]))|(?<!(?<!^|[\(;,\.])\.)\[\s*(?:(-?\d+(?:\s*,\s*-?\d+)*)|(-?\d*\s*:\s*-?\d*)|(\*))\s*\]\s*(?=$|[\.\[#,;\)])|(?<!(?<!^|[\(;,\.])\.)#(\w+(?:,\w+)*)\s*(?=$|[;\)])|(;|,)|\.|(\()|(\))/y;
    /* 
    Test Syntax string:
    $~Key Value.(Key[47],Key,key)[5][5:][*].Key[5,789,-6]#accessor1,accessor2;Key:morekey.Key.Key[:-1].*#accessor1,accessor3,accessor4
    items[1,-4,5][*][1][-1][1:][:1][-2:3]
    Strength[3][5][6];Dexterity[7]
    hello;world
    (h,l,p,asdf,jlsadf)[5];asdf
    #accessor1,accessor2
    Key1.Key2.(.go back[7])[5]
    */

    /**
     * @typedef ResolutionDecision
     * @property {"continue"|"collect"|"skip"|"stop"} action
     * @property {Object|Array} overrides
     */

    /**
     * @typedef PathResult
     * @property {"pathResult"} __type
     * @property {any} result
     * @property {BaseNode|null} node
     * @property {string|null} accessor
     * 
     */

    /** 
     * @typedef Token
     * @property {string} type The type of this token. Determines what to
     * do with value
     * @property {any} value Parsed value of token. Can be anything from obj 
     * references to strings and preocessed arrays
     * @property {string} containerType Expected container type based on next token
     */

    /**
     * @callback ResolutionForwardHandler
     * @param {Object|Array|BaseNode} treeRoot
     * @param {{type:string, value:any}} currentToken
     * @param {Path} resolvedPath
     * @returns {ResolutionDecision} 
     */

    /**
     * @callback ResolutionReverseHandler
     * @param {Object|Array|BaseNode} treeRoot
     * @param {{type:string, value:any}} currentToken
     * @param {Path} resolvedPath
     * @returns {void}
     */

    

    /**
     * @param {Object|Path} obj 
     * @param {Object} from 
     * @returns 
     */
    static pathTo(obj,from = null) {
        if(!(from == null || from instanceof Object)) return undefined;
        const rootChain = [];
        if (from != null) {
            let cur = from;
            while (cur?.[Symbol.for("parent")] != undefined) {
                if(cur?.__type === "container" || cur instanceof Container)
                    continue; // skip containers bc path resolution skips over them too
                rootChain.push(cur);
                cur = cur[Symbol.for("parent")];
            }
        }

        const recursor = (obj) => {
            if(obj == undefined) return undefined;

            if(from != null) {
                let idx = rootChain.indexOf(obj);
                if(idx >= 0) {
                    const isRoot = obj?.[Symbol.for("parent")] == undefined;
                    const rval = [{type:(isRoot ? "T_ROOT" : "T_ORIGIN"),value:from}]
                    for(let i = idx;i > 0;i--) {
                        rval.push({type:"T_BACK",value:"."});
                    }
                    return rval;
                }
            }

            if(obj instanceof Object) {
                const parentObj = obj[Symbol.for("parent")];
                if(parentObj != undefined) {
                    if(parentObj?.__type === "container" || parentObj instanceof Container) {
                        return recursor(parentObj);
                    }

                    const parentPath = recursor(parentObj);
                    if (parentPath != undefined) {
                        if (Array.isArray(parentObj)) {
                            const idx = parentObj.indexOf(obj);
                            if (idx < 0) return undefined;
                            parentPath.push({type:"A_LIST",value:[idx]})
                        } else {
                            const key = Object.keys(parentObj).find((key) => parentObj[key] === obj);
                            if(key == undefined) return undefined;
                            parentPath.push({type:"O_KEY",value:key});
                        }
                        return parentPath;
                    }
                } else {
                    // just return the full absolute path if all else fails.
                    return [{type:"T_ROOT",value:obj}]; 
                }
            }
            return undefined;
        }

        if(obj instanceof Path) {
            return new Path(obj,Path.pathTo(obj.getOrigin(),from));
        }
        return new Path(recursor(obj));
    }

    /**
     * 
     * @param {Object|Array|undefined} obj 
     * @returns {string|number}
     */
    static getName(obj) {
        if(obj == undefined) return undefined;
        if(obj?.[Symbol.for("parent")] == undefined) 
            return "";
        if(Array.isArray(obj[Symbol.for("parent")]))
            return obj[Symbol.for("parent")].indexOf(obj);
        else if (obj instanceof Object)
            return Object.keys(obj[Symbol.for("parent")])?.find(key => obj[Symbol.for("parent")][key] === obj);
        else
            return undefined;
    }

    /**
     * @param {Object} obj 
     * @returns {Object}
     */
    static findRoot(obj) {
        let parentObj = obj;
        while (parentObj?.[Symbol.for("parent")] != undefined) {
            parentObj = parentObj[Symbol.for("parent")];
        }
        return parentObj;
    }

    /**
     * @param {Array<{type:string,value:any}>} tokens 
     * @returns {Array<{type:string,value:any}>}
     */
    static copyTokens(tokens) {
        const _isValidToken = (token) => {
            return (token instanceof Object)
            && token?.type != undefined 
            && token?.value != undefined 
            && typeof(token.type) == "string";
        }

        const _copyTokens = (tokens) => {
            const tokenCopies = []
            for(const token of tokens) {
                const tokenCopy = _copyToken(token);
                if(tokenCopy == undefined) continue; // skip invalid tokens
                tokenCopies.push(tokenCopy);
            }
            return tokenCopies;
        }

        const _copyToken = (token) => {
            if(!_isValidToken(token)) return undefined;

            let tokenCopy = undefined;
            switch (token.type) {
                case 'A_LIST':
                case 'A_SLICE':
                case 'N_ACCESSORS':
                    if(Array.isArray(token.value))
                        tokenCopy = {type:token.type, value:[...token.value]};
                    break;
                case 'T_GROUP':
                    tokenCopy = {type:token.type, value:_copyTokens(token.value)};
                    break;
                case 'T_ROOT':
                case 'T_ORIGIN':
                case 'T_BACK':
                case 'O_KEY':
                case 'A_WILDCARD':
                case 'CONCAT':
                default:
                    tokenCopy = {type:token.type, value:token.value};
                    break;
            }
            return tokenCopy;
        }
        
        if(tokens instanceof Path) {
            return _copyTokens(tokens.tokens);
        } else if (Array.isArray(tokens)){
            return _copyTokens(tokens);
        } else if (_isValidToken(tokens)){
            return _copyToken(tokens);
        }
        return undefined;
    }

    /** 
     * @param {string|Path|Array<{type:string,value:any}>} path 
     * @param {Object|Path} origin
     * */
    static tokenize (path,origin=null) {
        if (path == undefined) path = "";
        
        /** @type {Token[]} */
        let tokens = [];
        let originTokens = [];


        /**
         * @param {Token|undefined} token 
         * @param {string} currentTokenType 
         */
        const setTokenContainer = (token = undefined, currentTokenType = null) => {
            if(token == undefined) return;

            switch(token.type) {
                case "CONCAT":
                    if(contextStack.length > 0) {
                        setTokenContainer(contextStack.at(-1).at(-1),currentTokenType);
                    }
                    break;
                case "T_GROUP":
                    for(let idx = 0;idx <= token.value.length;idx++) {
                        const gtoken = /** @type {Token[]} */ (token.value).at(idx);
                        const pgtoken = idx > 0 ? /** @type {Token[]} */ (token.value).at(idx - 1) : undefined;
                        if(gtoken == null || gtoken.type == "CONCAT") {
                            setTokenContainer(pgtoken,currentTokenType);
                        }
                    }
                    break;
                default:
                    let containerType = null;
                    switch(currentTokenType) {
                        case "O_KEY":
                            containerType = "object";
                            break;
                        case "A_LIST":
                        case "A_SLICE":
                        case "A_WILDCARD":
                            containerType = "array";
                            break;
                        case "N_ACCESSORS":
                            containerType = "node";
                            break;
                    }
                    token.containerType = containerType;
            }
        }


        if (path instanceof Path || Array.isArray(path)) {

            if(origin != null) {
                if (origin instanceof Path) {
                    originTokens = Path.copyTokens(origin.tokens);
                    tokens.push(...originTokens);
                } else if (origin instanceof Object) {
                    tokens = [{type:"T_ORIGIN",value:origin}];
                }
            }

            const pathTokens = (path instanceof Path) 
                ? path.tokens
                : path;
            
            for(const token of pathTokens) {
                const tokenCopy = Path.copyTokens(token);
                if(tokenCopy == undefined) continue; // skip invalid tokens
                let prevToken = tokens.at(-1);
                switch(token.type) {
                    case "T_ROOT":
                        tokens = [tokenCopy]; // replace any origin pathing with root
                        break;
                    case "T_ORIGIN":
                        // don't replace the original origin if it exists
                        if(origin == null)
                            tokens.push(tokenCopy);
                        break;
                    case "T_BACK":
                        // pop tokens off the stack if able to shorten/standardize paths
                        if(tokens.length > 0 && !(["T_BACK","T_ORIGIN","T_ROOT","CONCAT","T_GROUP"].includes(tokens.at(-1)?.type))) {
                            tokens.pop();
                            prevToken = tokens.at(-1);
                        } else {
                            tokens.push(tokenCopy);
                        }
                        break;
                    case "CONCAT":
                        tokens.push(tokenCopy);
                        tokens.push(originTokens);
                        break;
                    default:
                        tokens.push(tokenCopy);
                        setTokenContainer(prevToken,tokenCopy.type);
                }
            }
            return tokens;
        } else if (typeof(path) !== "string") {
            path = ""; // process as empty path if path is invalid;
        }

        /** @type {Token[][]} */
        const contextStack = [];
        
        /**
         * 
         * @param {string} type 
         * @param {any} value 
         * @param {string} containerType 
         * @returns {Token}
         */
        function token(type, value, containerType = null) {
            return {type, value, containerType}
        }

        let originObj = null;
        if(path[0] != '$' && origin != null){
            if (origin instanceof Path) {
                originObj = origin.getOrigin();
                originTokens = Path.copyTokens(origin.tokens);
                tokens.push(...originTokens);
            } else if (origin instanceof Object) {
                originObj = origin;
                tokens.push(token("T_ORIGIN",originObj));
            }
        }


        for(let i = 0;i < path.length;) {
            // If for some reason the string is consumed already, quit now.
            if (i >= path.length)
                break;

            Path.tokensRegex.lastIndex = i;
            const m = Path.tokensRegex.exec(path)
            if (!m) throw SyntaxError(`Unexpected character '${path[i]}' at ${i} in '${path}'`);
            // console.log(m); // Cool Debug thing

            let prevToken = tokens.at(-1);
            if(tokens.length < 1 && contextStack.length > 0) {
                prevToken = contextStack.at(-1).at(-1);
            }


            if (m[1] !== undefined) {
                tokens = [token("T_ROOT",originObj)] // replace all origins with root token
            }

            if (m[2] !== undefined) {
                for (let i=0;i<m[2].length;i++) {
                    if(tokens.length > 0 && !(["T_BACK","T_ORIGIN","T_ROOT","CONCAT","T_GROUP"].includes(tokens.at(-1)?.type))) {
                        tokens.pop();
                        prevToken = tokens.at(-1);
                    } else {
                        tokens.push(token('T_BACK','.'));
                    }
                }
            }

            else if(m[3] !== undefined) {
                tokens.push(token('O_KEY',sanatizeKey(m[3])));
                setTokenContainer(prevToken,'O_KEY');
            }

            else if(m[4] !== undefined) {
                tokens.push(token('A_LIST',m[4].split(',').map(x => parseInt(x))));
                setTokenContainer(prevToken,'A_LIST');
            }

            else if(m[5] !== undefined) {
                let [pmin,pmax] = m[5].split(':');
                if (pmin === '') pmin = 0;
                else pmin = parseInt(pmin);
                if (pmax === '') pmax = undefined;
                else pmax = parseInt(pmax);

                if(Number.isNaN(pmin) || Number.isNaN(pmax)) 
                    throw SyntaxError(`Token ${m[5]} at ${i}: Array slice indexes must be numbers.`);

                tokens.push(token('A_SLICE',{min:pmin,max:pmax}));
                setTokenContainer(prevToken,'A_SLICE');
            }

            else if(m[6] !== undefined) {
                tokens.push(token('A_WILDCARD','*'));
                setTokenContainer(prevToken,'A_WILDCARD');
            }

            else if(m[7] !== undefined && m[7] !== '') {
                tokens.push(token('N_ACCESSORS',m[7].split(',').map(x => sanatizeKey(x))));
                setTokenContainer(prevToken,'N_ACCESSORS');
            }
                
            else if (m[8] !== undefined) { //;,
                tokens.push(token('CONCAT',';,'));
                if (contextStack.length < 1) {
                    tokens.push(...originTokens);
                }
            }

            else if (m[9] !== undefined) { // (
                contextStack.push(tokens);// push token context into stack
                tokens = []; // create new token context
            }

            else if (m[10] !== undefined) { // )
                if (contextStack.length <= 0) throw SyntaxError(`Token ${m[10]} at ${i}: Unbalanced Parentheses. Missing opening '('`);
                const group_token = token('T_GROUP', tokens); // store current token context into group token
                tokens = contextStack.pop(); // pop previous context off the stack to continue where we left off
                tokens.push(group_token);
            }
            
            i = Path.tokensRegex.lastIndex;
        }
        if(contextStack.length > 0) throw SyntaxError(`EOF: Unbalanced Parentheses. Missing closing ')'`);
        
        return tokens;
    }

    static buildHandler(obj, token, isLeaf, options = null) {
        const {default:defaultVal = null} = options;
        if(obj == null) return {action:"continue"};

        const objPath = Path.pathTo(obj)
        console.log(objPath.str,"=>",`${token.type}:${token.value}`,"isLeaf?", isLeaf);

        const buildNew = (parent,type) => {
            
            let newobj = null;
            switch(type) {
                case "object":
                    newobj = {};
                    break;
                case "array":
                    newobj = [];
                    break;
                case "node":
                    newobj = {value:0,max:null,min:null};
                default:
                    newobj = defaultVal;
            }
            if(newobj instanceof Object && parent != null) 
                newobj[Symbol.for("parent")] = parent;
            return newobj;
        }

        switch(token.type) {
            case "N_ACCESSORS":
                return {action:"skip"};

            case "A_LIST":
                if(!Array.isArray(obj)) {
                    console.error("Expected Array but found other type")
                    return {action:"skip"};
                }
                for(const idx of token.value)  {
                    const initLen = obj.length;
                    const maxIdx = idx > 0 ? idx : -idx - 1;
                    if(maxIdx >= obj.length) {
                        obj.length = maxIdx + 1;
                    }
                    obj.fill(null,initLen);
                        
                    const j = idx < 0 ? idx + obj.length : idx;
                    if(j < obj.length && obj[j] == null) {
                        console.log(`Building ${objPath.str}[${j}] as ${token.containerType ?? "default"}`);
                        obj[j] = buildNew(obj,token.containerType);
                    }
                }
                return {action:"continue"};
            case "A_SLICE":
                if(!Array.isArray(obj)) {
                    console.error("Expected Array but found other type")
                    return {action:"skip"};
                }
                const initLen = obj.length;
                const bounds = token.value;
                const max = bounds.max == undefined 
                    ? bounds.min
                    : ( bounds.max < 0 
                        ? bounds.max + 1
                        : bounds.max - 1 // because max is not included in slice
                    )
                const maxIdx = Math.abs(max);
                if(maxIdx > 0 && maxIdx >= obj.length) {
                    obj.length = maxIdx + 1;
                }
                obj.fill(null,initLen);

                for(let i = bounds.min;i <= max;i++) {
                    let j = i < 0 ? i + obj.length : i;
                    if(j < obj.length && obj[j] == null) {
                        console.log(`Building ${objPath.str}[${j}] as ${token.containerType ?? "default"}`);
                        obj[j] = buildNew(obj,token.containerType);
                    }
                }

                return {action:"continue"};
            case "A_WILDCARD":
                console.warn("'*' accessor will not create any new paths");
                return {action:"continue"};
            case "O_KEY":
                if(!(obj instanceof Object)) {
                    console.error("Expected Object but found other type")
                    return {action:"skip"};
                }
                if(token.value === "*") {
                    console.warn("'*' accessor will not create any new paths");
                    return {action:"continue"};
                }
                let nextobj = obj[token.value];
                if(nextobj == undefined) {
                    console.log(`Building ${objPath.str}.${token.value} as ${token.containerType ?? "default"}`);
                    nextobj = buildNew(obj,token.containerType)
                }
                obj[token.value] = nextobj;
                return {action:"continue"};
        }
    }

    static deleteHandler(obj,token,isLeaf,options = null) {

    }

    /**
     * 
     * @param {string|Path|Array<{type:string,value:any}>} path 
     * @param {Path|Object} origin
     */
    constructor(path = "", origin=null) {
        /** @type {string} */
        this.str = null;

        // tokenize the path syntax from path
        /** @type {Array<{type:string,value:any}>} */
        this.tokens = [];
        this.tokens = Path.tokenize(path, origin);
        this.str = this.getString();

        Path.tokensRegex.lastIndex = 0;
    }

    /**
     * 
     * @returns Returns object that is the origin this path was created with
     */
    getOrigin() {
        let rval = undefined;
        for(const token of this.tokens) {
            switch (token.type) {
                case "T_ORIGIN":
                case "T_ROOT":
                    rval = token.value ?? undefined;
                    break;
            }
        }
        return rval;
    }

    /**
     * @returns {string} Returns string representation of this path including unresolved wildcards
     */
    getString() {
        /**
         * @param {{type:string,value:any}} pv 
         * @param {{type:string,value:any}} cv 
         * @returns 
         */
        /** 
         * @param {string} pv 
         * @param {Token} cv
         * */

        let prevTType = null;
        const pathReducer = (pv,cv) => {
            let tokenStr = '';
            let postfix = cv.containerType == 'object' ? '.' : '';

            switch (cv.type) {
                case 'T_ROOT':
                    return '$';
                    break;
                case 'T_ORIGIN':
                    return '';
                    break;
                case 'T_BACK':
                case 'O_KEY':
                    tokenStr = cv.value;
                    break;
                case 'A_LIST':
                    tokenStr = `[${cv.value.join(',')}]`;
                    break;
                case 'A_SLICE':
                    tokenStr = `[${cv.value.min === 0 ? '' : cv.value.min}:${cv.value.max ?? ''}]`;
                    break;
                case 'A_WILDCARD':
                    tokenStr = '[*]';
                    break;
                case 'CONCAT':
                    tokenStr = prevTType === 'N_ACCESSORS' ? ';' : ',';
                    break;
                case 'T_GROUP':
                    tokenStr = `(${cv.value.reduce(pathReducer,'')})`;
                    break;
                case 'N_ACCESSORS':
                    tokenStr = `#${cv.value.join(',')}`;
                    break;
                default:
                    tokenStr = '';
            }
            prevTType = cv.type;
            return pv + tokenStr + postfix;
        }

        return this.tokens.reduce(pathReducer,'');
    }

    /**
     * 
     * @param {{
     *      root: Object,
     *      relativeTo: Object
     *  }} options `root` is passed directly to `this.resolve({flat:true})`. `relativeTo` passed as `from` parameter to `Path.pathTo()`.
     * @returns {string[]} Returns string paths to all objects resolved by this path relative to the `relativeTo` parameter. Relative to root object by default.
     */
    resolveStrs(options = {}) {
        const {root = null,relativeTo = null} = options;

        const results = this.resolve({root:root, flat:true});
        return results.map((result) => {
            if (result?.__type === "pathResult" && result?.accessor != undefined) {
                return `${Path.pathTo(result.node,relativeTo ?? root).str}#${result.accessor}`;
            } else if (result?.__type === "pathResult"){
                return Path.pathTo(result.result,relativeTo ?? root).str;
            } 
        });
    }  

    /** 
     * @param {{
     *  root:Object, 
     *  forwardHandler: ResolutionForwardHandler, 
     *  reverseHandler: ResolutionReverseHandler, 
     *  handlerOptions: Object
     * }} options All options are optional
     * @returns {Array<PathResult|undefined|Array>|PathResult|undefined} Always returns an array if 'flat' option is true
     */
    resolve(options = {}) {
        const {
            root = null,
            forwardHandler = null, 
            reverseHandler = null,
            handlerOptions = null,
            flat = false
        } = options;
        
        // Some higher level variables to preserve callback state across
        // recursive function calls.
        let stopResolution = false, returnEarly = false, collectNext = false;

        // super basic linked list state variables
        let llhead = null, lltail = null;
        const ctxStack = [];
        // called on every path leaf to append result to list
        // only appends and returns undefined if `flat` is true, 
        // otherwise returns same value passed in
        function llpush (value) {
            const newNode = {value:value,next:null,count:0}
            if(llhead == null) {
                llhead = {value:"ctxOPEN",next:null,count:0};
                lltail = llhead;
                ctxStack.push(llhead);
            }

            lltail.next = newNode;
            lltail = newNode;

            if(ctxStack.length > 0) 
                ctxStack.at(-1).count++;
            return newNode;
        }

        function llpushOpen() {
            if(flat) return;
            const newNode = llpush("ctxOPEN");
            ctxStack.push(newNode);
        }

        function llpushClose(keepArr = false) {
            if(flat) return;
            const newNode = llpush("ctxCLOSE");
            if(keepArr) newNode.count = 1;
            if(ctxStack.length > 0) 
                ctxStack.at(-1).count--; // subtract self from count
            ctxStack.pop()
        }

        function llprint() {
            if(llhead == null) console.log("<null>")
            let cur = llhead;
            while (cur != null) {
                console.log(cur);
                cur = cur.next;
            }
        }

        function llbuildArray() {
            const incCur = (cur) => {
                const prev = cur;
                cur = cur.next;
                prev.next = null; // help gc collect garbage
                return cur;
            }

            let cur = llhead;
            llhead = null;

            const builder = () => {
                if(cur == null) return undefined;
                let rval = new Array(cur.count);
                if(cur.value === "ctxOPEN")
                    cur = incCur(cur);
                let idx = 0;
                while(cur != null) {
                    if(cur.value === "ctxOPEN") {
                        if(idx < rval.length){
                            rval[idx++] = builder();
                        } else
                            console.error("idx got to big building array from LL")
                    } else if (cur.value === "ctxCLOSE") {
                        if(rval.length === 1 && cur.count <= 0 && !flat) {
                            rval = rval[0];
                        }
                        break;
                    } else {
                        if(idx < rval.length) {
                            rval[idx++] = cur.value;
                        } else
                            console.error("idx got to big building array from LL")
                    }

                    if(cur.next == null && rval.length === 1 && !flat) 
                        rval = rval[0];

                    cur = incCur(cur);
                }
                return rval;
            }

            return builder();
        }

        function buildResult(collected = false, result = null,node = null,accessor = null) {
            return {__type:"pathResult",result,node,accessor,collected}
        }

        const recursor = (treeRoot,tokens = this.tokens, cursor=0) => {
            if(stopResolution) return;

            if(collectNext) {
                llpush(buildResult(true,treeRoot));
            }

            if(cursor >= tokens.length || returnEarly || tokens[cursor].type === "CONCAT") {
                if(treeRoot == null) {
                    if(!flat) llpush(undefined);
                    return;
                }
                if(treeRoot instanceof BaseNode) return llpush(buildResult(returnEarly,treeRoot,treeRoot));
                return llpush(buildResult(returnEarly,treeRoot));
            }

            returnEarly = false;
            let nextRoots = [treeRoot];
            let skipToken = false;
            if(forwardHandler != null) {
                const decision = forwardHandler(treeRoot, tokens[cursor], cursor === tokens.length-1,handlerOptions);
                
                if(decision?.overrides != undefined) {
                    nextRoots = decision.overrides;
                }

                switch (decision?.action) {
                    case "return_next":
                        returnEarly = true;
                        break;
                    case "return":
                    case "return_this":
                        returnEarly = true;
                        return recursor(treeRoot,tokens,cursor);
                    
                    case "collect_next":
                        collectNext = true;
                        break;
                    case "collect":
                    case "collect_this":
                        llpush(buildResult(true,treeRoot))
                        break;

                    case "skip_token":
                        skipToken = true;
                        break;
                    case "skip":
                    case "skip_branch":
                        return;

                    case "stop_next":
                        stopResolution = true;
                        break;
                    case "stop":
                        stopResolution = true;
                        return recursor(treeRoot,tokens,cursor);

                    case "continue":
                    default:
                        // do nothing, continue as normal
                }
            }

            const resolveToken = (_treeRoot,tokens,cursor) => {
                // skip over containers and BaseNodes for tokens
                // that access a child element
                switch(tokens[cursor].type) {
                    case "O_KEY":
                    case "A_LIST":
                    case "A_SLICE":
                    case "A_WILDCARD":
                        while (
                            _treeRoot != undefined && (
                                _treeRoot.__type === "container" 
                                || _treeRoot instanceof Container
                                || _treeRoot instanceof BaseNode
                            )
                        ) {
                            if(_treeRoot instanceof BaseNode) {
                                _treeRoot = _treeRoot.passThrough;
                            } else {
                                _treeRoot = _treeRoot.content;
                            }
                        }
                        break;
                    default:
                        break;
                }

                // If the token is not changing the root object directly, return
                // `undefined` if it doesn't exist
                if(!["T_ORIGIN","T_ROOT"].includes(tokens[cursor].type) 
                    && _treeRoot == null) {
                    if(!flat) llpush(undefined);
                    return;
                }

                switch(tokens[cursor].type) {
                    case 'T_ORIGIN':
                        if(tokens[cursor].value != null)
                            _treeRoot = tokens[cursor].value;
                        recursor(_treeRoot,tokens,cursor+1);
                        break;
                    case 'T_ROOT':
                        if(tokens[cursor].value != null) {
                            const newRoot = Path.findRoot(tokens[cursor].value)
                            if(newRoot != null) {
                                _treeRoot = newRoot;
                            }
                        }
                        recursor(_treeRoot,tokens,cursor+1);
                        break;
                    case 'T_BACK':
                        let parent = _treeRoot?.[Symbol.for("parent")];
                        while (
                            parent?.__type === "container" 
                            || parent instanceof Container
                            || parent instanceof BaseNode
                        ) {
                            parent = parent?.[Symbol.for("parent")]
                        }
                        if(parent != undefined) {
                            recursor(parent,tokens,cursor+1);
                        } else {
                            recursor(_treeRoot,tokens,cursor+1)
                        }
                        break;
                    case 'O_KEY':
                        if(_treeRoot instanceof Object) { 
                            if (tokens[cursor].value === '*') {
                                llpushOpen();
                                /** @type {Array<string>} */
                                const keys = Object.keys(_treeRoot).filter((val) => !val.startsWith("__"));
                                keys.forEach((key) => {
                                    recursor(_treeRoot[key],tokens,cursor+1);
                                });
                                llpushClose(true);
                            } else {
                                const nextVal = _treeRoot[tokens[cursor].value];
                                recursor(nextVal,tokens,cursor+1);
                            }
                        }
                        break;
                    case 'A_LIST':
                        if(Array.isArray(_treeRoot)) {
                            llpushOpen();
                            tokens[cursor].value.forEach(idx => {
                                recursor(_treeRoot.at(idx),tokens,cursor+1);
                            });
                            llpushClose();
                        }
                        break;
                    case 'A_SLICE':
                        if(Array.isArray(_treeRoot)) {
                            llpushOpen();
                            const bounds = tokens[cursor].value;
                            _treeRoot.slice(bounds.min,bounds.max).forEach((item,idx) => {
                                recursor(item,tokens,cursor+1);
                            });
                            llpushClose(true);
                        }
                        break;
                    case 'A_WILDCARD':
                        if(Array.isArray(_treeRoot)) {
                            llpushOpen();
                            _treeRoot.forEach((item,idx) => {
                                recursor(item,tokens,cursor+1);
                            })
                            llpushClose(true);
                        }
                        break;
                    case 'N_ACCESSORS':
                        if(_treeRoot instanceof BaseNode) {
                            llpushOpen();
                            tokens[cursor].value.forEach(accessor => {
                                llpush(buildResult(returnEarly,_treeRoot.accessors[accessor],_treeRoot,accessor));
                            });
                            llpushClose();
                        }
                        break;
                    
                    case 'T_GROUP':
                        if (_treeRoot != null) {
                            const oldCtx = {returnEarly, collectNext}
                            let start_idx = 0
                            const tokensRest = tokens.slice(cursor+1);
                            let gtoken = null;
                            llpushOpen();
                            for(let idx = 0;idx <= tokens[cursor].value.length;idx++) {
                                if(idx < tokens[cursor].value.length) gtoken = tokens[cursor].value[idx];
                                if(idx === tokens[cursor].value.length || gtoken?.type === 'CONCAT') {
                                    const groupTokens = [...tokens[cursor].value.slice(start_idx,idx),...tokensRest];
                                    recursor(_treeRoot,groupTokens,0);
                                    if(stopResolution) break;
                                    ({returnEarly,collectNext} = oldCtx);
                                    start_idx = idx+1;
                                }
                            };
                            llpushClose();
                        }
                        break;
                    case 'CONCAT':               
                        break;
                    default:
                        recursor(_treeRoot,tokens,cursor+1); // skip token
                        break;  
                }
            }

            nextRoots.forEach((nextRoot) => {
                llpushOpen();
                if(skipToken) recursor(nextRoot,tokens,cursor+1);
                else resolveToken(nextRoot,tokens,cursor);
                llpushClose();
            });

            if(reverseHandler != null) {
                reverseHandler(treeRoot, tokens[cursor], cursor === tokens.length-1,handlerOptions);
            }
        }

        const query_container = [];
        let query_start_idx = 0
        for(let idx = 0;idx <= this.tokens.length;idx++) {
            const token = idx === this.tokens.length 
                ? null : this.tokens[idx];
            if(token == null || token.type === 'CONCAT') {
                const tokensList = this.tokens.slice(query_start_idx,idx);
                recursor(root,this.tokens,query_start_idx);
                query_start_idx = idx+1;
            }
        }

        return llbuildArray();
    }
}

class ExprValue {
    static diceRegex = {
        diceroll: /(\d+)d(\d+)\s*/,
        rule_keep_drop: /(?:kh|kl|dh|dl)\d+/,
        rule_reroll: /(?:rr|ro)(?:\d+|\[\s*(?:\d+(?:\s*,\s*\d+)*|\d+:\d*|\d*:\d+)\s*\])/
    }

    static parser = new exprEval.Parser({
        operators: {
            assignment: false
        }
    })

    /**
     * 
     * @param {(string|number)} value 
     * @param {Object|Path} origin 
     */
    constructor(value, origin=null) {
        /** @type {Map<String,Path>} */
        this.precedentPaths = new Map()
        this.modify(value, origin)
    }

    /**
     * 
     * @param {string|number|boolean|null} newValue 
     * @param {Object|Path|null} origin 
     * @returns {string|number|boolean|null} The final value of this expression
     */
    modify(newValue, origin=null) {
        const oldPaths = new Map(this.precedentPaths);
        this.origin = origin ?? new Path("");
        this.value = newValue;
        if(typeof(newValue) === "string") {
            this.isExpr = newValue[0] === "=";
            if(!this.isExpr) this.precedentPaths.clear();
            this.expr = this.isExpr ? this.processExpr(newValue,origin) : undefined;
            if(newValue.startsWith("r="))
                this.value = newValue.slice(1);
        }
        return oldPaths;
    }

    /**
     * @param {string|number|boolean|null} newValue 
     * @returns {boolean} Whether or not the value actually changed
     */
    set(newValue) {
        if(!this.isExpr) {
            if (['number','boolean'].includes(typeof(newValue))) {
                this.value = newValue;
                return true;
            } else if (typeof(newValue) === "string") {
                if(newValue.startsWith("r=")) {
                    this.value = newValue.slice(1);
                    return true;
                }else if(newValue[0] != '=') {
                    this.value = newValue;
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 
     * @param {string} value 
     * @param {Object|Path|null} origin 
     * @returns 
     */
    processExpr(value, origin) {
        // Preprocess text
        
        // Empty strings are not expressions
        if (!this.isExpr || value.length < 1)
            return undefined;

        // Remove leading '=' if applicable
        /** @type {string} */
        if (value[0] === '=') value = value.slice(1); 


        // Empty data() calls cause problems add an empty string to them
        value = value.replace(/data\(\)/g,"data('')");


        // replace dice expressions with roll function calls
        {
            let diceExprRegex = new RegExp(`${ExprValue.diceRegex.diceroll.source}`+
                `((?:(?:${ExprValue.diceRegex.rule_keep_drop.source}|`+
                `${ExprValue.diceRegex.rule_reroll.source})\\s*)*)`,"g");

            value.replace(diceExprRegex,"roll($1,$2,'$3')")
        }

        // Parse text into expression object
        let expr = ExprValue.parser.parse(value);
        this.precedentPaths.clear()

        // preprocess the expression.
        // extract paths, replace paths with absolute path objects,
        // and add paths to dependencies list as they are found.
        let pathfound = false;
        for (let token of expr.tokens) {
            if (token.type == 'INUMBER' && pathfound) {
                let pathObj = new Path(token.value, origin);
                let existingPath = this.precedentPaths.get(token.value)
                if (existingPath == undefined) {
                    this.precedentPaths.set(token.value,pathObj);      // add path to dependencies
                    existingPath = pathObj;
                }
                token.value = existingPath;                                     // replace data() input with path object
                pathfound = false;
            }
            if (token.type == 'IVAR' && token.value == 'data') pathfound = true;
        }

        return expr
    }

    evaluate(root = null) {
        //Update path
        /** @param {Path} path */
        ExprValue.parser.functions.data = (path, fallback=NaN) => {
            const replaceVals = (val) => {
                if (val?.__type === "pathResult") {
                    return replaceVals(val.result);
                } else if (["string","boolean"].includes(typeof(val))) {
                    return val;
                } else if (typeof(val) === "number") {
                    return Number.isNaN(val) ? fallback : val;
                } else if(val instanceof BaseNode) {
                    return replaceVals(val.accessors.value);
                } else if (Array.isArray(val)) {
                    return val.map(replaceVals)
                } else {
                    return fallback;
                }
            }
            let result = path.resolve({root:root});

            if (result instanceof ExprValue) {
                throw EvalError("This isn't supposed to happen!!")
            } else {
                result = replaceVals(result);
            }
            return result;
        }

        if (this.isExpr)
            try {
                return this.expr.evaluate();
            } catch (err) {
                console.error(`Error evaluating expression at origin ${Path.pathTo(this.origin).str}: '${this.value}'\n${err.message}`);
            }
        return this.value;
    }

    getSaveData() {
        if(this.isExpr)
            return this.value;
        else if (typeof(this.value) === "string" && this.value[0] === '=')
            return "r"+this.value;
        else
            return this.value;
    }
}
ExprValue.parser.functions.roll = function (number, sides, rules='') {
    const rolls = []
    for (let i = 0;i < number;i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    // apply rules

    // sum values
    return rolls.reduce((pv,cv) => pv+cv);
}
ExprValue.parser.functions.sum = function (arr) {
    return arr.reduce((pv,cv) => pv + cv,0);
}
ExprValue.parser.functions.asum = function (arr1, arr2) {
    const rval = new Array(max(arr1.length,arr2.length));
    for(let i = 0;i < rval.length;i++) {
        if(i < arr1.length && i<arr2.length) rval[i] = arr1[i] + arr2[i];
        else if (i < arr1.length)            rval[i] = arr1[i];
        else if (i < arr2.length)            rval[i] = arr2[i];
        else rval[i] = 0;
    }
    return rval;
}
ExprValue.parser.functions.any = function (arr) {
    return arr.reduce((pv,cv) => {
        if(cv) return true;
        return pv;
    },false);
}
ExprValue.parser.functions.every = function (arr) {
    return arr.reduce((pv,cv) => {
        if(!cv) return false;
        return pv;
    },true);
}
ExprValue.parser.functions.prod = function (arr) {
    return arr.reduce((pv,cv) => pv * cv,0);
}
ExprValue.parser.functions.aprod = function (arr1, arr2) {
    const rval = new Array(Math.max(arr1.length,arr2.length));
    for(let i = 0;i < rval.length;i++) {
        if(i < arr1.length && i<arr2.length) rval[i] = arr1[i] * arr2[i];
        else if (i < arr1.length)            rval[i] = arr1[i];
        else if (i < arr2.length)            rval[i] = arr2[i];
        else rval[i] = 0;
    }
    return rval;
}
ExprValue.parser.functions.flatten = function (arr) {
    const reducer = (pv,cv) => {
        if(Array.isArray(cv)) {
            pv.push(...cv.reduce(reducer,[]));
        } else {
            pv.push(cv);
        }
        return pv;
    }
    return arr.reduce(reducer,[]);
}

class Container {
    static defaultDataObj = {
        direction: "column",
        content: null
    }
    /**
     * @param {boolean} virtual
     * @param {Container} parent
     * @param {{direction:("row"|"column"),content:any}} dataObj
     */
    constructor(virtual, parent, dataObj) {
        this[Symbol.for("virtual")] = virtual;
        this[Symbol.for("parent")] = parent;
        let {direction,content} = {...Container.defaultDataObj, ...dataObj}

        this.renderedElement = null;
        this.content = null;
        if (content instanceof Object) {
            ({__direction:direction, ...this.content} = content);
            this.content[Symbol.for("parent")] = this;
        } else {
            this.content = content;
        }
    }

    /**
     * @returns {HTMLElement}
     */
    renderHTML() {
        const newElement = document.createElement("div");
        this.renderedElement = newElement;
        return newElement;
    }

    destroy() {
        delete this.renderedElement;
        delete this[Symbol.for("parent")]
    }

    getSaveData() {
        if(this.virtual) return undefined;
        let rval = {
            __type: "container",
            direction: this.direction,
            content: this.content
        }

        const isDefault = compareObj(rval,Container.defaultDataObj,["__type","content"]);

        if(Array.isArray(this.content) || (this.content instanceof BaseNode) 
            || !(this.content instanceof Object)
        ) {
            if (isDefault) rval = rval.content;
        } else {
            if(Container.defaultDataObj.direction !== rval.direction) 
                rval.content["__direction"] = rval.direction;
            // do same for any other metadata fields

            rval = rval.content;
        }
            
        return rval
    }
}

class Placeholder extends Container{
    constructor(virtual, parent, dataObj) {
        super(virtual, parent, dataObj)
    }
}

class BaseNode {
    /**
     * 
     * @param {boolean} virtual 
     * @param {Object} parent
     * @param {*} dataObj 
     */
    constructor(virtual,parent,dataObj) {
        let dataVal = dataObj;
        if (dataObj != null && dataObj instanceof Object)
            ({ value: dataVal } = dataObj)

        this[Symbol.for("parent")] = parent;
        this[Symbol.for("virtual")] = virtual;

        this.raw = dataObj;
        this.accessors = {
            value: dataVal
        };
        this.passThrough = undefined;

        // dependents and precedents are mapped directly to nodes after
        // the character data tree is constructed. Maps are used to 
        /** @type {Map<BaseNode,{[accessor:string]:Number}>} */
        this.dependents = new Map();
        /** @type {Map<BaseNode,{[accessor:string]:Number}>} */
        this.precedents = new Map();

        // dependencyModifications defines what changes need to be made in the next
        // dependency evaluation pass. Stores a list of Objects of the form:
        // {type:"add/remove",path:<Path>,amount:<Number>}
        /** @type {{type:String,path:Path,amount:Number}[]} */
        this.dependencyModifications = [];

        this.dirty = true;
        this.visited = false;
        
        this.error = null;
        this.warning = null;
        this.isErrorSrc = false;

        this.inputType = null;
        this.renderedElement = null;

        this.inputChangeHandler = (event) => {
            let newVal = this.accessors.value;
            switch (this.inputType) {
                case "number":
                    if (this.renderedElement != null)
                        newVal = Number(this.renderedElement.value);
                    break;
                case "checkbox":
                    if (this.renderedElement != null)
                        newVal = Boolean(this.renderedElement.checked);
                    break; 
                case "text":
                default:
                    if (this.renderedElement != null)
                        newVal = this.renderedElement.value;
            }
            if(document.activeElement === this.renderedElement)
                this.set({value:newVal});
            else
                this.evaluate();
        }

        this.inputFocusHandler = (event) => {
            
        }

        this.inputBlurHandler = (event) => {
            this.evaluate();
        }
    }

    renderHTML(value = null) {
        if(value == null) value = this.accessors.value;
        switch (typeof(value)) {
            case "string":
                this.inputType = "text";
                break;
            case "number":
                this.inputType = "number";
                break;
            case "boolean":
                this.inputType = "checkbox";
                break;
            default:
                this.inputType = null;
        }

        if(this.renderedElement == null || this.renderedElement.type != this.inputType) {
            const newElement = document.createElement("input");
            newElement.type = this.inputType ?? "text";
            if(this.renderedElement != null) {
                const oldElement = this.renderedElement;
                oldElement.replaceWith(newElement);
            }
            this.renderedElement = newElement;
            this.updateRenderedElement(value);
            if(this[Symbol.for("virtual")]) {
                this.renderedElement.disabled = true;
            } else {
                this.renderedElement.addEventListener("focus", this.inputFocusHandler);
                this.renderedElement.addEventListener("input",this.inputChangeHandler);
                this.renderedElement.addEventListener("blur", this.inputBlurHandler);
            }
        }
        return this.renderedElement;
    }

    updateRenderedElement(value) {
        if (this.renderedElement != null) {
            switch (this.inputType) {
                case "checkbox":
                    this.renderedElement.checked = !!value;
                    break; 
                case "text":
                case "number":
                default:
                    this.renderedElement.value = value;
            }
        }
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    attachInput (element) {
        this.renderedElement = element;
        element.addEventListener("change",this.inputChangeHandler);
        this.evaluate();
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    detachInput () {
        this.renderedElement?.removeEventListener("change",this.inputChangeHandler)
        this.renderedElement = null;
    }

    set(value) {
        this.setDirty();
        this.evaluate();
    }

    // idea: allow visited to be a loop counter to allow circular 
    // loops and recalculate up to x amount of times.
    setDirty() {
        if (!this.visited) {
            this.visited = true;
        } else {
            this.visited = false;
            //Update path
            this.error = `Node Source: '${Path.pathTo(this).str}' is part of a dependency loop.`;
            this.isErrorSrc = true;
            this.renderedElement.value = this.accessors.value;
            throw EvalError(this.error);
        }

        try {
            if(!this.dirty){
                this.dirty = true;
            }
            for (let node of this.dependents.keys()) {
                if (node instanceof BaseNode) {
                    node.setDirty()
                }
            }
        } catch (e){
            this.isErrorSrc = false;
            this.error = e.message;
            throw(e);
        } finally {
            this.visited = false;
        }
    }

    evaluate() {
        if (this.dirty) {
            this.dirty = false;
            
            try {
                for(let dependent of this.dependents.keys()) {
                    if (dependent instanceof BaseNode)
                        dependent.evaluate();
                }
            } catch (e) {
                this.isErrorSrc = false;
                this.error = e.message;
                throw e;
            }

            this.isErrorSrc = false;
            this.error = null;
            this.warning = null;
        }

        if(document.activeElement !== this.renderedElement || this.inputType === "checkbox")
            this.updateRenderedElement(this.accessors.value);
        return this.accessors.value;
    }

    evaluateDependencies() {
        this.dependencyModifications.forEach((mod) => {
            if(mod == null || mod.path == null || mod.type == null) return;
            //Update Path
            const resolvedPaths = mod.path.resolve({flat:true}) ?? null;
            
            const pathCrawler = (pathResult) => {
                if(pathResult == null) return;
                else if (pathResult?.__type === "pathResult") {
                    if(pathResult.result instanceof BaseNode && pathResult?.node == null) 
                        pathResult.node = pathResult.result;
                    if(pathResult?.node != null) {
                        switch (mod.type) {
                            case "add precedent":
                                this.registerPrecedent(pathResult.node,pathResult.accessor,mod.amount);
                                break;
                            case "add dependent":
                                this.registerDependent(pathResult.node,pathResult.accessor,mod.amount);
                                break;
                            case "remove precedent":
                                this.unregisterPrecedent(pathResult.node,pathResult.accessor,mod.amount);
                                break;
                            case "remove dependent":
                                this.unregisterDependent(pathResult.node,pathResult.accessor,mod.amount);
                                break;
                        }
                    }
                    return;
                } else if (Array.isArray(pathResult)) {
                    pathResult.forEach(item => pathCrawler(item));
                } else if (pathResult instanceof Object) {
                    console.error(`${Path.pathTo(this).str}: Encountered unexpected Object in dependency results.`);
                }
            }
            pathCrawler(resolvedPaths);
        });

        // Once connections are made, clear out modifications list
        this.dependencyModifications = [];
    }

    /**
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    registerPrecedent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = this.precedents.get(node) ?? {};
            const newDependentVal = node.dependents.get(this) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }

            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                newPrecedentVal[accessor] = pCount + amount;
                newDependentVal[accessor] = dCount + amount;
            }
            this.precedents.set(node,newPrecedentVal);
            node.dependents.set(this,newDependentVal);
        }
    }

    /**
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    registerDependent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = node.precedents.get(this) ?? {};
            const newDependentVal = this.dependents.get(node) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }
            
            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                newPrecedentVal[accessor] = pCount + amount;
                newDependentVal[accessor] = dCount + amount;
            }

            this.dependents.set(node,newDependentVal);
            node.precedents.set(this,newPrecedentVal);
        }
    }

    unregisterDependencies() {
        for(const [node,accessors] of this.precedents) {
            for (const [accessor,amount] of Object.entries(accessors)) {
                node.unregisterDependent(this,[accessor],amount);
            }
        }

        for(const [node,accessors] of this.dependents) {
            for (const [accessor,amount] of Object.entries(accessors)){
                node.unregisterPrecedent(this,[accessor],amount);
            }
        }
    }

    /**
     * 
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    unregisterPrecedent(node, accessors = null, amount = 1){
        if (node instanceof BaseNode) {
            const newPrecedentVal = this.precedents.get(node) ?? {};
            const newDependentVal = node.dependents.get(this) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }
            
            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                if(newPrecedentVal?.[accessor] != undefined) {
                    if(pCount > amount) newPrecedentVal[accessor] = pCount - amount;
                    else delete newPrecedentVal[accessor];
                }

                if(newDependentVal?.[accessor] != undefined) {
                    if(dCount > amount) newDependentVal[accessor] = pCount - amount;
                    else delete newDependentVal[accessor];
                }
            }

            if(Object.keys(newPrecedentVal).length > 0) {
                this.precedents.set(node,newPrecedentVal);
            } else {
                this.precedents.delete(node);
            }

            if(Object.keys(newDependentVal).length > 0) {
                node.dependents.set(this,newDependentVal);
            } else {
                node.dependents.delete(this);
            }

            this.evaluate();
        }
    }

    /**
     * 
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    unregisterDependent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = node.precedents.get(this) ?? {};
            const newDependentVal = this.dependents.get(node) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }
            
            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                if(newPrecedentVal?.[accessor] != undefined) {
                    if(pCount > amount) newPrecedentVal[accessor] = pCount - amount;
                    else delete newPrecedentVal[accessor];
                }

                if(newDependentVal?.[accessor] != undefined) {
                    if(dCount > amount) newDependentVal[accessor] = pCount - amount;
                    else delete newDependentVal[accessor];
                }
            }

            if(Object.keys(newPrecedentVal).length > 0) {
                node.precedents.set(this,newPrecedentVal);
            } else {
                node.precedents.delete(this);
            }

            if(Object.keys(newDependentVal).length > 0) {
                this.dependents.set(node,newDependentVal);
            } else {
                this.dependents.delete(node);
            }

            node.evaluate();
        }
    }

    getSaveData() {
        if (this[Symbol.for("virtual")]) return undefined;
        return null;
    }

    destroy() {
        this.detachInput();
        this.unregisterDependencies();
        delete this.raw;
        delete this.accessors;
    }
}

class DataNode extends BaseNode {
    static defaultDataObj = {
        value:0,
        min:undefined,
        max:undefined,
    }
    /**
     * @param {boolean} virtual 
     * @param {string} path 
     * @param {{
     *     value:(string|number|boolean|null),
     *     max?:(string|number),
     *     min?:(string|number)
     *   }?} dataObj
     */
    constructor(virtual, parent, dataObj) {
        let {value,min,max} = {...DataNode.defaultDataObj,...dataObj};
        super(virtual, parent,{value:value, min:min, max:max});
        //Update Pathes
        this.value = new ExprValue(value,this);
        this.max = new ExprValue(max,this);
        this.min = new ExprValue(min,this);

        this.value.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        });
        this.max.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        });
        this.min.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        });

        this.dirty = true;

        this.accessors = {
            base: 0,
            value: value,
            max: undefined, 
            min: undefined
        }

        const baseInputFocusHandler = this.inputFocusHandler;
        this.inputFocusHandler = (event) => {
            if (this.value.isExpr && this.renderedElement.type !== "text") {
                this.renderHTML(this.value.value);
                this.renderedElement.focus();
            }
            this.updateRenderedElement(this.value.value);
        }
        this.inputBlurHandler = (event) => {
            if (this.renderedElement?.type === "text"){
                this.modify({value:this.renderedElement.value});
            }
            this.evaluate();
            if(this.renderedElement?.type === "text")
                this.renderHTML(this.accessors.value);
        }
        const baseInputChangeHandler = this.inputChangeHandler;
        this.inputChangeHandler = (event) => {
            if(!this.value.isExpr)
                baseInputChangeHandler(event);
        }
    }

    /**
     * 
     * @param {Map<string,Path>} oldPaths 
     * @param {Map<string,Path>} newPaths 
     * @param {"precedent"|"dependent"} type 
     * @returns 
     */
    calculateDepMods(oldPaths,newPaths,type="precedent") {
        if(!(["precedent","dependent"].includes(type))) return;

        const dependencyMods = [];
        newPaths.forEach((path, key) => {
            if (oldPaths.has(key)) {
                oldPaths.delete(key)
            } else {
                dependencyMods.push({type:`add ${type}`,path:path,amount:1})
            }
        });
        oldPaths.forEach((path,key) => {
            dependencyMods.push({type:`remove ${type}`,path:path,amount:1})
        })
        return dependencyMods;
    }

    set({value=undefined,min=undefined,max=undefined}) {
        if(!this[Symbol.for("virtual")]) {
            let success = false;
            if(value != undefined) if(this.value.set(value)) success = true;
            if(min != undefined) if(this.min.set(min)) success = true;
            if(max != undefined) if(this.max.set(max)) success = true;
            if(success) {
                this.setDirty();
            }
        }
        this.evaluate();
    }

    /**
     * @param {{
     *  value:(string|number|boolean|undefined),
     *  min:(string|number|boolean|undefined),
     *  max:(string|number|boolean|undefined)
     * }}  
     */
    modify({value=undefined,min=undefined,max=undefined}) {
        /**
         * @param {ExprValue} accessor 
         * @param {string|boolean|number} newVal 
         * @returns {Array<{type:string,path:Path,amount:Number}>}
         */
        const getDepMods = (accessor,newVal) => {
            const dependencyMods = [];
            const oldPaths = accessor.modify(newVal,this);
            //Update Path
            return this.calculateDepMods(oldPaths,accessor.precedentPaths);
        }

        if(!this[Symbol.for("virtual")]) {
            if(value != undefined && value !== this.value.value) {
                try {value = JSON.parse(value)} catch (err) {}
                this.dependencyModifications.push(...getDepMods(this.value,value));
            }
            if(min != undefined && min !== this.min.value) {
                try {min = JSON.parse(min)} catch (err) {}
                this.dependencyModifications.push(...getDepMods(this.min,min)); 
            }
            if(max != undefined && max !== this.max.value) {
                try {max = JSON.parse(max)} catch (err) {}
                this.dependencyModifications.push(...getDepMods(this.max,max)); 
            }

            this.evaluateDependencies();
            this.setDirty();
        }
        this.evaluate();
    }

    evaluate() {
        if(this.dirty) {
            try {

                const clamp = (val, min, max) => {
                    if (min != null) {
                        val = Math.max(val,min);
                    }

                    if (max != null) {
                        val = Math.min(val,max);
                    }
                    return val;
                }

                // Evaluate this node
                // max
                let result = this.max.evaluate();
                this.accessors.max = 
                    (Number.isNaN(result) || result == null)
                    ? null 
                    : result;

                // min
                result = this.min.evaluate();
                this.accessors.min = 
                    (Number.isNaN(result) || result == null)
                    ? null 
                    : result;

                this.accessors.base = this.value.evaluate();

                // calculate modifiers
                const modOperations = {}
                for(const [node,accessors] of this.precedents.entries()) {
                    if (node instanceof ModifierNode){

                        if(!node.accessors.condition) continue;

                        for (let accessor of Object.keys(accessors)) {
                            // do something with the node operation and value
                            // priority order: replace first, then multiply, then add
                            if(accessor === "node") accessor = "value";
                            if(modOperations[accessor] == undefined) {
                                modOperations[accessor] = {};
                            }
                            const accessorMods = modOperations[accessor];
                            switch(node.operation) {
                                case "replace":
                                    if(accessorMods?.replace == undefined) {
                                        accessorMods.replace = {__highest: node.tier}
                                    } else if(node.tier > accessorMods.replace.__highest || accessorMods.replace.__highest === "default") {
                                        accessorMods.replace.__highest = node.tier; // highest tier takes priority. "default" is lowest tier
                                    }
                                    accessorMods.replace[node.tier] = node.accessors.value;
                                    break;
                                case "multiply":
                                    if(accessorMods.replace != undefined)
                                        break;
                                    if(accessorMods?.multiply == undefined)
                                        accessorMods.multiply = {}
                                    if(accessorMods.multiply?.[node.tier] == undefined) {
                                        accessorMods.multiply[node.tier] = node.accessors.value
                                    } else {
                                        accessorMods.multiply[node.tier] += node.accessors.value; // all multipliers of same tier add
                                    }
                                    break;
                                case "add":
                                    if(accessorMods.replace != undefined)
                                        break;
                                    if(accessorMods?.add == undefined)
                                        accessorMods.add = {}
                                    if(accessorMods.add?.[node.tier] == undefined) {
                                        accessorMods.add[node.tier] = node.accessors.value;
                                    } else {
                                        if(node.tier === "default") {               // default tier simply adds addition modifiers together
                                            accessorMods.add[node.tier] += node.accessors.value;
                                        } else {                                    // specified tier sets strongest value
                                            if(Math.abs(node.accessors.value) > accessorMods.add[node.tier]) {
                                                accessorMods.add[node.tier] = node.accessors.value;
                                            }
                                        }
                                    }
                                    break;
                                default:
                                    //Skip over node
                                    break;
                            }
                        }
                    }
                }
                
                // apply modifiers
                this.accessors.base = clamp(
                    this.accessors.base,
                    this.accessors.min,
                    this.accessors.max
                );

                const modProcessOrder = [];
                const {base:modOperationsBase,...modOperationsRest} = modOperations;
                if(modOperationsBase != undefined)
                    modProcessOrder.push(modOperationsBase)
                else
                    this.accessors.value = this.accessors.base;
                modProcessOrder.push(...Object.entries(modOperationsRest))

                for (const [accessor,operations] of modProcessOrder) {
                    if(this.accessors[accessor] != undefined) {
                        if(operations.replace != undefined) {                   // replace operations overrule other operations
                            this.accessors[accessor] = operations.replace[operations.replace.__highest]; // highest tier wins
                        } else {

                            if(operations.multiply != undefined) {              // TODO: Come back to this and decide if multiply or add comes first
                                for(const value of Object.values(operations.multiply)) {
                                    this.accessors[accessor] *= value;
                                }
                            }

                            if(operations.add != undefined) {                   
                                for(const value of Object.values(operations.add)) {
                                    this.accessors[accessor] += value;
                                }
                            }
                        }
                    }
                    if(accessor === "base") {
                        this.accessors.base = clamp(
                            this.accessors.base,
                            this.accessors.min,
                            this.accessors.max
                        );
                        this.accessors.value = this.accessors.base;
                    }
                }

                this.accessors.value = clamp(
                    this.accessors.value,
                    this.accessors.min,
                    this.accessors.max
                );

            } catch (e) {
                this.isErrorSrc = true;
                this.error = e.message;
                //Update Path
                e.message = `Node Source: ${Path.pathTo(this).str} ${e.message}`
                throw e;
            }
        }
        return super.evaluate();
    }

    getSaveData() {
        let rval = super.getSaveData();
        if (rval === undefined) return rval;
        
        rval = {
            __type: "data",
            value: this.value.getSaveData(),
            min: this.min.getSaveData(),
            max: this.max.getSaveData()
        }
        if(compareObj(DataNode.defaultDataObj, rval, ["__type","value"]))
            rval = rval.value;

        return rval;
    }
}

class ModifierNode extends DataNode {
    static defaultDataObj = {
        ...super.defaultDataObj,
        target: undefined,
        operation:"add",
        condition: true,
        tier: "default",
    }
    /**
     * @param {boolean} virtual 
     * @param {string} path 
     * @param {{
     *  target:string,
     *  operation:("add"|"multiply"|"replace"),
     *  value:(number|"string starting with '='"|boolean),
     *  max:(number|"string starting with '='"|boolean),
     *  min:(number|"string starting with '='"|boolean),
     *  tier: number
     * }} dataObj
     */
    constructor(virtual, parent, dataObj) {
        const {target,operation,value,max,min,condition,tier=0} = {...ModifierNode.defaultDataObj, ...dataObj};
        super(virtual, parent, {target,operation,value,condition,tier});
        //Update Path
        if(target != undefined)
            this.target = new Path(target, this);
        else
            this.target = undefined;
        this.dependencyModifications.push({type:"add dependent",path:this.target,amount:1});

        this.operation = operation;
        this.tier = "default";
        if (typeof(tier) === "string") {
            this.tier = sanatizeKey(tier);
        } else if (typeof(tier) === "number") {
            this.tier = tier;
        }

        this.condition = new ExprValue(condition ?? true, this);
        this.condition.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        })

        this.accessors.condition = condition ?? true;
    }

    evaluate() {
        if (this.dirty) {
            this.accessors.condition = this.condition.evaluate();
        }
        super.evaluate();
    }

        /**
     * @param {{
     *  condition:(string|boolean|undefined),
     *  value:(string|number|boolean|undefined),
     *  min:(string|number|boolean|undefined),
     *  max:(string|number|boolean|undefined)
     * }}  
     */
    modify({condition = undefined,...rest}) {
        /**
         * @param {ExprValue} accessor 
         * @param {string|boolean|number} newVal 
         * @returns {Array<{type:string,path:Path,amount:Number}>}
         */
        const getDepMods = (accessor,newVal) => {
            const dependencyMods = [];
            const oldPaths = accessor.modify(newVal,this);
            //Update Path
            return this.calculateDepMods(oldPaths,accessor.precedentPaths);
        }

        if(!this[Symbol.for("virtual")]) {
            if(condition != undefined) {
                try {condition = JSON.parse(condition)} catch (err) {}
                this.dependencyModifications.push(...getDepMods(this.condition,condition));
            }
        }

        super.modify(...rest);
    }

    getSaveData() {
        let rval = super.getSaveData();
        if (rval === undefined) return rval;

        const newData = {
            __type: "modifier",
            target: this.target.raw,
            operation: this.operation,
            condition: this.condition.getSaveData(),
            tier: this.tier
        }

        if(rval instanceof Object) {
            Object.assign(rval,newData);
        } else {
            newData.value = rval;
            rval = newData;
        }

        return rval;
    }
}










// test functions

let testFileData = `{
    "data":{
        "HP#data":{"value":30,"max":110},
        "Ability Scores":{
            "Strength":{
                "score":{"__type":"data","value":10,"max":20,"min":0}
            },
            "Dexterity":{
                "score":{"__type":"data","value":8,"max":20,"min":0}
            },
            "Constitution":{
                "score":{"__type":"data","value":13,"max":20,"min":0}
            },
            "Wisdom":{
                "score":{"__type":"data","value":15,"max":20,"min":0}
            },
            "Intelligence":{
                "score":{"__type":"data","value":12,"max":20,"min":0}
            },
            "Charisma":{
                "score":{"__type":"data","value":20,"max":20,"min":0}
            }
                
        },
        "Some Data":{
            "multiNode":[
                {"__type":"data","value":10},
                {"__type":"data","value":20},
                {"__type":"data","value":30},
                {"__type":"data","value":"=data('$Equipment.items[1].name')=='Shield'"}
            ],
            "sideNode":"=data('.multiNode[1]')"
        },
        "Equipment":{
            "capacity":"=data('$Ability Scores.Strength.score') * 15",
            "items":[
                {
                    "name":"Shortsword",
                    "desc":"blablabla",
                    "equipped":false
                },
                {
                    "name":"Shield",
                    "desc":"blablabla",
                    "equipped":false
                },
                {
                    "desc":"no name"
                }
            ]
        },
        "constructor":"malicious code",
        "reduce":"more malicious code"
    },
    "rules": {
        "Ability Scores.*": {
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
        },
        "Equipment.items[*]": {
            "__type": "requirement",
            "equipped":false
        }
    }
}`

let testChar = new Character(testFileData);
let testNode = new Path('Ability Scores.Strength.score',testChar.root).resolve();
if(testNode?.__type === "pathResult") testNode = testNode.result;

testPath1 = new Path("Ability Scores.Strength.score",testChar.root);
// console.log(testPath1.resolveStrs());

testPath2 = new Path("Ability Scores.(Strength.(score,mod,save),Constitution.(score,mod),Charisma.(score,mod,save))#value,max,min",testChar.root);
// console.log(testPath2.resolveStrs());

testPath3 = new Path("Ability Scores.Charisma.mod",testChar.root);
// console.log(testPath3.resolveStrs({relativeTo:testNode[Symbol.for("parent")][Symbol.for("parent")]}));

testPath4 = new Path("Equipment.items[*].equipped",testChar.root);
// console.log(testPath4.resolveStrs());

testPath5 = new Path(".name",testPath4);
// console.log(testPath5.resolveStrs());

testPath6 = new Path(".mod",testNode)
// console.log(testPath6.resolveStrs());