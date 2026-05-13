async function readSingleFile(e){
    let file = e.target.files[0];
    if (!file) {
        return;
    }
    let reader = new FileReader();
    reader.onload = function(e) {
        let contents = e.target.result;
        displayContents(contents);
    };
    reader.readAsText(file);
}

function displayContents(contents) {
  let element = document.getElementById('file-content');
  element.textContent = contents;
}

document.addEventListener('DOMContentLoaded',(e) => {
    document.getElementById('file-input')
        .addEventListener('change', readSingleFile, false);
});


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
        let jsonData = JSON.parse(fileData,function (key,value) {
            let sanatizedKey = sanatizeKey(key);
            if (sanatizedKey != key) {
                this[sanatizedKey] = value; // sanatize object prototype keys
                return undefined;
            }
            return value;
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
                dataTree.forEach((item,idx) => contextRecursor(item,`${path}.${idx}`))
            } else if (dataTree instanceof Object) {
                Object.keys(dataTree).forEach((key) => {
                    const [baseKey, sigil] = key.split('#');
                    let data = dataTree[key];
                    const newPath = joinPath(path,baseKey)
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
            newNode.registerDependencies();
            newNode.evaluate();
        })
        return jsonData;
    }
    
    renderHTML() {
        // do the html rendering here and return as string to be pushed to site.
        const recursor = (treeRoot) => {
            if (treeRoot == null) return null;
            if (treeRoot instanceof DataNode) {
                let newInput = document.createElement("input");
                newInput.type = "number";
                newInput.value = treeRoot.accessors.value;
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
                    li.appendChild(recursor(item)  ?? document.createElement("div"))
                    ul.appendChild(li);
                })
                return ul;
            } else if (treeRoot instanceof Object) {
                let div = document.createElement("div");
                Object.keys(treeRoot).forEach((key) => {
                    let detail = document.createElement("detail");
                    let summary = document.createElement("summary");
                    summary.innerHTML = (key.length > 0 && key[0] ==="~") ? key.slice(1) : key;;
                    detail.appendChild(summary);
                    detail.appendChild(recursor(treeRoot[key]) ?? document.createElement("div"));
                    div.appendChild(detail)
                });
                return div;
            }
            return null;
        }
        
        document.getElementById("html-content").innerHTML = "";
        document.getElementById("html-content").appendChild(recursor(this.root));

        // container = document.createElement("div")
        // container.appendChild(...)
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
        this.tokens = this.tokenize(path, rootPath);
        Path.tokensRegex.lastIndex = 0;

    }

    /** 
     * @param {string} str 
     * @param {rootPath} Path
     * */

    tokenize (str,rootPath=null,tokensRegex = Path.tokensRegex) {
        if (str == undefined) return;

        const parenStack = [];
        
        let tokens = (rootPath != null && (str.length === 0 || ".#".includes(str[0]))) ? new Array(...rootPath.tokens) : [];

        for(let i = 0;i < str.length;) {
            // If the whole thing is a group, move on before the Regex gets mad.
            if (i >= str.length)
                continue;

            Path.tokensRegex.lastIndex = i;
            const m = Path.tokensRegex.exec(str)
            if (!m) throw SyntaxError(`Unexpected character '${str[i]}' at ${i} in '${str}'`);
            // console.log(m); // Cool Debug thing

            if (m[1] !== undefined) {
                for (let i=0;i<m[1].length;i++) tokens.pop();
            }

            else if(m[2] !== undefined) tokens.push({type:'O_KEY',value:sanatizeKey(m[2])});

            else if(m[3] !== undefined) tokens.push({type:'A_LIST',value:m[3].split(',').map(x => parseInt(x))});

            else if(m[4] !== undefined) {
                let [pmin,pmax] = m[4].split(':');
                if (pmin === '') pmin = 0;
                else pmin = parseInt(pmin);
                if (pmax === '') pmax = undefined;
                else pmax = parseInt(pmax);

                if(Number.isNaN(pmin) || Number.isNaN(pmax)) 
                    throw SyntaxError(`Token ${m[4]} at ${i}: Array slice indexes must be numbers.`);

                tokens.push({type:'A_SLICE',value:{min:pmin,max:pmax}})
            }

            else if(m[5] !== undefined) tokens.push({type:'A_WILDCARD',value:'*'});

            else if(m[6] !== undefined && m[6] !== '') tokens.push({type:'N_ACCESSORS',value:m[6].split(',').map(x => sanatizeKey(x))});
                
            else if (m[7] !== undefined) {
                tokens.push({type:'CONCAT',value:';,'});
                if (rootPath != null && ".#".includes(str[i+1]) && parenStack.length < 1) {
                    tokens.push(...rootPath.tokens);
                }
            }

            else if (m[8] !== undefined) { // (
                parenStack.push(tokens);// push token context into stack
                tokens = []; // create new token context
            }

            else if (m[9] !== undefined) { // )
                if (parenStack.length <= 0) throw SyntaxError(`Token ${m[9]} at ${i}: Unbalanced Parentheses. Missing opening '('`);
                const group_token = {'type':'T_GROUP','value':tokens}; // store current token context into group token
                tokens = parenStack.pop(); // pop previous context off the stack to continue where we left off
                tokens.push(group_token);
            }
            
            i = Path.tokensRegex.lastIndex;
        }
        if(parenStack.length > 0) throw SyntaxError(`EOF: Unbalanced Parentheses. Missing closing ')'`);
        return tokens;
    }

    /**
     * @param {*} data 
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

    /**
     * 
     * @param {(string|number)} value 
     * @param {Path} rootPath 
     */
    constructor(value, rootPath=null) {
        this.parser = new exprEval.Parser({
            operators: {
                assignment: false
            }
        });
        this.parser.functions.roll = (number, sides, rules='') => {
            let rolls = []
            for (let i = 0;i < number;i++) {
                rolls.push(Math.floor(Math.random() * sides) + 1);
            }
            // apply rules

            // sum values
            return rolls.reduce((pv,cv) => pv+cv);
        }

        /** @type {Set<Path>} */
        this.precedentPaths = new Set()

        this.isExpr = typeof(value) == "string"
        this.value = value;
        this.expr = this.processExpr(value, rootPath);
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
        let expr = this.parser.parse(value);
        this.precedentPaths.clear()

        // preprocess the expression.
        // extract paths, replace paths with absolute path objects,
        // and add paths to dependencies list as they are found.
        let pathfound = false;
        for (let token of expr.tokens) {
            if (token.type == 'INUMBER' && pathfound) {
                let pathObj = new Path(token.value,rootPath)
                token.value = pathObj                                           // replace data() input with path object
                this.precedentPaths.add(pathObj);                              // add path to dependencies
                pathfound = false;
            }
            if (token.type == 'IVAR' && token.value == 'data') pathfound = true;
        }


        return expr
    }

    evaluate(contextData) {
        /** @param {Path} path */
        this.parser.functions.data = (path, fallback=NaN) => {
            let result = path.resolve(contextData);
            if (result instanceof BaseNode) {
                result = result.accessors.value;
            } else if (result instanceof ExprValue) {
                throw EvalError("This isn't supposed to happen!!")
            } else if (Array.isArray(result)) {
                const replaceVals = (val) => {
                    if (Array.isArray(val)) {
                        return val.map(replaceVals)
                    } else {
                        return val == null ? fallback : val;
                    }
                }
                result = result.map(replaceVals);
            } else if (result == null) {
                result = fallback;
            }
            return result;
        }

        if (this.isExpr)
            return this.expr.evaluate();
        return this.value;
    }

    modify(newValue, rootPath) {
        this.value = newValue;
        this.isExpr = typeof(newValue) == "string";
        this.expr = this.processExpr(newValue,rootPath);
        return true;
    }

    set(newValue) {
        if(this.isExpr) return false;
        this.value = newValue;
        return true;
    }

    getSaveData() {
        return this.isExpr ? this.value: this.valueCache;
    }
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

        // dependency lists are lists of path strings to other nodes
        /** @type {Set<BaseNode>} */
        this.dependents = new Set();
        /** @type {Set<BaseNode>} */
        this.precedents = new Set();

        /** @type {Set<Path>} */
        // this.dependentPaths = new Set();
        /** @type {Set<Path>} */
        this.precedentPaths = new Set();

        this.error = null;
        this.warning = null;
        this.isErrorSrc = false;

        // resolve dependency list by preparsing expressions
    }

    set(value) {
        this.accessors.value = value;
        for(let dependent of this.dependents) {
            dependent.evaluate();
        }
    }

    evaluate() {
        return this.accessors.value;
    }

    evaluateDependencies() {
        let hangingPrecedents = new Set(this.precedents);
        for (let path of this.precedentPaths) {
            let node = path.resolve(this.context,false);
            if (node instanceof BaseNode) {
                if (hangingPrecedents.has(node)) {
                    hangingPrecedents.delete(node)
                } else {
                    this.registerPrecedent(node)
                }
            }
        }
        hangingPrecedents.forEach((node) => this.unregisterPrecedent(node));
    }

    registerDependencies() {
        this.evaluateDependencies();
    }

    registerPrecedent(node) {
        if (node instanceof BaseNode) {
            this.precedents.add(node);
            node.dependents.add(this);
        }
    }

    registerDependent(node) {
        if (node instanceof BaseNode) {
            this.dependents.add(node);
            node.precedents.add(this);
        }
    }

    unregisterDependencies() {
        for(let node of this.precedents) {
            node.dependents.delete(this);
        }
        this.precedents.clear();
    }

    unregisterPrecedent(node){
        if (node instanceof BaseNode) {
            node.dependents.delete(this);
            this.precedents.delete(node);
        }
    }

    // unregisterDependent(node) {
    //     if (node instanceof BaseNode) {
    //         this.dependents.delete(node);
    //         node.dependencies.delete(this);
    //     }
    // }

    getSaveData() {
        if (this.virtual) return null;
        return this.raw;
    }
}

