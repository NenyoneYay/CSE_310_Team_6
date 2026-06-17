
/** @type {(Character|null)} */
var loadedChar = null;

/**
 * 
 * @param {InputEvent} ev 
 * @returns 
 */
async function readSingleFile(ev) {
    const errElement = document.getElementById('error-content');
    errElement.textContent = '';
    const file = ev.target.files[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        let contents = e.target.result;
        displayContents(contents);
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
    contentElement.innerHTML = '';
}

function displayContents(contents) {
    try {
        if(loadedChar == null)
            loadedChar = new Character(contents);
        else
            loadedChar.parseFile(contents);
        loadedChar.renderHTML();
    } catch (err) {
        const element = document.getElementById('error-content');
        element.textContent = `Error: ${err.name}: ${err.message}`;
        document.getElementById('file-input').value = '';
        throw err
    }
}

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

class Character {
    constructor(fileData) {
        this.root = undefined;
        this.parseFile(fileData)
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

    parseFile(fileData){
        this.destroy();
        let jsonData = JSON.parse(fileData,function (key,value) {
            const sanatizedKey = sanatizeKey(key);
            const [baseKey,sigil] = sanatizedKey.split('#');
            let rval = value;
            
            if(Object.hasOwn(this,"__okeys") && Array.isArray(this["__okeys"])) {
                this["__okeys"].push(baseKey)
            } else {
                this["__okeys"] = [baseKey];
            }
            
            if(rval instanceof Object && key !== "") { rval["__parent"] = this; }
            
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
        let contextData = jsonData.data;
        /** @type {BaseNode[]} */
        let newNodes = [];
        const makeNode = (newNode) => {
            newNodes.push(newNode); 
            return newNode; 
        }
        const joinPath = (base,...ext) => {return base!=='' ? `${base}${ext.map(v => '.'+v).join('')}` : ext.join('.')}

        const contextRecursor = (dataTree) => {
            if (dataTree == null || dataTree instanceof BaseNode) {
                return;
            } else if (Array.isArray(dataTree)) {
                dataTree.forEach((item,idx) => contextRecursor(item))
            } else if (dataTree instanceof Object) {
                dataTree["__okeys"].forEach((key) => {
                    let [baseKey, sigil] = key.split('#');
                    if(Object.hasOwn(dataTree[key],"__type")) {
                        sigil = dataTree[key]["__type"];
                    }
                    let data = dataTree[key];
                    switch (sigil) {
                        case undefined:
                            // base datatypes turn into data nodes
                            if (["number","boolean","string"].includes(typeof(data))){
                                dataTree[key] = makeNode(new DataNode(false,dataTree,{value: data}));
                            }
                            break;
                        case "data": // DataNode
                            if (Array.isArray(data)) {
                                for (const [idx,nodeData] of dataTree[key].entries()) {
                                    if (nodeData == null) continue;
                                    let raw = (nodeData instanceof Object) ? nodeData : {value: nodeData}
                                    dataTree[key][idx] = makeNode(new DataNode(false,dataTree[key],raw));
                                }
                            } else if (["string","number","boolean"].includes(typeof(data))) {
                                dataTree[key] = makeNode(new DataNode(false,dataTree,{value: data}));
                            } else if (data instanceof Object) {
                                dataTree[key] = makeNode(new DataNode(false,dataTree,data));
                            }
                            break;
                        case "modifier":
                            if (Array.isArray(data)) {
                                for (const [idx,nodeData] of dataTree[key].entries()) {
                                    if (!(nodeData instanceof Object)) continue;
                                    dataTree[key][idx] = makeNode(new ModifierNode(false,dataTree[key],nodeData));
                                }
                            } else if (data instanceof Object){
                                dataTree[key] = makeNode(new ModifierNode(false,dataTree,data));
                            }
                            break;
                            // other node types/sigils will be defined here
                        default:
                            console.log(`Unknown sigil ${sigil}`)
                    }

                    contextRecursor(dataTree[baseKey]);
                });
            }
        }
        contextRecursor(contextData);
        this.root = contextData;
        // Make root node into root node
        delete this.root.__parent;
        newNodes.forEach((newNode) => {
            // register dependencies
            newNode.evaluateDependencies();
        });
        newNodes.forEach((newNode) => {
            // evaluate node values
            newNode.evaluate();
        });
        return jsonData;
    }
    
    renderHTML() {
        // do the html rendering here
        const recursor = (treeRoot, level = 0) => {
            if (treeRoot == null) return null;
            
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
                treeRoot["__okeys"].forEach((key) => {
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
        document.getElementById("html-content").innerHTML = "";
        document.getElementById("html-content").appendChild(recursor(this.root));

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
    static tokensRegex = /(?<=^|[;,\.])\s*(\.+)|(?:(?<=^|[\.;,\(])\s*(?:([\w~][\w: ~]*?|\*))\s*?(?=$|[\.\[;#,\)]))|(?<=[\w: ~\)\]])\[\s*(?:(-?\d+(?:\s*,\s*-?\d+)*)|(-?\d*\s*:\s*-?\d*)|(\*))\s*\]\s*(?=$|[\.\[#,;\)])|#(\w+(?:,\w+)*)\s*(?=$|[;\)])|(;|,)|\.|(\()|(\))/y;
    /* Test Syntax string:
        Key Value.(Key[47],Key,key)[5][5:][*].Key[5,789,-6]#accessor1,accessor2;Key:morekey.Key.Key[:-1].*#accessor1,accessor3,accessor4
        items[1,-4,5][*][1][-1][1:][:1][-2:3]
        Strength[3][5][6];Dexterity[7]
        hello;world
        (h,l,p,asdf,jlsadf)[5];asdf
        #accessor1,accessor2
    */

    static absolutePathStr(obj, root=null) {
        if(root!=null && obj === root) return "";
        if(obj != null && obj instanceof Object) {
            const parentObj = obj["__parent"];
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
     * @param {string} path 
     * @param {Path|Object} root
     */
    constructor(path, root=null) {
        /** @type {string} */
        this.raw = path;

        // tokenize the path syntax from path
        /** @type {Array<{type:string,value:any}>} */
        this.tokens = [];
        if(root instanceof Path)
            this.tokens = this.tokenize(path, root);
        else if (root instanceof Object && Object.hasOwn(root,"__parent")) {
            this.tokens = this.tokenize(path, undefined, root);
        } else {
            this.tokens = this.tokenize(path);
        }

        Path.tokensRegex.lastIndex = 0;
    }

    /** 
     * @param {string} str 
     * @param {rootPath} Path
     * */

    tokenize (str,rootPath=null,rootObj=null) {
        if (str == undefined) return [];

        /** @type {Object[]} */
        const contextStack = [];

        let tokens = [];
        if(str.length === 0 || ".#".includes(str[0])){
            if (rootPath != null) {
                tokens = new Array(...rootPath.tokens);
            } else if (rootObj != null) {
                tokens.push({type:"T_ROOT",value:rootObj});
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
                if (rootPath != null && ".#".includes(str[i+1]) && contextStack.length < 1) {
                    tokens.push(...rootPath.tokens);
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

    getAbsolutePathStr(root) {
        /**
         * @param {{type:string,value:any}} pv 
         * @param {{type:string,value:any}} cv 
         * @returns 
         */
        const pathReducer = (pv,cv) => {
            let tokenStr = ''
            const startOfPath = pv === '' || (pv.length > 0 && ";,(.".includes(pv[pv.length-1]))
            switch (cv.type) {
                case 'T_ROOT':
                    tokenStr = Path.absolutePathStr(root,cv.value);
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
     * @returns {(Object|BaseNode|undefined)}
     */
    resolve(root,resolveAccessors=true) {
        const recursor = (treeRoot,tokens = this.tokens, cursor=0) => {
            if(cursor >= tokens.length) return treeRoot;
            if(treeRoot == null) return undefined;

            switch(tokens[cursor].type) {
                case 'T_ROOT':
                    return recursor(tokens[cursor].value,tokens,cursor+1);
                    break;
                case 'T_BACK':
                    if(Object.hasOwn(treeRoot,"__parent")) {
                        return recursor(treeRoot.__parent,tokens,cursor+1);
                    }
                    break;
                case 'O_KEY':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(treeRoot.passThrough,tokens,cursor);
                    else if (treeRoot instanceof Container) {
                        if (tokens[cursor].value === '*') {
                            /** @type {Array<string>} */
                            const keys = treeRoot.content?.["__okeys"] ?? Object.keys(treeRoot.content).filter((val) => !val.startsWith("__"));
                            return keys.map((key) => {
                                return recursor(treeRoot.content[key],tokens,cursor+1);
                            });
                        } else {
                            return recursor(treeRoot.content[tokens[cursor].value],tokens,cursor+1);
                        }
                    }else if(treeRoot instanceof Object) { 
                        if (tokens[cursor].value === '*') {
                            /** @type {Array<string>} */
                            const keys = treeRoot?.["__okeys"] ?? Object.keys(treeRoot).filter((val) => !val.startsWith("__"));
                            return keys.map((key) => {
                                return recursor(treeRoot[key],tokens,cursor+1);
                            });
                        } else {
                            return recursor(treeRoot[tokens[cursor].value],tokens,cursor+1);
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
                            return {__type:"pathLeaf",node:treeRoot,accessors:tokens[cursor].value};
                        if (tokens[cursor].value.length === 1) 
                            return treeRoot.accessors[tokens[cursor].value];
                        return this.tokens[cursor].value.map(accessor => {
                            return treeRoot.accessors[accessor];
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

        if (query_container.length === 1) return query_container[0];
        return query_container;
    }

    /** 
     * @param {Object} root
     * @param {Object} obj
     */
    includes(root, obj) {
        
        const query_container = [];
        let compare_idx = 0
        this.tokens.forEach((token,idx) => {
            switch(token.type) {
                case 'O_KEY':
                    break;
                case 'T_GROUP':
                    break;
                case 'CONCAT':
                    break;
                case 'A_LIST':
                    break;
                case 'A_SLICE':
                    break;
                case 'A_WILDCARD':
                    break;
                case 'N_ACCESSORS':
                    break;
                default:
                    break;
            }
        });

        if (query_container.length === 1) return query_container[0];
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
     * @param {Object|Path} root 
     */
    constructor(value, root=null) {
        /** @type {Map<String,Path>} */
        this.precedentPaths = new Map()
        this.modify(value, root)
    }

    /**
     * 
     * @param {string|number|boolean|null} newValue 
     * @param {Object|Path|null} root 
     * @returns {string|number|boolean|null} The final value of this expression
     */
    modify(newValue, root=null) {
        this.value = newValue;
        if(typeof(newValue) === "string") {
            this.isExpr = newValue[0] === "=";
            this.expr = this.isExpr ? this.processExpr(newValue,root) : undefined;
            if(newValue.startsWith("r="))
                this.value = newValue.slice(1);
        }
        return this.value;
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
     * @param {Object|Path|null} root 
     * @returns 
     */
    processExpr(value, root) {
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
                let pathObj = new Path(token.value, root);
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
                if (["string","boolean"].includes(typeof(val))) {
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
            return this.expr.evaluate();
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
    let rolls = []
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
    console.log("aprod:",arr1,arr2)
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
        this.__parent = parent;
        this.raw = dataObj;
        this.accessors = {
            value: dataVal
        };
        this.virtual = virtual;
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

    getName() {
        if(Array.isArray(this.__parent))
            return this.__parent.indexOf(this);
        else
            return Object.keys(this.__parent).find(key => this.__parent[key] === this);
    }
    
    findRoot() {
        let parentObj = this;
        while (parentObj instanceof Object && parentObj.__parent != undefined) {
            parentObj = parentObj.__parent;
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
            this.renderedElement.addEventListener("input",this.inputChangeHandler);
            this.renderedElement.addEventListener("blur", this.inputBlurHandler);
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
        if(document.activeElement !== this.renderedElement)
            this.updateRenderedElement(this.accessors.value);
        
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
        return this.accessors.value;
    }

    evaluateDependencies() {
        const root = this.findRoot();
        this.dependencyModifications.forEach((mod) => {
            if(mod == null || mod.path == null || mod.type == null) return;
            //Update Path
            const resolvedPaths = mod.path.resolve(root,false) ?? null;
            const pathCrawler = (pathResult) => {
                if(pathResult == null) return;
                else if (pathResult instanceof Object && pathResult.__type === "pathLeaf") {
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
                } else if (pathResult instanceof BaseNode) {
                    pathCrawler({__type:"pathLeaf",node:pathResult,accessors:["node"]});
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
        if (this.virtual) return null;
        return this.raw;
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
        value:null,
        min:null,
        max:null,
        listeners: []
    }
    /**
     * @param {boolean} virtual 
     * @param {string} path 
     * @param {{
     *     value:(string|number|boolean|null),
     *     max?:(string|number),
     *     min?:(string|number),
     *     listeners?:Array<Object>
     *   }?} dataObj
     */
    constructor(virtual, parent, dataObj) {
        let {value,min,max,listeners} = {...DataNode.defaultDataObj,...dataObj};
        super(virtual, parent,{value:value, min:min, max:max, listeners:listeners});
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

        this.listeners = listeners;
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
            this.evaluate();
            if(this.value.isExpr) this.renderHTML(this.accessors.value);
        }
        const baseInputChangeHandler = this.inputChangeHandler;
        this.inputChangeHandler = (event) => {
            if(!this.value.isExpr)
                baseInputChangeHandler(event);
            else {
                if(this.renderedElement?.type === "text") {
                    this.modify({value:this.renderedElement.value});
                } else {
                    this.evaluate();
                }
            }
        }
    }

    renderHTML(value = null) {
        const rval = super.renderHTML(value);
        this.renderedElement.addEventListener("focus",this.inputFocusHandler);
        return rval;
    }

    set({value=undefined,min=undefined,max=undefined}) {
        let success = false;
        if(value != undefined) if(this.value.set(value)) success = true;
        if(min != undefined) if(this.min.set(min)) success = true;
        if(max != undefined) if(this.max.set(max)) success = true;
        if(success) {
            this.setDirty();
        }
        this.evaluate();
    }

    modify({value=undefined,min=undefined,max=undefined}) {
        /** @param {ExprValue} accessor */
        const getDepMods = (accessor,newVal) => {
            const dependencyMods = [];
            this.oldPaths = new Map(accessor.precedentPaths);
            //Update Path
            accessor.modify(newVal,this);
            accessor.precedentPaths.forEach((path, key) => {
                if (this.oldPaths.has(key)) {
                    this.oldPaths.delete(key)
                } else {
                    dependencyMods.push({type:"add precedent",path:path,amount:1})
                }
            });
            this.oldPaths.forEach((path,key) => {
                dependencyMods.push({type:"remove precedent",path:path,amount:1})
            })
            return dependencyMods;
        }

        if(value != undefined && value !== this.value.value) {
            this.dependencyModifications.push(...getDepMods(this.value,value));
        }
        if(min != undefined && min !== this.min.value) { 
            this.dependencyModifications.push(...getDepMods(this.min,min)); 
        }
        if(max != undefined && max !== this.max.value) { 
            this.dependencyModifications.push(...getDepMods(this.max,max)); 
        }

        this.evaluateDependencies();
        this.setDirty();
        this.evaluate();
    }

    evaluate() {
        if(this.dirty) {
            try {

                const root = this.findRoot();

                // Evaluate this node
                // max
                let result = this.max.evaluate(root);
                this.accessors.max = 
                    (Number.isNaN() || result == null)
                    ? null 
                    : result;

                // min
                result = this.min.evaluate(root);
                this.accessors.min = 
                    (Number.isNaN(result) || result == null)
                    ? null 
                    : result;

                this.accessors.base = this.value.evaluate(root);

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
                                    if(accessorMods?.replace == undefined)
                                        accessorMods.replace = {__highest: node.tier}
                                    accessorMods.replace[node.tier] = node.accessors.value;
                                    if(node.tier > accessorMods.replace.__highest || accessorMods.replace.__highest === "default") {
                                        accessorMods.replace.__highest = node.tier; // highest tier takes priority. "default" is lowest tier
                                    }
                                    break;
                                case "multiply":
                                    if(accessorMods.replace != undefined)
                                        break;
                                    if(accessorMods?.multiply == undefined)
                                        accessorMods.multiply = {}
                                    if(accessorMods.multiply?.[node.tier] == undefined)
                                        accessorMods.multiply[node.tier] = node.accessors.value

                                    accessorMods.multiply[node.tier] += node.accessors.value; // all multipliers of same tier add
                                    break;
                                case "add":
                                    if(accessorMods.replace != undefined)
                                        break;
                                    if(accessorMods?.add == undefined)
                                        accessorMods.add = {}
                                    if(accessorMods.add?.[node.tier] == undefined)
                                        accessorMods.add[node.tier] = node.accessors.value;
                                    
                                    if(node.tier === "default") {               // default tier simply adds addition modifiers together
                                        accessorMods.add[node.tier] += node.accessors.value;
                                    } else {                                    // specified tier sets strongest value
                                        if(Math.abs(node.accessors.value) > accessorMods.add[node.tier]) {
                                            accessorMods.add[node.tier] = node.accessors.value;
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
                //this.accessors.value = this.accessors.base;

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
                        this.accessors.value = this.accessors.base;
                    }
                }

                // Clamp all values after the dust settles
                if (this.accessors.min != null) {
                    this.accessors.base = Math.max(
                        this.accessors.base,
                        this.accessors.min
                    )

                    this.accessors.value = Math.max(
                        this.accessors.value,
                        this.accessors.min
                    )
                    
                }

                if (this.accessors.max != null) {
                    this.accessors.base = Math.min(
                        this.accessors.base,
                        this.accessors.max
                    )

                    this.accessors.value = Math.min(
                        this.accessors.value,
                        this.accessors.max
                    )
                }

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
        this.raw.value = this.value.getSaveData()
        this.raw.min = this.min.getSaveData()
        this.raw.max = this.max.getSaveData()
        this.raw.listeners = this.listeners;

        return super.getSaveData()
    }

    destroy () {
        super.destroy();
    }
}

class ModifierNode extends BaseNode {
    /**
     * @param {boolean} virtual 
     * @param {string} path 
     * @param {{
     *  target:string,
     *  operation:("add"|"multiply"|"replace"),
     *  value:(number|"string starting with '='"|boolean),
     *  tier: number
     * }} dataObj
     */
    constructor(virtual, parent, dataObj) {
        const {target,operation,value,condition,tier=0} = dataObj;
        super(virtual, parent, {target,operation,value,condition,tier});
        //Update Path
        if(target != undefined)
            this.target = new Path(target, this);
        else
            this.target = null;
        this.dependencyModifications.push({type:"add dependent",path:this.target,amount:1});

        this.operation = operation;
        this.tier = "default";
        if (typeof(tier) === "string") {
            this.tier = sanatizeKey(tier);
        } else if (typeof(tier) === "number") {
            this.tier = tier;
        }
        //Update Path here too
        this.value = new ExprValue(value, this);
        this.value.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        })

        this.condition = new ExprValue(condition ?? true, this);
        this.condition.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        })

        this.accessors = {
            value: value,
            condition: condition ?? true
        }

    }

    evaluate() {
        if (this.dirty) {
            const root = this.findRoot();
            this.accessors.value = this.value.evaluate(root);
            this.accessors.condition = this.condition.evaluate(root);
        }
        super.evaluate();
    }

    set({value = undefined}) {
        let success = false;
        if(value != undefined && this.value.set(value)) success = true;
        if(success) this.setDirty();
        this.evaluate();
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