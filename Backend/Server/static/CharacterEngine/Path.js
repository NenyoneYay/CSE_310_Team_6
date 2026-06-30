import {BaseNode, Container} from "./Nodes.js"
import {sanatizeKey} from "./helpers.js"

var  T_ROOT          = 'T_ROOT';
var  T_BACK          = 'T_BACK';
var  T_DEEP_WILDCARD = 'T_DEEP_WILDCARD'
var  O_KEY           = 'O_KEY';
var  O_WILDCARD      = 'O_WILDCARD';
var  A_LIST          = 'A_LIST';
var  A_SLICE         = 'A_SLICE';
var  A_WILDCARD      = 'A_WILDCARD';
var  T_GROUP         = 'T_GROUP';
var  N_ACCESSORS     = 'N_ACCESSORS';


/* Helpful switch skeleton for comparing tokens

switch(token.type) {
    case 'T_ROOT'     :
        break;
    case 'T_BACK'     :
        break;
    case 'O_WILDCARD' :
        break;
    case 'O_KEY'      :
        break;
    case 'A_LIST'     :
        break;
    case 'A_SLICE'    :
        break;
    case 'A_WILDCARD' :
        break;
    case 'T_GROUP'    :
        break;
    case 'N_ACCESSORS':
        break;
    case 'END'        :
        break;
    default:

}

*/

export class PathToken {
    /**
     * @param {string} type The type of this token. Determines what to
     * do with value
     * @param {any} value Parsed value of token. Can be anything from obj 
     * references to strings and preocessed arrays
     * @param {string} containerType Expected container type based on next token
     */
    constructor (type,value,containerType = null) {
        this.type = type;
        this.value = value;
        this.containerType = containerType;
    }

    /**
     * @param {PathToken} containingToken 
     */
    setContainer(containingToken = null) {
        if(this == undefined) return;

        let containerType = null;
        switch(containingToken.type) {
            case T_DEEP_WILDCARD:
                containerType = "deep";
                break;
            case O_KEY:
            case O_WILDCARD:
                containerType = "object";
                break;
            case A_LIST:
            case A_SLICE:
            case A_WILDCARD:
                containerType = "array";
                break;
            case N_ACCESSORS:
                containerType = "node";
                break;
        }
        this.containerType = containerType;

        // handle recursive tokens
        switch(this.type) {
            case T_GROUP:
                for(const gtokens of /** @type {PathToken[][]} */(this.value)) {
                    gtokens.at(-1).setContainer(containingToken);
                }
                break;
        }
    }

    getString(isEnd = true, isConcat = false) {
        /** 
         * @param {string} pv 
         * @param {PathToken} cv
         * */
        let tokenStr = '';
        let postfix = '';

        if(isEnd && isConcat) {
            postfix = (this.type === N_ACCESSORS ? ';' : ',');
        } else if(!isEnd) {
            postfix = ['object','deep'].includes(this.containerType) ? '.' : '';
        }

        switch (this.type) {
            case T_ROOT:
                return '$';
                break;
            case T_BACK:
                postfix = '';
            case T_DEEP_WILDCARD:
                tokenStr = '**';
                break;
            case O_KEY:
                tokenStr = this.value;
                break;
            case O_WILDCARD:
                tokenStr = '*';
                break;
            case A_LIST:
                tokenStr = `[${this.value.join(',')}]`;
                break;
            case A_SLICE:
                tokenStr = `[${this.value.min === 0 ? '' : this.value.min}:${this.value.max ?? ''}]`;
                break;
            case A_WILDCARD:
                tokenStr = '[*]';
                break;
            case T_GROUP:
                tokenStr = `(${
                    /** @type {Token[][]} */(this.value).reduce(
                        (pv,cv,idx,arr) => {
                            return pv + cv.reduce( (_pv,_cv,_idx,_arr) => {
                                return _pv + _cv.getString(_idx >= _arr.length-1, idx < arr.length-1);
                            },'');
                        }
                    ,'')
                })`;
                break;
            case N_ACCESSORS:
                tokenStr = `#${this.value.join(',')}`;
                break;
            default:
                tokenStr = '';
        }
        
        return tokenStr + postfix;
    }
}



