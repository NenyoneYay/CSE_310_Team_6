
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
    if (idx < 0) idx += arr.length;
    if (idx < 0 || idx > arr.length) return undefined;
    return arr[idx];
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

function deepCopy (obj, filterFunc = null, leaveFiltered = false) {
    if(filterFunc == null) filterFunc = ((k,v) => true);

    const recursor = (obj) => {
        if(Array.isArray(obj)) {
            if(Object.hasOwn(obj,Symbol.for("deepCopy_visited")))
                return obj[Symbol.for("deepCopy_visited")];
            const rval = [];
            obj[Symbol.for("deepCopy_visited")] = rval;
            for(const [idx,item] of obj.entries()) {
                if(!filterFunc(idx,item)) {
                    if (leaveFiltered) rval.push(item);
                } else {
                    rval.push(recursor(item));
                }
            }
            for(const sym of Object.getOwnPropertySymbols(obj)) {
                if(sym === Symbol.for("deepCopy_visited")) continue;
                if(!filterFunc(sym,obj[sym])) {
                    if (leaveFiltered) rval[sym] = obj[sym];
                } else {
                    rval[sym] = recursor(obj[sym]);
                }
            }
            delete obj[Symbol.for("deepCopy_visited")];
            return rval;
        } else if(obj instanceof Object) {
            if(Object.hasOwn(obj,Symbol.for("deepCopy_visited")))
                return obj[Symbol.for("deepCopy_visited")];
            const rval = {};
            obj[Symbol.for("deepCopy_visited")] = rval;
            for(const key of Object.keys(obj)) {
                if(!filterFunc(key,obj[key])) {
                    if (leaveFiltered) rval[key] = obj[key];
                } else {
                    rval[key] = recursor(obj[key]);
                }
            }
            for(const sym of Object.getOwnPropertySymbols(obj)) {
                if(sym === Symbol.for("deepCopy_visited")) continue;
                if(!filterFunc(sym,obj[sym])) {
                    if (leaveFiltered) rval[sym] = obj[sym];
                } else {
                    rval[sym] = recursor(obj[sym]);
                }
            }
            delete obj[Symbol.for("deepCopy_visited")];
            return rval;
        } else {
            return obj;
        }
    }

    return recursor(obj);
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
            const targetObjs = targetPath.resolve(root ?? this.root,false);

            const pathCrawler = (pathResult) => {
                if (pathResult?.__type === "pathLeaf") {
                    const targetObj = pathResult.result;
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
                } if (pathResult?.__type === "pathLeaf_accessors") {
                    return; // do nothing to existing nodes found
                } else if (Array.isArray(pathResult)) {
                    for(const result of pathResult) {
                        pathCrawler(result);
                    }
                }
            }

            pathCrawler(targetObjs);
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
     * Group 1: '.' or ',' for path separator logics
     * Group 2: Group token. Expressed: (key1,key2,...)
     * - Each key can have array accessors. These items are grouped and returned
     *   as an array.
     * - Tokens are recursively parsed inside.
     * Group 2: Key token. Expressed: Key1.Key2
     * - Each of these keys can have array accessors. These are singleton
     *   object paths.
     * Group 3: Array index list accessor. Expressed: [1,2,3] or [2]
     * - Can be negative numbers. Negatives are wrapped around to end of array.
     * - Comes after Key or Group tokens.
     * Group 4: Array index slice accessor. Expressed: [:5](beginning -> 5), [3:] (3 -> end), [:] (Everything)
     * - Can be negative numbers. Also wrapped to end of array.
     * - Comes after Key or Group tokens.
     * Group 5: "*" Wildcard array accessor. Expressed: [*]
     * - refers to entire array
     * - Comes after Key or Group tokens.
     * Group 6: "#" accessor sigils. Expressed: #accessor1,accessor2,... at the end of a query or on it's own
     * Group 7: ';' semicoln to separate full path queries
     */
    static tokensRegex = /(?<=^|[;,\.])\s*(\.+)|(?:(?<=^|[\.;,\(])\s*(?:([\w~][\w: ~-]*?|\*))\s*?(?=$|[\.\[;#,\)]))|(?<=[\w: ~\)\]-])\[\s*(?:(-?\d+(?:\s*,\s*-?\d+)*)|(-?\d*\s*:\s*-?\d*)|(\*))\s*\]\s*(?=$|[\.\[#,;\)])|#(\w+(?:,\w+)*)\s*(?=$|[;\)])|(;|,)|\.|(\()|(\))/y;
    /* Test Syntax string:
        Key Value.(Key[47],Key,key)[5][5:][*].Key[5,789,-6]#accessor1,accessor2;Key:morekey.Key.Key[:-1].*#accessor1,accessor3,accessor4
        items[1,-4,5][*][1][-1][1:][:1][-2:3]
        Strength[3][5][6];Dexterity[7]
        hello;world
        (h,l,p,asdf,jlsadf)[5];asdf
        #accessor1,accessor2
    */

    static tokenCopyFilter = (k,v) => !(k === Symbol.for("parent") || v instanceof BaseNode);

    static absolutePathStr(obj, root=null) {
        if(obj instanceof Path) 
            return obj.getPathStr(false, root);

        if(root!=null && obj === root) return "";
        if(obj != null && obj instanceof Object) {
            const parentObj = obj[Symbol.for("parent")];
            if(parentObj != undefined) {
                const parentPath = Path.absolutePathStr(parentObj,root);
                if (Array.isArray(parentObj)) {
                    return parentPath + `[${parentObj.indexOf(obj)}]`
                } else {
                    return parentPath + `${parentPath === "" ? "" : "."}${Object.keys(parentObj).find((key) => parentObj[key] === obj) ?? "<Not found>"}`
                }
            } else {
                return "";
            }
        }
        return undefined;
    }

//Update path
    /**
     * 
     * @param {string|Path|Array<{type:string,value:any}>} path 
     * @param {Path|Object} origin
     */
    constructor(path = "", origin=null) {
        /** @type {string} */
        this.raw = path;

        // tokenize the path syntax from path
        /** @type {Array<{type:string,value:any}>} */
        this.tokens = [];

        if(typeof(path) === "string") {
            if(origin instanceof Path)
                this.tokens = this.tokenize(path, origin);
            else if (origin instanceof Object) {
                this.tokens = this.tokenize(path, undefined, origin);
            } else {
                this.tokens = this.tokenize(path);
            }
        } else if (path instanceof Path) {
            this.raw = path.raw;
            this.tokens = deepCopy(path.tokens,Path.tokenCopyFilter,true);
        } else if (Array.isArray(path)) {
            let pathOrigin = undefined;

            if (origin instanceof Path) {
                this.tokens = this.tokenize("",origin);
            } else if (origin instanceof Object) {
                this.tokens = this.tokenize("",undefined,origin);
            }
            this.tokens.push(...deepCopy(path,Path.tokenCopyFilter,true));
            this.raw = this.getPathStr(true);
        }

        Path.tokensRegex.lastIndex = 0;
    }

    /** 
     * @param {string} str 
     * @param {rootPath} Path
     * */

    tokenize (str,originPath=null,originObj=null) {
        if (str == undefined) return [];

        /** @type {Object[]} */
        const contextStack = [];

        let tokens = [];
        if(str.length === 0 || ".#".includes(str[0])){
            if (originPath != null) {
                tokens = deepCopy(originPath.tokens,Path.tokenCopyFilter,true);
            } else if (originObj != null) {
                tokens.push({type:"T_ORIGIN",value:originObj});
            }
        }

        for(let i = 0;i < str.length;) {
            // If for some reason the string is consumed already, quit now.
            if (i >= str.length)
                break;

            Path.tokensRegex.lastIndex = i;
            const m = Path.tokensRegex.exec(str)
            if (!m) throw SyntaxError(`Unexpected character '${str[i]}' at ${i} in '${str}'`);
            // console.log(m); // Cool Debug thing

            if (m[1] !== undefined) {
                for (let i=0;i<m[1].length;i++) {
                    // tokens.pop();
                    tokens.push({type:'T_BACK',value:'.'});
                }
            }

            else if(m[2] !== undefined) {
                tokens.push({type:'O_KEY',value:sanatizeKey(m[2])});
            }

            else if(m[3] !== undefined) {
                tokens.push({type:'A_LIST',value:m[3].split(',').map(x => parseInt(x))});
            }

            else if(m[4] !== undefined) {
                let [pmin,pmax] = m[4].split(':');
                if (pmin === '') pmin = 0;
                else pmin = parseInt(pmin);
                if (pmax === '') pmax = undefined;
                else pmax = parseInt(pmax);

                if(Number.isNaN(pmin) || Number.isNaN(pmax)) 
                    throw SyntaxError(`Token ${m[4]} at ${i}: Array slice indexes must be numbers.`);

                tokens.push({type:'A_SLICE',value:{min:pmin,max:pmax}});
            }

            else if(m[5] !== undefined) {
                tokens.push({type:'A_WILDCARD',value:'*'});
            }

            else if(m[6] !== undefined && m[6] !== '') {
                tokens.push({type:'N_ACCESSORS',value:m[6].split(',').map(x => sanatizeKey(x))});
            }
                
            else if (m[7] !== undefined) {
                tokens.push({type:'CONCAT',value:';,'});
                if (originPath != null && ".#".includes(str[i+1]) && contextStack.length < 1) {
                    tokens.push(...originPath.tokens);
                }
            }

            else if (m[8] !== undefined) { // (
                contextStack.push(tokens);// push token context into stack
                tokens = []; // create new token context
            }

            else if (m[9] !== undefined) { // )
                if (contextStack.length <= 0) throw SyntaxError(`Token ${m[9]} at ${i}: Unbalanced Parentheses. Missing opening '('`);
                const group_token = {'type':'T_GROUP','value':tokens}; // store current token context into group token
                tokens = contextStack.pop(); // pop previous context off the stack to continue where we left off
                tokens.push(group_token);
            }
            
            i = Path.tokensRegex.lastIndex;
        }
        if(contextStack.length > 0) throw SyntaxError(`EOF: Unbalanced Parentheses. Missing closing ')'`);
        
        return tokens;
    }

    getPathStr(relative = true, root = null) {
        /**
         * @param {{type:string,value:any}} pv 
         * @param {{type:string,value:any}} cv 
         * @returns 
         */
        const pathReducer = (pv,cv) => {
            let tokenStr = ''
            const startOfPath = pv === '' || (pv.length > 0 && ";,(.".includes(pv[pv.length-1]))
            switch (cv.type) {
                case 'T_ORIGIN':
                    if(relative) return '';
                    else return Path.absolutePathStr(cv.value,root);
                    break;
                case 'T_BACK':
                case 'O_KEY':
                    tokenStr = (startOfPath ? '' : '.') + cv.value;
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
                    tokenStr = ',';
                    break;
                case 'T_GROUP':
                    tokenStr = (startOfPath ? '' : '.') + `(${cv.value.reduce(pathReducer,'')})`;
                    break;
                case 'N_ACCESSORS':
                    tokenStr = `#${cv.value.join(',')}`;
                    break;
                default:
                    tokenStr = '';
            }

            return pv + tokenStr;
        }

        return this.tokens.reduce(pathReducer,'');
    }

    /**
     * @param {Object} root
     * @param {Boolean} resolveAccessors
     * @returns {Array<Array|{__type:"pathLeaf",result:any}|{__type:"pathLeaf_accessors",node:BaseNode,accessors:Array<string>}|undefined>}
     */
    resolve(root,resolveAccessors = true) {

        const recursor = (treeRoot,tokens = this.tokens, cursor=0) => {
            if(cursor >= tokens.length) return {__type:"pathLeaf",result:treeRoot};
            
            if(tokens[cursor].type === "T_ORIGIN") {
                return recursor(tokens[cursor].value,tokens,cursor+1);
            }

            if(treeRoot == null) {
                return undefined;
            }

            if (treeRoot instanceof Object && treeRoot?.["__type"] === "container") {
                if(treeRoot?.["content"] == null) return undefined;
                return recursor(treeRoot.content,tokens,cursor);
            }

            switch(tokens[cursor].type) {
                case 'T_BACK':
                    const parent = treeRoot?.[Symbol.for("parent")];
                    if(parent != undefined) {
                        return recursor(parent,tokens,cursor+1);
                    } else {
                        return recursor(treeRoot,tokens,cursor+1)
                    }
                    break;
                case 'O_KEY':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(treeRoot.passThrough,tokens,cursor);
                    else if(treeRoot instanceof Object) { 
                        if (tokens[cursor].value === '*') {
                            /** @type {Array<string>} */
                            const keys = Object.keys(treeRoot).filter((val) => !val.startsWith("__"));
                            return keys.map((key) => {
                                return recursor(treeRoot[key],tokens,cursor+1);
                            });
                        } else {
                            const nextVal = treeRoot[tokens[cursor].value];
                            return recursor(nextVal,tokens,cursor+1);
                        }
                    }
                    break;
                case 'T_GROUP':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(treeRoot.passThrough,tokens,cursor);
                    const concat_container = [];
                    let start_idx = 0
                    tokens[cursor].value.forEach((token,idx) => {
                        if(token.type === 'CONCAT') {
                            concat_container.push(recursor(treeRoot,tokens[cursor].value,start_idx));
                            start_idx = idx+1;
                        }
                    });
                    concat_container.push(recursor(treeRoot,tokens[cursor].value,start_idx));
                    if (concat_container.length === 1) return concat_container[0];
                    return concat_container.map((item) => recursor(item,tokens,cursor+1));
                    break;
                case 'CONCAT':
                    return treeRoot;
                    break;
                case 'A_LIST':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(treeRoot.passThrough,tokens,cursor);
                    if(Array.isArray(treeRoot)) {
                        let val = tokens[cursor].value
                        if(val.length > 1) {
                            return val.map(idx => {
                                if(Math.abs(idx) < treeRoot.length)
                                    return recursor(getWrappedIdx(idx,treeRoot),tokens,cursor+1);
                                return undefined;
                            });
                        } else if (val.length > 0 && Math.abs(val[0]) < treeRoot.length) {
                            return recursor(getWrappedIdx(val[0],treeRoot),tokens,cursor+1);
                        }
                    }
                    break;
                case 'A_SLICE':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(treeRoot.passThrough,tokens,cursor);
                    if(Array.isArray(treeRoot)) {
                        let bounds = tokens[cursor].value;
                        if(bounds.max == undefined) {
                            return treeRoot.slice(bounds.min).map(item => {
                                return recursor(item,tokens,cursor+1);
                            });
                        } else {
                            return treeRoot.slice(bounds.min,bounds.max).map(item => {
                                return recursor(item,tokens,cursor+1);
                            })
                        }
                    }
                    break;
                case 'A_WILDCARD':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(treeRoot.passThrough,tokens,cursor);
                    if(Array.isArray(treeRoot)) {
                        return treeRoot.map(item => {
                            return recursor(item,tokens,cursor+1);
                        })
                    }
                    break;
                case 'N_ACCESSORS':
                    if(treeRoot instanceof BaseNode) {
                        if(!resolveAccessors) 
                            return {__type:"pathLeaf_accessors",node:treeRoot,accessors:tokens[cursor].value};
                        if (tokens[cursor].value.length === 1) 
                            return {__type:"pathLeaf",result:treeRoot.accessors[tokens[cursor].value]};
                        return this.tokens[cursor].value.map(accessor => {
                            return {__type:"pathLeaf",result:treeRoot.accessors[accessor]};
                        });
                    }
                    break;
                default:
                    return recursor(treeRoot,tokens,cursor+1);
                    break;  
            }
            return undefined;
        }



        const query_container = [];
        let query_start_idx = 0
        this.tokens.forEach((token,idx) => {
            if(token.type === 'CONCAT') {
                query_container.push(recursor(root,this.tokens,query_start_idx));
                query_start_idx = idx+1;
            }
        });
        query_container.push(recursor(root,this.tokens,query_start_idx));

        //if (query_container.length === 1) return query_container[0];
        return query_container;
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

    evaluate(root) {
        //Update path
        /** @param {Path} path */
        ExprValue.parser.functions.data = (path, fallback=NaN) => {
            const replaceVals = (val) => {
                if (val?.__type === "pathLeaf") {
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
            let result = path.resolve(root);
            if(result.length === 1) result = result[0];

            if (result instanceof ExprValue) {
                throw EvalError("This isn't supposed to happen!!")
            } else if (Array.isArray(result)) {
                result = result.map(replaceVals);
            } else {
                result = replaceVals(result);
            }
            return result;
        }

        if (this.isExpr)
            try {
                return this.expr.evaluate();
            } catch (err) {
                console.error(`Error evaluating expression at origin ${Path.absolutePathStr(this.origin)}: '${this.value}'\n${err.message}`);
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
    static defaultUI_info = {
        direction: "column",
        order:0
    }
    /**
     * @param {Container} parent
     * @param {{__UI_info:{direction:"row"|"column",order:number},[x:string]:*}} containerObj
     */
    constructor(id,parent,containerObj) {
        this.id = id;
        this.parent = parent;
        this.renderedElement = null;
        this.content = null;
        this.isArray = false;
        if (Array.isArray(containerObj)) {
            this.content = containerObj;
            this.isArray = true;
        }else {
            this.__UIdir = "column"
            this.content = {};
        this.okeys = [];

            // Split containerObj keys into __UIdir and remaining keys in the "content" property
            ({__UIdir:this.__UIdir,...this.content} = {_UIdir:this.__UIdir,...containerObj});
            if (!(["row","column"].includes(this.__UIdir))) {
                this.__UIdir = "column";
            }
            
            
        }
    }

    /**
     * @returns {HTMLElement}
     */
    renderHTML() {
        this.renderedElement = document.createElement('div');
        this.renderedElement.style.display = "flex";
        this.renderedElement.style.flexDirection = this.direction;
        for(const [key,value] of Object.entries(this.contains)) {
            if(value instanceof Container || value instanceof BaseNode) {
                this.renderedElement.appendChild(value.renderHTML());
            }
        }
        return this.renderedElement;
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
        this.root = null;

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

    getName() {
        if(Array.isArray(this[Symbol.for("parent")]))
            return this[Symbol.for("parent")].indexOf(this);
        else
            return Object.keys(this[Symbol.for("parent")]).find(key => this[Symbol.for("parent")][key] === this);
    }
    
    findRoot() {
        let parentObj = this;
        while (parentObj instanceof Object && parentObj[Symbol.for("parent")] != undefined) {
            parentObj = parentObj[Symbol.for("parent")];
        }
        return parentObj;
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
            this.error = `Node Source: '${Path.absolutePathStr(this)}' is part of a dependency loop.`;
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
        this.root = this.findRoot();
        this.dependencyModifications.forEach((mod) => {
            if(mod == null || mod.path == null || mod.type == null) return;
            //Update Path
            const resolvedPaths = mod.path.resolve(this.root,false) ?? null;
            const pathCrawler = (pathResult) => {
                if(pathResult == null) return;
                else if (pathResult?.__type === "pathLeaf_accessors") {
                    switch (mod.type) {
                        case "add precedent":
                            this.registerPrecedent(pathResult.node,pathResult.accessors,mod.amount);
                            break;
                        case "add dependent":
                            this.registerDependent(pathResult.node,pathResult.accessors,mod.amount);
                            break;
                        case "remove precedent":
                            this.unregisterPrecedent(pathResult.node,pathResult.accessors,mod.amount);
                            break;
                        case "remove dependent":
                            this.unregisterDependent(pathResult.node,pathResult.accessors,mod.amount);
                            break;
                    }
                    return;
                } else if (pathResult?.__type === "pathLeaf") {
                    pathCrawler(pathResult.result);
                } else if (pathResult instanceof BaseNode) {
                    pathCrawler({__type:"pathLeaf_accessors",node:pathResult,accessors:["node"]});
                } else if (Array.isArray(pathResult)) {
                    pathResult.forEach(item => pathCrawler(item));
                    return;
                } else if (pathResult instanceof Object) {
                    for (const [key,value] of Object.entries(pathResult)) {
                        if(!key.startsWith("__")) {
                            pathCrawler(value);
                        }
                    }
                    return;
                }
                return;
            }
            pathCrawler(resolvedPaths);
        });

        // Once connections are made, clear out modifications list
        this.dependencyModifications = [];
    }

    /**
     * @param {BaseNode} node 
     * @param {string[]} accessors 
     * @param {Number} amount 
     */
    registerPrecedent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = this.precedents.get(node) ?? {};
            const newDependentVal = node.dependents.get(this) ?? {};
            if (accessors == null) {
                accessors = ["value"];
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
     * @param {string[]} accessors 
     * @param {Number} amount 
     */
    registerDependent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = node.precedents.get(this) ?? {};
            const newDependentVal = this.dependents.get(node) ?? {};
            if (accessors == null) {
                accessors = ["value"];
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
     * @param {string[]} accessors 
     * @param {Number} amount 
     */
    unregisterPrecedent(node, accessors = null, amount = 1){
        if (node instanceof BaseNode) {
            const newPrecedentVal = this.precedents.get(node) ?? {};
            const newDependentVal = node.dependents.get(this) ?? {};
            if (accessors == null) {
                accessors = ["value"];
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
     * @param {string[]} accessors 
     * @param {Number} amount 
     */
    unregisterDependent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = node.precedents.get(this) ?? {};
            const newDependentVal = this.dependents.get(node) ?? {};
            if (accessors == null) {
                accessors = ["value"];
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
                let result = this.max.evaluate(this.root);
                this.accessors.max = 
                    (Number.isNaN(result) || result == null)
                    ? null 
                    : result;

                // min
                result = this.min.evaluate(this.root);
                this.accessors.min = 
                    (Number.isNaN(result) || result == null)
                    ? null 
                    : result;

                this.accessors.base = this.value.evaluate(this.root);

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
                e.message = `Node Source: ${Path.absolutePathStr(this)} ${e.message}`
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
        if(rval.min == undefined && rval.max == undefined)
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
            this.accessors.condition = this.condition.evaluate(this.root);
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

class PlaceholderNode extends BaseNode{
    constructor(virtual, parent, data) {
        super(virtual,parent, data)
    }
}










// test functions

let testFileData = `{
    "data":{
        "HP#data":{"value":30,"max":110},
        "Ability Scores":{
            "Strength":{
                "score#data":{"value":10,"max":20,"min":0},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Dexterity":{
                "score#data":{"value":8,"max":20,"min":0},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Constitution":{
                "score#data":{"value":13,"max":20,"min":0},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Wisdom":{
                "score#data":{"value":15,"max":20,"min":0},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Intelligence":{
                "score#data":{"value":12,"max":20,"min":0},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Charisma":{
                "score#data":{"value":20,"max":20,"min":0},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            }
                
        },
        "Some Data":{
            "multiNode":[
                {"__type":"data","value":10},
                {"__type":"data","value":20},
                {"__type":"data","value":30},
                {"__type":"data","value":"=data('Equipment.items[1].name')=='Shield'"}
            ],
            "sideNode":"=data('.multiNode[1]')"
        },
        "Equipment":{
            "capacity":"=data('Ability Scores.Strength.score') * 15",
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
    }
}`

let testChar = new Character(testFileData);
let testNode = new Path('Ability Scores.Strength.score').resolve(testChar.root);
if(testNode.length >= 1) testNode = testNode[0];
if(testNode?.__type === "pathLeaf") testNode = testNode.result;