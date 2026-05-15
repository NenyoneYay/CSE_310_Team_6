/**
 * 
 * @param {InputEvent} e 
 * @returns 
 */

/** @type {(Character|null)} */
var loadedChar = null;

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
        // // here is some prototype data to get the logic down first
        // this.fileData = {
        //     "rules":{
        //         "Stats.*":[
        //             {
        //                 "mod":"floor(data('.score')/2) - 5",
        //                 "save":"data('.mod')"
        //             }
        //         ]
        //     },
        //     "data":{
        //         "HP#data":{
        //             "value":30,
        //             "max":110,
        //             "eventTriggers":[
        //                 {
        //                     "events":["Long Rest"],
        //                     "action":{
        //                         "set":{"target":"#value","value":"#max"}
        //                     }
        //                 }
        //             ]
        //         },
        //         "Stats":{
        //             "Strength":{
        //                 "score#data": {
        //                     "value":10,
        //                     "max":20
        //                 }
        //             }
        //         }
        //     },
        //     "manualEvents":[
        //         "Long Rest",
        //         "Short Rest",
        //         "Day Start",
        //         "Start Combat"
        //     ],
        //     "modifiers":{

        //     }
        // }

        // this.expectedRoot = {
        //     "HP":new DataNode("HP",{
        //         value:30,
        //         max:110
        //     }),
        //     "Stats":{
        //         "Strength":{
        //             "score": new DataNode(false,"Stats.Strength.score",{value:0, max:20}),
        //             "mod":   new DataNode(true ,"Stats.Strength.mod"  ,{value:"floor(data('.score')/2) - 5"}),
        //             "save":  new DataNode(true ,"Stats.Strength.save" ,{value:"data('.mod')"               })
        //         }
        //     }
        // };

    }

    parseFile(fileData){
        this.destroy();
        let jsonData = JSON.parse(fileData,function (key,value) {
            const sanatizedKey = sanatizeKey(key);
            const [baseKey,sigil] = sanatizedKey.split('#');
            let rval = value;
            if (sigil != undefined) {
                this[baseKey] = null;
            }
            if (sanatizedKey != key && rval != undefined) {
                this[sanatizedKey] = rval; // sanatize object prototype keys
                rval = undefined;
            }
            return rval;
        });
        let contextData = jsonData.data;
        /** @type {BaseNode[]} */
        let newNodes = [];
        const makeNode = (newNode) => { newNodes.push(newNode); return newNode; }
        const joinPath = (base,...ext) => {return base!=='' ? `${base}${ext.map(v => '.'+v).join('')}` : ext.join('.')}

        const contextRecursor = (dataTree, path) => {
            if (dataTree == null || dataTree instanceof BaseNode) {
                return;
            } else if (Array.isArray(dataTree)) {
                dataTree.forEach((item,idx) => contextRecursor(item,`${path}[${idx}]`))
            } else if (dataTree instanceof Object) {
                Object.keys(dataTree).forEach((key) => {
                    const [baseKey, sigil] = key.split('#');
                    let data = dataTree[key];
                    const newPath = joinPath(path,baseKey);
                    switch (sigil) {
                        case "data": // DataNode
                            if (Array.isArray(data)) {
                                dataTree[key] = dataTree[key].map((nodeData,idx) => {
                                    if (nodeData == null) return null;
                                    let raw = typeof(nodeData) === 'object' ? nodeData : {value: nodeData}
                                    return makeNode(new DataNode(false,contextData,`${newPath}.${idx}`,raw));
                                });
                            } else if (["string","number","boolean"].includes(typeof(data))) {
                                dataTree[key] = makeNode(new DataNode(false,contextData,newPath,{value: data}));
                            } else if (data != null) {
                                dataTree[key] = makeNode(new DataNode(false,contextData,newPath,data));
                            }
                            break;
                        case undefined:
                            // base datatypes turn into data nodes except for descriptions
                            if (typeof(data) === "string") {
                                if(data.length > 0 && data[0] === "=") {
                                    dataTree[key] = makeNode(new DataNode(false,contextData,newPath,{value: data}));
                                } else {
                                    dataTree[key] = makeNode(new BaseNode(false,contextData,newPath,data));
                                }
                            } else if (["number","boolean"].includes(typeof(data))){
                                dataTree[key] = makeNode(new DataNode(false,contextData,newPath,{value: data}));
                            }
                            break;
                        // other node types/sigils will be defined here
                        default:
                            console.log(`Unknown sigil ${sigil}`)
                    }
                    if(baseKey !== key) {
                        dataTree[baseKey] = dataTree[key];
                        delete dataTree[key];
                    }

                    contextRecursor(dataTree[baseKey],newPath);
                });
            }
        }
        contextRecursor(contextData,'');
        this.root = contextData;
        newNodes.forEach((newNode) => {
            // register dependencies??
            newNode.evaluateDependencies();
            newNode.evaluate();
        })
        return jsonData;
    }
    
    renderHTML() {
        // do the html rendering here
        const recursor = (treeRoot, level = 0) => {
            if (treeRoot == null) return null;
            if (treeRoot instanceof DataNode) {
                let newInput = document.createElement("input");
                newInput.type = "number";
                newInput.value = treeRoot.accessors.value;
                treeRoot.attachInput(newInput);
                return newInput;
            } else if (treeRoot instanceof BaseNode) {
                let newInput = document.createElement("input");
                newInput.type = "text";
                newInput.value = treeRoot.accessors.value;
                return newInput;
            }
            if (Array.isArray(treeRoot)) {
                let ul = document.createElement("ul");
                treeRoot.forEach((item) => {
                    let li = document.createElement("li");
                    li.appendChild(recursor(item, level+1)  ?? document.createElement("div"))
                    ul.appendChild(li);
                })
                return ul;
            } else if (treeRoot instanceof Object) {
                let div = document.createElement("div");
                Object.keys(treeRoot).forEach((key) => {
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
                    recursor(treeRoot[key], level+1);
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
                        recursor(treeRoot[key], level+1);
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
     * Group 7: "#" accessor sigils. Expressed: #accessor1,accessor2,... at the end of a query or on it's own
     * Group 8: ';' semicoln to separate full path queries
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


    /**
     * 
     * @param {string} path 
     * @param {Path} rootPath 
     */
    constructor(path, rootPath=null) {
        /** @type {string} */
        this.raw = path;

        // tokenize the path syntax from path
        this.absolutePath = '';
        this.tokens = this.tokenize(path, rootPath);

        Path.tokensRegex.lastIndex = 0;
    }

    /** 
     * @param {string} str 
     * @param {rootPath} Path
     * */

    tokenize (str,rootPath=null,tokensRegex = Path.tokensRegex) {
        if (str == undefined) return;

        /** @type {Object[]} */
        const contextStack = [];

        let tokens = [];
        if (rootPath != null && (str.length === 0 || ".#".includes(str[0]))) {
            tokens = new Array(...rootPath.tokens);
        }

        for(let i = 0;i < str.length;) {
            // If the whole thing is a group, move on before the Regex gets mad.
            if (i >= str.length)
                continue;

            Path.tokensRegex.lastIndex = i;
            const m = Path.tokensRegex.exec(str)
            if (!m) throw SyntaxError(`Unexpected character '${str[i]}' at ${i} in '${str}'`);
            // console.log(m); // Cool Debug thing

            if (m[1] !== undefined) {
                for (let i=0;i<m[1].length;i++) {
                    tokens.pop();
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
        
        const pathReducer = (pv,cv) => {
            let tokenStr = ''
            const startOfPath = pv === '' || (pv.length > 0 && ",(".includes(pv[pv.length-1]))
            switch (cv.type) {
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
        
        this.absolutePath = tokens.reduce(pathReducer,'');
        return tokens;
    }

    /**
     * @param {Object} data
     * @param {Boolean} resolveAccessors
     * @returns {(Object|BaseNode|undefined)}
     */
    resolve(data,resolveAccessors=true) {
        const recursor = (treeRoot,tokens = this.tokens, cursor=0) => {
            if(cursor >= tokens.length) return treeRoot;
            if(treeRoot == null) return undefined;

            switch(tokens[cursor].type) {
                case 'O_KEY':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(BaseNode.passThrough,tokens,cursor);
                    if (tokens[cursor].value === '*') {
                        return Object.values(treeRoot).map((child) => {
                            return recursor(child,tokens,cursor+1);
                        });
                    } else {
                        return recursor(treeRoot[tokens[cursor].value],tokens,cursor+1);
                    }
                    break;
                case 'T_GROUP':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(BaseNode.passThrough,tokens,cursor);
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
                        return recursor(BaseNode.passThrough,tokens,cursor);
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
                    return undefined;
                    break;
                case 'A_SLICE':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(BaseNode.passThrough,tokens,cursor);
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
                    return undefined;
                    break;
                case 'A_WILDCARD':
                    if(treeRoot instanceof BaseNode) 
                        return recursor(BaseNode.passThrough,tokens,cursor);
                    if(Array.isArray(treeRoot)) {
                        return treeRoot.map(item => {
                            return recursor(item,tokens,cursor+1);
                        })
                    }
                    return undefined;
                    break;
                case 'N_ACCESSORS':
                    if(treeRoot instanceof BaseNode) {
                        if(!resolveAccessors) 
                            return treeRoot;
                        if (tokens[cursor].value.length === 1) 
                            return treeRoot.accessors[tokens[cursor].value];
                        return this.tokens[cursor].value.map(accessor => {
                            return treeRoot.accessors[accessor];
                        });
                    }
                    return undefined;
                    break;
                default:
                    return recursor(treeRoot,tokens,cursor+1);
                    break;  
            }
        }

        const query_container = [];
        let query_start_idx = 0
        this.tokens.forEach((token,idx) => {
            if(token.type === 'CONCAT') {
                query_container.push(recursor(data,this.tokens,query_start_idx));
                query_start_idx = idx+1;
            }
        });
        query_container.push(recursor(data,this.tokens,query_start_idx));

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
     * @param {Path} rootPath 
     */
    constructor(value, rootPath=null) {
        /** @type {Map<String,Path>} */
        this.precedentPaths = new Map()

        this.isExpr = typeof(value) === "string"
        this.value = undefined;
        this.expr = undefined;
        if (value == null || ["boolean","number","string"].includes(typeof(value))) {
            this.value = value;
            this.expr = this.processExpr(value, rootPath);
        }
    }

    /**
     * 
     * @param {string} value 
     * @param {Path} rootPath 
     * @returns 
     */
    processExpr(value, rootPath) {
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
                let pathObj = new Path(token.value,rootPath);
                let existingPath = this.precedentPaths.get(pathObj.absolutePath)
                if (existingPath == undefined) {
                    this.precedentPaths.set(pathObj.absolutePath,pathObj);      // add path to dependencies
                    existingPath = pathObj;
                }
                token.value = existingPath;                                     // replace data() input with path object
                pathfound = false;
            }
            if (token.type == 'IVAR' && token.value == 'data') pathfound = true;
        }

        return expr
    }

    evaluate(contextData) {
        
        /** @param {Path} path */
        ExprValue.parser.functions.data = (path, fallback=NaN) => {
            const replaceVals = (val) => {
                if (typeof(val) === "boolean") {
                    return val;
                } else if (typeof(val) === "string") {
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
            let result = path.resolve(contextData);
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

    modify(newValue, rootPath) {
        const dependencyMods = [];
        this.oldPaths = new Map(this.precedentPaths);
        this.value = newValue;
        this.isExpr = typeof(newValue) == "string";
        this.expr = this.processExpr(newValue,rootPath);
        this.precedentPaths.forEach((path, key) => {
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

    set(newValue) {
        if(!this.isExpr && typeof(newValue) === 'number') {
            this.value = newValue;
            return true;
        }
        return false;
    }

    getSaveData() {
        return this.isExpr ? this.value: this.valueCache;
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

class BaseNode {
    /**
     * 
     * @param {boolean} virtual 
     * @param {*} context 
     * @param {string} path 
     * @param {*} value 
     */
    constructor(virtual,context,path,value) {
        this.context = context;
        this.path = new Path(path)
        this.raw = value
        this.accessors = {
            value: value
        };
        this.virtual = virtual;
        this.passThrough = undefined;

        // dependents and precedents are mapped directly to nodes after
        // the character data tree is constructed. Maps are used to 
        /** @type {Map<BaseNode,Number>} */
        this.dependents = new Map();
        /** @type {Map<BaseNode,Number>} */
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

        this.renderedElement = null;
        this.inputListenerHandler = (event) => {
            this.set({value:this.renderedElement?.value ?? this.accessors.value});
        }
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    attachInput (element) {
        this.renderedElement = element;
        element.addEventListener("change",this.inputListenerHandler);
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    detachInput () {
        this.renderedElement?.removeEventListener("change",this.inputListenerHandler)
        this.renderedElement = null;
    }

    set(value) {
        this.accessors.value = value;
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
            this.error = `Node Source: '${this.path.absolutePath}' is part of a dependency loop.`;
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
        if (this.renderedElement != null)
            this.renderedElement.value = this.accessors.value;
        
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
        this.dependencyModifications.forEach((mod) => {
            const resolvedPaths = mod.path.resolve(this.context) ?? null;
            const pathCrawler = (pathResult) => {
                if(pathResult == null) return;
                else if (pathResult instanceof BaseNode) {
                    switch (mod.type) {
                        case "add precedent":
                            this.registerPrecedent(pathResult,mod.amount);
                            break;
                        case "add dependent":
                            this.registerDependent(pathResult,mod.amount);
                            break;
                        case "remove precedent":
                            this.unregisterPrecedent(pathResult,mod.amount);
                            break;
                        case "remove dependent":
                            this.unregisterDependent(pathResult,mod.amount);
                            break;
                    }
                    return;
                } else if (Array.isArray(pathResult)) {
                    pathResult.forEach(item => pathCrawler(item));
                    return;
                } else if (pathResult instanceof Object) {
                    Object.values(pathResult).forEach((value) => pathCrawler(value));
                    return;
                }
                return;
            }
            pathCrawler(resolvedPaths);
        });

        // Once connections are made, clear out modifications list
        this.dependencyModifications = [];
    }

    registerPrecedent(node, amount = 1) {
        if (node instanceof BaseNode) {
            this.precedents.set(node,(this.precedents.get(node) ?? 0) + amount);
            node.dependents.set(this,(node.dependents.get(this) ?? 0) + amount);
        }
    }

    registerDependent(node, amount = 1) {
        if (node instanceof BaseNode) {
            this.dependents.set(node,(this.dependents.get(node) ?? 0) + amount);
            node.precedents.set(this,(node.precedents.get(this) ?? 0) + amount);
        }
    }

    unregisterDependencies() {
        for(let [node,amount] of this.precedents) {
            node.unregisterDependent(this,amount);
        }

        for(let [node,amount] of this.dependents) {
            node.unregisterPrecedent(this,amount);
        }
    }

    unregisterPrecedent(node, amount = 1){
        if (node instanceof BaseNode) {
            let nextVal = (node.dependents.get(this) ?? 0) - amount;
            if (nextVal > 0) node.dependents.set(this,nextVal);
            else node.dependents.delete(this);

            nextVal = (this.precedents.get(node) ?? 0) - amount;
            if (nextVal > 0) this.precedents.set(node,nextVal);
            else this.precedents.delete(node);
        }
    }

    unregisterDependent(node, amount) {
        if (node instanceof BaseNode) {
            let nextVal = (node.precedents.get(this) ?? 0) - amount;
            if (nextVal > 0) node.precedents.set(this,nextVal);
            else node.precedents.delete(this);

            nextVal = (this.dependents.get(node) ?? 0) - amount;
            if (nextVal > 0) this.dependents.set(node,nextVal);
            else this.dependents.delete(node);
        }
    }

    getSaveData() {
        if (this.virtual) return null;
        return this.raw;
    }

    destroy() {
        this.unregisterDependencies();
        delete this.context;
        delete this.raw;
        delete this.accessors;
    }
}

class DataNode extends BaseNode {
    /**
     * @param {boolean} virtual 
     * @param {*} context 
     * @param {string} path 
     * @param {{
     *     value:(string|number|boolean),
     *     max?:(string|number),
     *     min?:(string|number),
     *     listeners?:Array<Object>
     *   }?} dataObj
     */
    constructor(virtual, context, path, dataObj) {
        let {value,min=null,max=null,listeners=[]} = dataObj ?? {value:null};
        super(virtual, context, path,{value:value, min:min, max:max, listeners:listeners});

        this.value = new ExprValue(value,this.path);
        this.max = new ExprValue(max,this.path);
        this.min = new ExprValue(min,this.path);

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
            value: 0,
            max: undefined, 
            min: undefined
        }
    }


    set({value=undefined,min=undefined,max=undefined}) {
        let success = false;
        if(value != undefined) if(this.value.set(Number(value))) success = true;
        if(min != undefined) if(this.min.set(Number(min))) success = true;
        if(max != undefined) if(this.max.set(Number(max))) success = true;
        if(success) {
            this.setDirty();
            this.evaluate();
        } else {
            this.renderedElement.value = this.accessors.value;
        }
    }

    modify({value=undefined,min=undefined,max=undefined}) {
        let success = false;
        if(value != undefined) {
            this.dependencyModifications.push(...this.value.modify(value,this.path));
        }
        if(min != undefined) { 
            this.dependencyModifications.push(...this.min.modify(min,this.path)); 
        }
        if(max != undefined) { 
            this.dependencyModifications.push(...this.max.modify(max,this.path)); 
        }
        this.evaluateDependencies();
        this.setDirty();
        this.evaluate();
    }

    evaluate() {
        if(this.dirty) {
            try {
                // // Paranoia code. Removed for efficiency. 
                // // Just trust that dependent updates always work.
                // for (let node of this.dependencies) {
                //     if (node instanceof BaseNode) {
                //         node.evaluate();
                //     }
                // }

                // Evaluate this node
                // max
                let result = this.max.evaluate(this.context);
                this.accessors.max = 
                    (Number.isNaN() || result == null)
                    ? null 
                    : result;

                // min
                result = this.min.evaluate(this.context);
                this.accessors.min = 
                    (Number.isNaN(result) || result == null)
                    ? null 
                    : result;

                // base (clamp to min/max if applicable)
                this.accessors.base = this.value.evaluate(this.context);
                if (this.accessors.min != null) {
                    this.accessors.base = Math.max(
                        this.accessors.base,
                        this.accessors.min
                    )
                }
                if (this.accessors.max != null) {
                    this.accessors.base = Math.min(
                        this.accessors.base,
                        this.accessors.max
                    )
                }

                // apply modifiers
                this.accessors.value = this.accessors.base;

                // Clamp value after the dust settles
                if (this.accessors.min != null) {
                    this.accessors.value = Math.max(
                        this.accessors.value,
                        this.accessors.min
                    )
                }
                if (this.accessors.max != null) {
                    this.accessors.value = Math.min(
                        this.accessors.value,
                        this.accessors.max
                    )
                }

            } catch (e) {
                this.isErrorSrc = true;
                this.error = e.message;
                e.message = `Node Source: ${this.path.absolutePath} ${e.message}`
                throw e;
            }
        }
        return super.evaluate();
    }

    processRequirements() {
        if (typeof(this.value) == "string") {
            // parse for path references
        }
        if (typeof(this.min) == "string") {
            // parse for path references
        }
        if (typeof(this.max) == "string") {
            // parse for path references
        }
    }


    getSaveData() {
        this.raw.value = this.value.getSaveData()
        this.raw.min = this.min.getSaveData()
        this.raw.max = this.max.getSaveData()
        this.raw.listeners = this.listeners;

        return super.getSaveData()
    }

    destroy () {
        this.detachInput()
        super.destroy();
    }
}

class ModifierNode extends BaseNode {
    constructor(virtual, context, path, data) {
        super(virtual,context,path, data)
    }
}

class PlaceholderNode extends BaseNode{
    constructor(virtual, context, path, data) {
        super(virtual,context,path, data)
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
            "multiNode#data":[
                {"value":10},
                {"value":20},
                {"value":30},
                {"value":"=data('Equipment.items[1].name')=='Shield'"}
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