class DataNode extends BaseNode {
    /**
     * @param {string} path 
     * @param {(string|number|boolean)} value 
     * @param {(string|number|null)} max 
     * @param {(string|number|null)} min 
     * @param {Array} listeners 
     */
    constructor(virtual, context, path,{value,min=undefined,max=undefined,listeners=[]}) {
        super(virtual, context, path,{value:value, min:min, max:max, listeners:listeners});

        this.value = new ExprValue(value,this.path);
        this.max = new ExprValue(max,this.path);
        this.min = new ExprValue(min,this.path);

        this.value.precedentPaths.forEach(depPath => {
            this.precedentPaths.add(depPath)
        });
        this.max.precedentPaths.forEach(depPath => {
            this.precedentPaths.add(depPath)
        });
        this.min.precedentPaths.forEach(depPath => {
            this.precedentPaths.add(depPath)
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
        if(value) if(this.value.set(value)) success = true;
        if(min) if(this.min.set(min)) success = true;
        if(max) if(this.max.set(max)) success = true;
        if(success) {
            this.setDirty();
            this.evaluate();
        }
    }

    modify({value=undefined,min=undefined,max=undefined}) {
        let success = false;
        if(value) {
            // need to clean dependencies
            this.value.modify(value,this.path);

        }
        if(min) { 
            this.min.modify(min,this.path) 
        }
        if(max) { 
            this.max.modify(max,this.path) 
        }
        this.setDirty();
        this.evaluate();
    }

    // idea: allow dirty to be a loop counter to allow circular 
    // loops and recalculate up to x amount of times.
    setDirty() {
        if(!this.dirty){
            this.dirty = true;
            try {
                for (let node of this.dependents) {
                    if (node instanceof DataNode) {
                        node.setDirty()
                    }
                }
            } catch (e){
                this.error = e.message;
            }
        } else {
            this.warning = `Loop detected. Evaluation paused after ${this.loopcount} loops`;
        }
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
                    ? undefined 
                    : result;

                // min
                result = this.min.evaluate(this.context);
                this.accessors.min = 
                    (Number.isNaN(result) || result == null)
                    ? undefined 
                    : result;

                // base (clamp to min/max if applicable)
                this.accessors.base = this.value.evaluate(this.context);
                if (this.accessors.min != undefined) {
                    this.accessors.base = Math.max(
                        this.accessors.base,
                        this.accessors.min
                    )
                }
                if (this.accessors.max != undefined) {
                    this.accessors.base = Math.min(
                        this.accessors.base,
                        this.accessors.max
                    )
                }

                // apply modifiers
                this.accessors.value = this.accessors.base;

                // Clamp value after the dust settles
                if (this.accessors.min != undefined) {
                    this.accessors.value = Math.max(
                        this.accessors.value,
                        this.accessors.min
                    )
                }
                if (this.accessors.max != undefined) {
                    this.accessors.value = Math.min(
                        this.accessors.value,
                        this.accessors.max
                    )
                }

                for (let node of this.dependents) {
                    if (node instanceof DataNode) {
                        node.evaluate()
                    }
                }

            } catch (e) {
                this.isErrorSrc = true;
                this.error = e.message;
                throw e;
            } finally {
                this.dirty = false;
            }
        }
        return this.accessors.value;
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
}

class ModifierNode extends BaseNode {
    constructor(virtual, context, path, data) {
        super(virtual,context,path, data)
    }
}

class PlaceholderNode extends BaseNode{
    constructor(path,data) {
        super(path,data);
    }
}










// test functions

let testFileData = `{
    "data":{
        "HP#data":{"value":30,"max":110},
        "Ability Scores":{
            "Strength":{
                "score#data":{"value":10,"max":20},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Dexterity":{
                "score#data":{"value":8,"max":20},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Constitution":{
                "score#data":{"value":13,"max":20},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Wisdom":{
                "score#data":{"value":15,"max":20},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Intelligence":{
                "score#data":{"value":12,"max":20},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            },
            "Charisma":{
                "score#data":{"value":20,"max":20},
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
            }
                
        },
        "Some Data":{
            "mutliNode#data":[
                {"value":10},
                {"value":20},
                {"value":30},
                {"value":"=data('Equipment.items.1.name')=='Shield'"}
            ],
            "sideNode":"=data('multiNode.1')"
        },
        "Equipment":{
            "capacity":"=data('Stats.Strength.score') * 15",
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