export class Path {
    /* Tokens Regex Group Explination:
     * Group 1: Path from root object. Path starts with '$'
     * Group 2: '.' or ',' for path separator logics
     * Group 3: '*' Object key wildcard. Expressed '.*'
     * Group 4: '**' Deep wildcard. Expressed '.**' 
     * - Returns all nodes and leaves under this in a flat array.
     * - May be used with '#' accessor sigils to get all [accessors] on nodes
     * Group 5: Key token. Expressed: Key1.Key2
     * - Each of these keys can have array accessors. These are singleton
     *   object paths.
     * Group 6: Array index list accessor. Expressed: [1,2,3] or [2]
     * - Can be negative numbers. Negatives are wrapped around to end of array.
     * - Comes after Key or Group tokens.
     * Group 7: Array index slice accessor. Expressed: [:5](beginning -> 5), [3:] (3 -> end), [:] (Everything)
     * - Can be negative numbers. Also wrapped to end of array.
     * - Comes after Key or Group tokens.
     * Group 8: '*' Wildcard array accessor. Expressed: [*]
     * - refers to entire array
     * - Comes after Key or Group tokens.
     * Group 9: '#' accessor sigils. Expressed: #accessor1,accessor2,...
     * - Access node accessors (i.e. value, min, or max)
     * Group 10: ';,' semicoln or comma to separate full path queries. 
     * - Commas cannot be used for this purpose after accessor sigils, 
     *   but semicolns can.
     * - Can be used in groups to specify multiple sub paths.
     * Group 11: '(' Start of Group token. 
     * Group 12: ')' End of Group token.
     * - Groups are expressed by: (Subpath 1;subpath 2,...)
     *   - Each subpath may be a full path to something from previous path 
     *     endpoint, each separated by either a comma or semicolon. Must all 
     *     start with same accessor type (i.e. all  start a key, array acceesor,
     *     or accessor sigil).  Expected to return  same container type 
     *     (i.e. object, arrray, node) as well.
     *   - Tokens are recursively parsed inside.
     */
    static tokensRegex = /(?<=^|[\(;,])\s*(\$)\s*|(?<=^|[\(;,\.])\s*(\.+)|(?:(?<=^|[\.;,\($])\s*(?:(\*)|(\*\*)|(\\?[\w~\*][\w: ~\-\*]*?|\\\*))\s*(?=$|[\.\[;#,\)]))|(?<!(?<!^|[\(;,\.])\.)\[\s*(?:(-?\d+(?:\s*,\s*-?\d+)*)|(-?\d*\s*:\s*-?\d*)|(\*))\s*\]\s*(?=$|[\.\[#,;\)])|(?<!(?<!^|[\(;,\.])\.)#(\w+(?:,\w+)*)\s*(?=$|[;\)])|(;|,)|\.|(\()|(\))/y;
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
     * @typedef ResolutionHandlerDecision
     * @property {"continue"|"collect"|"return"|"skip"|"skip_token|"stop"} action
     * @property {Iterable} override_objs
     * @property {Iterable<PathToken>} override_tokens
     */

    /**
     * @typedef {{action:"keep"}
     * |{action:"discard"}
     * |{action:"override",value:any}
     * |{action:"override_many",values:Iterable}} ResolutionResultDecision
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
     * @callback ResolutionForwardHandler
     * @param {{
     *  obj:(Object|Array), 
     *  token: PathToken, 
     *  isLeaf: boolean,
     *  accessor: Symbol|string|number,
     *  prevContext: {obj:(Object|Array),token:PathToken,isLeaf:boolean,accessor:Symbol|string|number}
     * }} handlerContext
     * @param {Object} options
     * @returns {ResolutionHandlerDecision} 
     */

    /**
     * @callback ResolutionReverseHandler
     * @param {{
     *  obj:(Object|Array), 
     *  token: PathToken, 
     *  isLeaf: boolean,
     *  accessor: Symbol|string|number,
     *  prevContext: {obj:(Object|Array),token:PathToken,isLeaf:boolean,accessor:Symbol|string|number}
     * }} handlerContext
     * 
     * @param {Object} options
     * @returns {void}
     */

    /**
     * @callback ResolutionResultHandler
     * @param {{
     *  result:any,
     *  collected: boolean,
     *  obj:(Object|Array), 
     *  token: PathToken, 
     *  isLeaf: boolean,
     *  accessor: Symbol|string|number,
     *  prevContext: {obj:(Object|Array),token:PathToken,isLeaf:boolean,accessor:Symbol|string|number}
     * }} handlerContext
     * 
     * @param {Object} options
     * @returns {ResolutionResultDecision}
     */

    static END_TOKEN = Object.freeze(new PathToken("END",null));

    /**
     * @param {Object|Path} obj 
     * @param {Object} from 
     * @returns {Path|undefined}
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

        let originobj = null;

        const recursor = (obj) => {
            if(obj == undefined) return undefined;

            if(from != null) {
                let idx = rootChain.indexOf(obj);
                if(idx >= 0) {
                    const isRoot = obj?.[Symbol.for("parent")] == undefined;
                    originobj = from;
                    const rval = isRoot ? [new PathToken(T_ROOT,"$")] : []
                    for(let i = idx;i > 0;i--) {
                        rval.push(new PathToken(T_BACK,"."));
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
                            parentPath.push(new PathToken(A_LIST,[idx]))
                        } else {
                            const key = Object.keys(parentObj).find((key) => parentObj[key] === obj);
                            if(key == undefined) return undefined;
                            parentPath.push(new PathToken(O_KEY,key));
                        }
                        return parentPath;
                    }
                } else {
                    // just return the full absolute path if all else fails.
                    originobj = obj;
                    return [new PathToken(T_ROOT,"$")]; 
                }
            }
            return undefined;
        }

        if(obj instanceof Path) {
            return new Path(obj,Path.pathTo(obj.origin,from));
        }
        return new Path(recursor(obj),originobj);
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

    static isRoot(obj) {
        return (obj instanceof Object && obj[Symbol.for("parent")] == undefined)
    }

    /**
     * @param {PathToken|PathToken[]|PathToken[][]} tokens 
     * @returns {PathToken|PathToken[]|PathToken[][]}
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
                let tokenCopy;
                if(Array.isArray(token)) {
                    tokenCopy = _copyTokens(token);
                    if(tokenCopy.length < 1) continue; // skip arrays of invalid tokens
                } else {
                    tokenCopy = _copyToken(token);
                }
                if(tokenCopy == undefined) continue; // skip invalid tokens
                tokenCopies.push(tokenCopy);
            }
            return tokenCopies;
        }

        const _copyToken = (token) => {
            if(!_isValidToken(token)) return undefined;

            let tokenCopy = undefined;
            switch (token.type) {
                case A_LIST:
                case N_ACCESSORS:
                if(Array.isArray(token.value))
                    tokenCopy = new PathToken(token.type,[...token.value]);
                break;
                case A_SLICE:
                    tokenCopy = new PathToken(token.type,{min: token.value.min, max: token.value.max})
                    break;
                case T_GROUP:
                    tokenCopy = new PathToken(token.type,_copyTokens(token.value));
                    break;
                case T_ROOT:
                case T_BACK:
                case O_KEY:
                case A_WILDCARD:
                default:
                    tokenCopy = new PathToken(token.type,token.value);
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
     * @param {string|Path|PathToken[]} path 
     * @param {Path} origin
     * @returns {PathToken[][]}
     * */
    static tokenize (path,origin=null) {
        if (path == undefined) path = "";

        if (origin instanceof Path) {
            /** @type {PathToken[][]}*/
            const allTokens = []
            for(const _tokens of origin.tokens) {
                // for each grouping of origin tokens, process new path
                allTokens.push(..._processPath(path,_tokens));
            }
            return allTokens;
        } else {
            return _processPath(path);
        }

        function _processPath(path, originTokens = []) {
            /** @type {PathToken[]} */
            let tokens = [...originTokens];
            /** @type {PathToken[][]} */
            let allTokens = [tokens];

            if (path instanceof Path || Array.isArray(path)) {
                
                /**
                 * @param {PathToken[]|PathToken[][]} pathTokens 
                 */
                const _processTokens = (pathTokens) => {
                    for(let idx = 0;idx < pathTokens.length;idx++) {
                        const token = pathTokens[idx];
                        if(Array.isArray(token)) {
                            _processTokens(token);
                            if(idx >= pathTokens.length - 1) continue;
                            tokens = []; // treat end of array as concatenate (;,)
                            allTokens.push(tokens);
                            tokens.push(...originTokens);
                            continue;
                        }
                        const tokenCopy = Path.copyTokens(token);
                        if(tokenCopy == undefined) continue; // skip invalid tokens
                        let prevToken = tokens.at(-1);
                        switch(token.type) {
                            case T_ROOT:
                                allTokens.pop();
                                tokens = [tokenCopy]; // replace any origin pathing with root
                                allTokens.push(tokens) // replace all origins with root token
                                break;
                            case T_BACK:
                                // pop tokens off the stack if able to shorten/standardize paths
                                if(tokens.length > 0 && !([T_BACK,T_ROOT,T_GROUP].includes(tokens.at(-1)?.type))) {
                                    tokens.pop();
                                    prevToken = tokens.at(-1);
                                } else {
                                    tokens.push(tokenCopy);
                                }
                                break;
                            default:
                                tokens.push(tokenCopy);
                                prevToken?.setContainer(tokenCopy);
                        }
                    }
                }

                if(path instanceof Path) {
                    _processTokens(path.tokens);
                } else {
                    _processTokens(path);
                }

                return allTokens;
            } else if (typeof(path) !== "string") {
                path = ""; // process as empty path if path is invalid;
            }

            /** @type {PathToken[][][]} */
            const contextStack = [];

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
                    prevToken = contextStack.at(-1).at(-1).at(-1);
                }


                if (m[1] !== undefined) {
                    tokens = [new PathToken(T_ROOT,'$')];
                    allTokens.pop();
                    allTokens.push(tokens) // replace all origins with root token
                }

                else if (m[2] !== undefined) {
                    for (let i=0;i<m[2].length;i++) {
                        if(tokens.length > 0 && !([T_BACK,T_ROOT,T_GROUP].includes(tokens.at(-1)?.type))) {
                            tokens.pop();
                            prevToken = tokens.at(-1);
                        } else {
                            tokens.push(new PathToken(T_BACK,'.'));
                        }
                    }
                }
                
                else if(m[3] !== undefined) {
                    tokens.push(new PathToken(O_WILDCARD,'*'));
                    prevToken?.setContainer(tokens.at(-1));
                }

                else if(m[4] !== undefined) {
                    tokens.push(new PathToken(T_DEEP_WILDCARD,'**'));
                    prevToken?.setContainer(tokens.at(-1));
                }

                else if(m[5] !== undefined) {
                    let key = m[5];
                    if(key === '\\*') key = '*'; // replace escaped \* with *
                    else if(key === '\\**') key = '**';
                    tokens.push(new PathToken(O_KEY,sanatizeKey(key)));
                    prevToken?.setContainer(tokens.at(-1));
                }

                else if(m[6] !== undefined) {
                    tokens.push(new PathToken(A_LIST,m[6].split(',').map(x => parseInt(x))));
                    prevToken?.setContainer(tokens.at(-1));
                }

                else if(m[7] !== undefined) {
                    let [pmin,pmax] = m[7].split(':');
                    if (pmin === '') pmin = 0;
                    else pmin = parseInt(pmin);
                    if (pmax === '') pmax = undefined;
                    else pmax = parseInt(pmax);

                    if(Number.isNaN(pmin) || Number.isNaN(pmax)) 
                        throw SyntaxError(`Token ${m[7]} at ${i}: Array slice indexes must be numbers.`);

                    tokens.push(new PathToken(A_SLICE,{min:pmin,max:pmax}));
                    prevToken?.setContainer(tokens.at(-1));
                }

                else if(m[8] !== undefined) {
                    tokens.push(new PathToken(A_WILDCARD,'*'));
                    prevToken?.setContainer(tokens.at(-1));
                }

                else if(m[9] !== undefined && m[9] !== '') {
                    tokens.push(new PathToken(N_ACCESSORS,m[9].split(',').map(x => sanatizeKey(x))));
                    prevToken?.setContainer(tokens.at(-1));
                }
                    
                else if (m[10] !== undefined) { //;, (conatenate)
                    tokens = [];
                    allTokens.push(tokens); // make new tokens grouping
                    if (contextStack.length < 1) {
                        tokens.push(...originTokens);
                    }
                }

                else if (m[11] !== undefined) { // (
                    contextStack.push(allTokens);// push token context into stack
                    tokens = []; // create new token context
                    allTokens = [tokens];
                }

                else if (m[12] !== undefined) { // )
                    if (contextStack.length <= 0) throw SyntaxError(`Token ${m[12]} at ${i}: Unbalanced Parentheses. Missing opening '('`);
                    const group_token = new PathToken(T_GROUP, allTokens); // store current token context into group token
                    allTokens = contextStack.pop(); // pop previous context off the stack to continue where we left off
                    tokens = allTokens.at(-1);
                    tokens.push(group_token);
                }
                
                i = Path.tokensRegex.lastIndex;
            }
            if(contextStack.length > 0) throw SyntaxError(`EOF: Unbalanced Parentheses. Missing closing ')'`);
            return allTokens;
        }
    }

    /** @type {ResolutionForwardHandler} */
    static buildHandler(context, options = {}) {
        const {obj, token} = context;

        if(obj == null) return {action:"continue"};
        // guard switch
        switch(token.type) {
            case A_LIST:
            case A_SLICE:
            case A_WILDCARD:
                if(!Array.isArray(obj)) {
                    console.error("Expected Array but found other type")
                    return {action:"skip"};
                }
            case O_KEY:
            case O_WILDCARD:
                if(!(obj instanceof Object)) {
                    console.error("Expected Object but found other type")
                    return {action:"skip"};
                }
        }

        const {factory:newFactory = null} = options;
        const objPath = Path.pathTo(obj);

        const buildNew = (parent,type) => {
            let newobj = null;
            switch(type) {
                case "object":
                    if(!(newobj instanceof Object))
                        newobj = {[Symbol.for("okeys")]: []};
                    break;
                case "array":
                    if(!(Array.isArray(newobj)))
                        newobj = [];
                    break;
                case "node":
                    newobj = newFactory ? newFactory(parent,type) : null;
                    if(newobj == null)
                        newobj = new BaseNode(false,parent,{value:0});
                    break;
                default:
                    newobj = newFactory ? newFactory(parent,type) : null; 
            }
            if(
                newobj instanceof Object 
                && newobj[Symbol.for("parent")] == null 
                && parent != null
            ) 
                newobj[Symbol.for("parent")] = parent;
            return newobj;
        }

        switch(token.type) {
            case T_DEEP_WILDCARD:
                if(token !== context.prevContext?.token)
                    console.warn("Cannot build new paths from deep wildcard '**'");
                break;
            case A_LIST:
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
                break;
            case A_SLICE:
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
                break;
            case O_WILDCARD:
            case A_WILDCARD:
                console.warn("'*' accessor will not create any new paths");
                break;
            case O_KEY:
                let nextobj = obj[token.value];
                if(nextobj == undefined) {
                    console.log(`Building ${objPath.str}.${token.value} as ${token.containerType ?? "default"}`);
                    nextobj = buildNew(obj,token.containerType)
                }
                obj[token.value] = nextobj;
                obj[Symbol.for("okeys")].push(token.value);
                break;
        }
        return {action:"continue"};
    }

    /** @type {ResolutionForwardHandler|ResolutionReverseHandler} */
    static repairHandler(context, options = {}) {
        const {obj,prevContext:prevCtx,accessor} = context;
        if(accessor === Symbol.for("parent")) return;

        if(obj instanceof Object 
            && obj[Symbol.for("parent")] == null
            && prevCtx?.obj != null
        ) {
            obj[Symbol.for("parent")] = prevCtx.obj;
            console.log(`Repaired ${accessor}'s parent`);
        }

        if(obj != null && prevCtx?.obj instanceof Object) {
            const pObj = prevCtx.obj;
            if(!Array.isArray(pObj)) {
                if(pObj?.[Symbol.for("okeys")] != null && Array.isArray(pObj[Symbol.for("okeys")])){
                    if(!(pObj[Symbol.for("okeys")].includes(accessor))) {
                        pObj[Symbol.for("okeys")].push(accessor);
                        console.log(`Repaired ${prevCtx?.accessor}'s okeys`);
                    }
                } else {
                    pObj[Symbol.for("okeys")] = [accessor];
                    console.log(`Repaired ${prevCtx?.accessor}'s okeys`);
                }
            }
        }
    }

    /** @type {ResolutionReverseHandler} */
    static deleteHandler(context, options = {}) {
        const {obj,prevContext,accessor} = context;
        if (obj instanceof Object) { // deletes items from both arrays and object keys
            for(const idx in obj) obj[idx] = null;
            if(Path.isRoot(obj)) return;
            for(const sym of Object.getOwnPropertySymbols(obj)) obj[sym] = null;
        }
    }

    /** @type {ResolutionForwardHandler|ResolutionReverseHandler} */
    static debugHandler({obj, token, isLeaf}, options = {}) {
        console.log(`${Path.pathTo(obj).str} => ${token?.type}:`,token?.value,`, ${isLeaf}`);
        return {action:"continue"};
    }

    /**
     * 
     * @param {string|Path|Array<PathToken>} path 
     * @param {Path|Object} origin
     */
    constructor(path = "", origin=null) {
        /** @type {string} */
        this.str = null;

        /** @type {Object} */
        this.origin = null;
        if(origin instanceof Path) {
            this.origin = origin.origin;
        } else if (origin instanceof Object) {
            this.origin = origin;
        }

        // tokenize the path syntax from path
        /** @type {PathToken[][]} */
        this.tokens = Path.tokenize(path, origin);
        this.str = this.buildString();

        Path.tokensRegex.lastIndex = 0;
    }

    /**
     * @returns {string} Returns string representation of this path including unresolved wildcards
     */
    buildString() {
        return this.tokens.reduce((pv,cv,idx,arr) => {
            return pv + cv.reduce( (_pv,_cv,_idx,_arr) => {
                return _pv + _cv.getString(_idx >= _arr.length-1, idx < arr.length-1);
            },'');
        },'');
    }

    /**
     * 
     */
    append(pathExt) {
        const newTokens = Path.tokenize(pathExt);
        for(const tokens of this.tokens) {
            for(const ntokens of newTokens) {
                if(tokens.length > 0 && ntokens.length > 0) {
                    for(const ntoken of ntokens) {
                        const prevToken = tokens.at(-1);
                        switch(ntoken.type) {
                            case T_ROOT:
                                throw SyntaxError(`Cannot append absolute path to an existing path. Use new Path() instead.`);
                                break;
                            case T_BACK:
                                // pop tokens off the stack if able to shorten/standardize paths
                                if(tokens.length > 0 && !([T_BACK,T_ROOT,T_GROUP].includes(prevToken?.type))) {
                                    tokens.pop();
                                } else {
                                    tokens.push(ntoken);
                                }
                                break;
                            default:
                                tokens.push(ntoken);
                                prevToken?.setContainer(ntoken);
                        }
                    }
                }
            }
        }
        this.str = this.buildString();
        return this;
    }

    concatenate(newPath) {
        const newTokens = Path.tokenize(newPath);
        this.tokens.push(...newTokens);
        this.str = this.buildString();
        return this;
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
            if (result?.__type === "pathResult" && result.context instanceof BaseNode) {
                return `${Path.pathTo(result.context,relativeTo ?? root).str}#${result.accessor}`;
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
     *  resultHandler:  ResolutionResultHandler,
     *  handlerOptions: Object,
     *  flat: boolean
     * }} options All options are optional
     * @returns {Array<PathResult|undefined|Array>|PathResult|undefined} Always returns an array if 'flat' option is true
     */
    resolve(options = {}) {
        const {
            root = null,
            forwardHandler = null, 
            reverseHandler = null,
            resultHandler = null,
            handlerOptions = {},
            flat = false,
            wrapResults = true,
        } = options;
        
        // Some high scope variables to preserve forward handler control 
        // across recursive function calls.
        let stopResolution = false;

        // super basic linked list state variables
        let llhead = null, lltail = null;
        const ctxStack = [];

        // called on every path leaf to append result to list
        function llpush (value) {
            if(flat && value == undefined) return;
            const newNode = {value:value,next:null,count:0}
            if(llhead == null) {
                llhead = newNode
                lltail = llhead;
            } else {
                lltail.next = newNode;
                lltail = newNode;
            }

            if(ctxStack.length > 0) 
                ctxStack.at(-1).count++;
            return newNode;
        }

        // pushes special "ctxOPEN" node to specify entry into a deeper 
        // result context depth. Does nothing in 'flat' mode.
        function llpushOpen(keepArr = false) {
            if(flat && ctxStack.length > 0) return;
            const newNode = llpush({[Symbol.for("ctxOPEN")]: keepArr || flat});
            ctxStack.push(newNode);
        }

        // pushes special "ctxCLOSE" node to specify exit from a deeper 
        // result context depth. Does nothing in 'flat' mode.
        function llpushClose(keepArr = false) {
            if(flat && ctxStack.length <= 1) return;
            // used to tell if resulting array can be discarded for 
            // single element lists.
            if(ctxStack.length > 0) {
                const openNode = ctxStack.at(-1);
                if(openNode.value?.[Symbol.for("ctxOPEN")] != undefined) 
                    openNode.value[Symbol.for("ctxOPEN")] = keepArr || flat;
                ctxStack.pop()
            }
        }

        // called to build final resolution output. Allocates Arrays of known
        // size after all recursion is finished.
        function llbuildArray() {
            const incCur = (cur) => {
                const prev = cur;
                cur = cur.next;
                //prev.next = null; // help gc collect garbage
                return cur;
            }

            let cur = llhead;
            //llhead = null;

            const builder = () => {
                if(cur == null) return undefined;
                let isCtxOpen = cur.value?.[Symbol.for("ctxOPEN")] != undefined;
                let rval = undefined;
                if(isCtxOpen) {
                    const keepArr = cur.value[Symbol.for("ctxOPEN")];
                    rval = new Array(cur.count);
                    cur = incCur(cur);
                    let idx = 0;
                    while(cur != null && idx < rval.length) {
                        isCtxOpen = cur.value?.[Symbol.for("ctxOPEN")] != undefined;
                        if(isCtxOpen) {
                            rval[idx++] = builder();
                        } else {
                            rval[idx++] = cur.value;
                            cur = incCur(cur);
                        }
                    }

                    if(rval.length === 1 && !keepArr && !flat) {
                        rval = rval[0];
                    } else if (rval.length <= 0 && !flat) {
                        rval = undefined;
                    }
                } else {
                    rval = cur.value;
                }
                return rval;
            }

            return builder();
        }

        // debug utility function
        function llprint() {
            if(llhead == null) console.log("<null>")
            let cur = llhead;
            while (cur != null) {
                console.log(cur);
                cur = cur.next;
            }
        }

        function buildResult(collected = false, result = null,finalContext = null) {
            let finalResult;

            if(wrapResults) 
                finalResult = {
                    __type:"pathResult",
                    result,
                    context: finalContext?.prevContext?.obj, 
                    accessor:finalContext?.accessor,
                    collected
                }
            else 
                finalResult = result;

            

            // run resultMapper and compare decision to keep, discard, override, or overrideMany result;
            // Push into LinkedList only happens here to provide chokepoint control over data that leaves.
            if(resultHandler != null) {

                if(finalContext != null && finalContext instanceof Object) {
                    finalContext.result = finalResult;
                    finalContext.collected = collected;
                } else {
                    finalContext = {
                        result:finalResult,
                        collected:collected
                    };
                }

                const decision = resultHandler(finalContext,handlerOptions);
                switch(decision?.action) {
                    case 'discard':
                        break;
                    case 'override':
                        if('value' in decision)
                            llpush(decision.value);
                        break;
                    case 'override_many':
                        if('values' in decision){
                            for(const value of decision.values) {
                                llpush(value);
                            }
                        }
                        break;
                    case 'keep':
                    default:
                        llpush(finalResult);
                }
            } else {
                llpush(finalResult);
            }
        }

        const recursor = (currentRoot,tokens = this.tokens, cursor=0, accessor = null, prevContext = {obj:null,token:null,isLeaf:false,accessor:null}) => {
            if(stopResolution) return;

            const handlerCtx = {
                ...prevContext, // propagate context variables between handler calls
                obj:currentRoot, 
                token:tokens[cursor] ?? Path.END_TOKEN, 
                isLeaf:cursor >= tokens.length - 1,
                accessor: accessor,
                prevContext: prevContext,
            }

            
            let returnEarly = false;
            let nextRoots = [currentRoot];
            let nextTokens = [tokens[cursor]];
            let skipToken = false; 
            try {
                
                if(forwardHandler) {
                    const decision = forwardHandler(handlerCtx,handlerOptions);
                    
                    // if override_objs is iterable, then override.
                    if(typeof(decision?.override_objs?.[Symbol.iterator]) === 'function') {
                        nextRoots = decision.override_objs;
                    } else if (Object.hasOwn(decision,"override_objs")) {
                        console.error("override_objs provided but isn't iterable. Ignoring.");
                        throw new EvalError("throw~~!~~")
                    }

                    if(decision?.override_tokens != undefined) {
                        nextTokens = decision.override_tokens;
                    }

                    switch (decision?.action) {
                        case "return":
                            returnEarly = true;
                            break;
                        case "collect":
                            buildResult(true,currentRoot,handlerCtx);
                            break;

                        case "skip_token":
                            skipToken = true;
                            break;
                        case "skip":
                        case "skip_branch":
                            return;
                        
                        case "stop":
                            stopResolution = true;
                            return;

                        case "continue":
                        default:
                            // do nothing, continue as normal
                    }
                }

            } catch (e) { 
                // call the reverse handler to clean up after any errors that 
                // occur inside the forward handler.
                if(reverseHandler) {
                    reverseHandler(handlerCtx,handlerOptions);
                }
                throw(e);
            }

            // end conditions
            if(cursor >= tokens.length || returnEarly) {
                if(reverseHandler) { // call reverse handler on end token
                    reverseHandler(handlerCtx,handlerOptions);
                }

                for(const rval of nextRoots) {
                    buildResult(returnEarly,rval,handlerCtx);
                }
                return;
            }

            const _resolveToken = (_currentRoot,token) => {
                // skip over containers and BaseNodes for tokens
                // that access a child element
                switch(token.type) {
                    case O_KEY:
                    case O_WILDCARD:
                    case A_LIST:
                    case A_SLICE:
                    case A_WILDCARD:
                        while (
                            _currentRoot != undefined && (
                                _currentRoot.__type === "container" 
                                || _currentRoot instanceof Container
                                || _currentRoot instanceof BaseNode
                            )
                        ) {
                            if(_currentRoot instanceof BaseNode) {
                                _currentRoot = _currentRoot.passThrough;
                            } else {
                                _currentRoot = _currentRoot.content;
                            }
                        }
                        break;
                    default:
                        break;
                }

                if(_currentRoot == null) {
                    return buildResult(false,undefined,handlerCtx);
                }

                switch(token.type) {
                    case T_ROOT:
                        const _prevRoot = _currentRoot;
                        if(token.value != null) {
                            const newRoot = Path.findRoot(_currentRoot)
                            if(newRoot != null) {
                                _currentRoot = newRoot;
                            }
                        }
                        recursor(_currentRoot,tokens,cursor+1,null,handlerCtx);
                        break;
                    case T_BACK:
                        let _parent = _currentRoot?.[Symbol.for("parent")];
                        while (
                            _parent?.__type === "container" 
                            || _parent instanceof Container
                            || _parent instanceof BaseNode
                        ) {
                            _parent = _parent?.[Symbol.for("parent")]
                        }
                        if(_parent != undefined) {
                            recursor(_parent,tokens,cursor+1,Symbol.for("parent"),handlerCtx);
                        } else {
                            recursor(_currentRoot,tokens,cursor+1,Symbol.for("parent"),handlerCtx);
                        }
                        break;
                    case O_KEY:
                        if(_currentRoot instanceof Object && !Array.isArray(_currentRoot)) {
                            if(token.value in Object.prototype) {
                                return buildResult(false,undefined,handlerCtx); // stop prototype pollution attacks
                            }
                            recursor(_currentRoot[token.value],tokens,cursor+1,token.value,handlerCtx);
                        }
                        break;
                    case O_WILDCARD:
                        if(_currentRoot instanceof Object && !Array.isArray(_currentRoot)) {
                            llpushOpen(true);
                            /** @type {Array<string>} */
                            const keys = Object.keys(_currentRoot).filter((val) => !val.startsWith("__"));
                            keys.forEach((key) => {
                                recursor(_currentRoot[key],tokens,cursor+1,key,handlerCtx);
                            });
                            llpushClose();
                        }
                        break;
                    case A_LIST:
                        if(Array.isArray(_currentRoot)) {
                            llpushOpen();
                            token.value.forEach(idx => {
                                recursor(_currentRoot.at(idx),tokens,cursor+1,idx,handlerCtx);
                            });
                            llpushClose();
                        }
                        break;
                    case A_SLICE:
                        if(Array.isArray(_currentRoot)) {
                            llpushOpen();
                            const bounds = token.value;
                            _currentRoot.slice(bounds.min,bounds.max).forEach((item,idx) => {
                                recursor(item,tokens,cursor+1,idx+(bounds.min ?? 0,handlerCtx));
                            });
                            llpushClose(true);
                        }
                        break;
                    case A_WILDCARD:
                        if(Array.isArray(_currentRoot)) {
                            llpushOpen(true);
                            _currentRoot.forEach((item,idx) => {
                                recursor(item,tokens,cursor+1,idx,handlerCtx);
                            })
                            llpushClose();
                        }
                        break;
                    case N_ACCESSORS:
                        if(_currentRoot instanceof BaseNode) {
                            llpushOpen();
                            token.value.forEach(_accessor => {
                                recursor(_currentRoot.accessors[_accessor],tokens,cursor+1,_accessor,handlerCtx);
                            });
                            llpushClose();
                        } else {
                            buildResult(false,undefined,handlerCtx);
                        }
                        break;
                    
                    case T_GROUP:
                        if (_currentRoot != null) {
                            const tokensRest = tokens.slice(cursor+1);
                            llpushOpen();

                            for(const _tokens of token.value) {
                                recursor(_currentRoot,[..._tokens,...tokensRest],0,accessor,handlerCtx);
                                if(stopResolution) break;
                            }
                            llpushClose();
                        }
                        break;
                    
                    case T_DEEP_WILDCARD:
                        if(prevContext?.token !== token)
                            llpushOpen();
                        if(Array.isArray(_currentRoot)) {
                            for(const [idx,item] of _currentRoot.entries()) {
                                recursor(item,tokens,cursor,idx,handlerCtx);
                            }
                        } else if (_currentRoot instanceof BaseNode || !(_currentRoot instanceof Object)) {
                            recursor(_currentRoot,tokens,cursor+1,accessor,prevContext);
                        } else{
                            for(const [key,value] of Object.entries(_currentRoot)) {
                                recursor(value,tokens,cursor,key,handlerCtx);
                            }
                        }
                        if(prevContext?.token?.type !== T_DEEP_WILDCARD)
                            llpushClose();
                        break;
                    default:
                        recursor(_currentRoot,tokens,cursor+1,accessor,handlerCtx); // skip token
                        break;  
                }
            }

            
            if(nextRoots.length > 1) llpushOpen();
            for(const nextRoot of nextRoots) {
                // One reverse handler call per token/level. Wrapped in try/finally
                // so that cleanup steps in reverse handlers do not get skipped
                // when errors are thrown.
                if(skipToken) {
                    try {
                        recursor(nextRoot,tokens,cursor+1,accessor,handlerCtx);
                    } finally {
                        if(reverseHandler) {
                            handlerCtx.obj = nextRoot;
                            reverseHandler({...handlerCtx,obj:nextRoot},handlerOptions);
                        }
                    }
                } else {
                    if (nextTokens.length > 1) llpushOpen();
                    for(const token of nextTokens) {
                        try {
                            _resolveToken(nextRoot,token);
                        } finally {
                            if(reverseHandler) {
                                handlerCtx.obj = nextRoot;
                                reverseHandler(handlerCtx,handlerOptions);
                            }
                        }
                    }
                    if (nextTokens.length > 1) llpushClose();
                }
                
            }
            if(nextRoots.length > 1) llpushClose();
        
        }

        llpushOpen(false);
        for(const _tokens of this.tokens) {
            recursor(this.origin ?? root,_tokens);
        }
        llpushClose();

        return llbuildArray();
    }
}