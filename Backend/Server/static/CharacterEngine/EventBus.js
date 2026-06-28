import {Path} from "./Path.js";
import { sanatizeKey } from "./helpers.js";

const sliceRegEx = /^(-?\d+)?:(-?\d+)?|(-?\d+)/;

/**
 * For all logic in this function note that:
 * - `arrlen == null` is treated as infinite array length. 
 *    Negative indicies count backwards from infinity.
 * - When `arrlen != null`, indicies are clamped to 0 and up;
 * @param {string} pattern 
 * @param {string|number} key
 * @param {number} arrlen 
 * @returns 
 */
function matchIdxPattern(pattern, key, arrlen = null) {
    const pm = pattern.match(sliceRegEx);
    if(pm == null) return false;
    if(arrlen == null) arrlen = NaN;

    // comparison operations that count negatives as infinities
    const ge = (x,y) => ((x < 0 !== y < 0) ? x < 0 : x >= y); // >=
    const gt = (x,y) => ((x < 0 !== y < 0) ? x < 0 : x > y);  // >

    const idxAdjust = (arrlen == null || arrlen < 0) ? 0 : arrlen;
    let pmin = parseInt(pm[1]);
    let pmax = parseInt(pm[2]);
    let pidx = parseInt(pm[3]);
    if(pmin < 0) pmin += idxAdjust;
    if(pmax < 0) pmax += idxAdjust;
    if(pidx < 0) pidx += idxAdjust;
    
    if(!isNaN(arrlen)){
        if(!isNaN(pmin) && pmin < 0) pmin = 0;
        if(!isNaN(pmax) && pmax < 0)pmax = 0;
    }
    if(!isNaN(pmin) && !isNaN(pmax) && ge(pmax,pmin))
        return false;

    let kidx = NaN;
    let kmin = NaN;
    let kmax = NaN;
    
    if(typeof(key) === "number") {
        kidx = key + (key < 0) * idxAdjust;
    } else if(typeof(key) === "string") {
        const km = key.match(sliceRegEx);
        if(km == null) return false;
        kmin = parseInt(km[1]);
        kmax = parseInt(km[2]);
        kidx = parseInt(km[3]);
        if(kmin < 0) kmin += idxAdjust;
        if(kmax < 0) kmax += idxAdjust;
        if(kidx < 0) kidx += idxAdjust;

        if(!isNaN(arrlen)){
            if(!isNaN(kmin) && kmin < 0) kmin = 0;
            if(!isNaN(kmax) && kmax < 0) kmax = 0;
        }
        if(!isNaN(kmin) && !isNaN(kmax) && ge(kmax,kmin))
            return false;
    }

    if(!isNaN(pidx)) {
        if (!isNaN(kidx)) {
            return pidx === kidx;
        } else {
            return (isNaN(kmin) || ge(pidx,kmin)) && (isNaN(kmax) || gt(kmax,pidx));
        }
    } else {
        if(!isNaN(kidx)) {
            return (isNaN(pmin) || ge(kidx,pmin)) && (isNaN(pmax) || gt(pmax,kidx));
        } else {
            const ltMax = (isNaN(pmax) || isNaN(kmin) || gt(pmax,kmin));
            const gtMin = (isNaN(pmin) || isNaN(kmax) || gt(kmax,pmin));
            return gtMin && ltMax;
        }
    }

    return false;
}

class TrieNode {

    static WildcardSym = Symbol("wildcard");

    constructor () {
        this[Symbol.for("eventData")] = new Map();
        this[Symbol.for("eventListeners")] = new Map();
    }

    destroy() {
        for(const [key,value] of Object.entries(node)) {
            value.destroy();
            this[Symbol.for("parent")] = null;
            this[Symbol.for("eventListeners")] = null;
            delete this[key];
        }
    }

    /**
     * @param {string|number} key 
     * @returns {TrieNode}
     */
    addKey(key) {
        const newKey = sanatizeKey(key);
        if(newKey in this) return this[newKey];

        this[newKey] = new TrieNode();
        this[newKey][Symbol.for("parent")] = this;
        return this[newKey]
    }

    /**
     * 
     * @param {string|number} key 
     * @returns {TrieNode[]}
     */
    getKey(key) {
        const matches = [];
        if(key == undefined) return matches;

        const sKey = sanatizeKey(key);
        if(sKey in this)
            matches.push(this[sKey]);

        if(TrieNode.WildcardSym in this)
            matches.push(this[TrieNode.WildcardSym]);
        return matches;
    }

    /**
     * 
     * @param {string|number} key 
     * @returns {TrieNode[]}
     */
    getKeyKeys(key) {
        const matches = [];
        if(key == undefined) return matches;

        const sKey = sanatizeKey(key);
        if(sKey in this)
            matches.push(sKey);

        if(TrieNode.WildcardSym in this)
            matches.push(TrieNode.WildcardSym);
        return matches;
    }

    /**
     * 
     * @param {string|number} idx
     * @param {number} arrlen
     * @returns {TrieNode[]}
     */
    getIdx(idx, arrlen = null) {
        const matches = [];
        for(const key of Object.keys(this)) {
            if(matchIdxPattern(key,idx,arrlen))
                matches.push(this[key]);
        }
        if(TrieNode.WildcardSym in this)
            matches.push(this[TrieNode.WildcardSym]);
        return matches;
    }

    /**
     * 
     * @param {string|number} idx
     * @param {number} arrlen
     * @returns {TrieNode[]}
     */
    getIdxKeys(idx, arrlen = null) {
        const matches = [];
        for(const key of Object.keys(this)) {
            if(matchIdxPattern(key,idx,arrlen))
                matches.push(key);
        }
        if(TrieNode.WildcardSym in this)
            matches.push(TrieNode.WildcardSym);
        return matches;
    }

    /**
     * 
     * @returns {TrieNode}
     */
    addWildcard() {
        return this.addKey(TrieNode.WildcardSym);
    }

    /**
     * 
     * @returns {TrieNode[]}
     */
    getWildcard() {
        const matches = [];
        for(const value of Object.values(this)) {
            matches.push(value);
        }
        if(TrieNode.WildcardSym in this)
            matches.push(this[TrieNode.WildcardSym]);
        return matches;
    }

    /**
     * 
     * @returns {TrieNode[]}
     */
    getWildcardKeys() {
        const matches = [];
        for(const key of Object.keys(this)) {
            matches.push(key);
        }
        if(TrieNode.WildcardSym in this)
            matches.push(TrieNode.WildcardSym);
        return matches;
    }

    /**
     * 
     * @param {number} min 
     * @param {number} max 
     * @returns {TrieNode}
     */
    addSlice(min = null,max = null) {
        return this.addKey(`${min ?? ''}:${max ?? ''}`);
    }

    /**
     * 
     * @param {number} min 
     * @param {number} max 
     * @param {number} arrlen 
     * @returns {TrieNode[]}
     */
    getSlice(min = null,max = null,arrlen = null) {
        const matches = [];
        const str = `${min ?? ''}:${max ?? ''}`;
        for(const key of Object.keys(this)) {
            if(matchIdxPattern(key,str,arrlen))
                matches.push(this[key]);
        }
        if(TrieNode.WildcardSym in this)
            matches.push(this[TrieNode.WildcardSym]);
        return matches;
    }

    /**
     * 
     * @param {number} min 
     * @param {number} max 
     * @param {number} arrlen 
     * @returns {TrieNode[]}
     */
    getSliceKeys(min = null,max = null,arrlen = null) {
        const matches = [];
        const str = `${min ?? ''}:${max ?? ''}`;
        for(const key of Object.keys(this)) {
            if(matchIdxPattern(key,str,arrlen))
                matches.push(key);
        }
        if(TrieNode.WildcardSym in this)
            matches.push(TrieNode.WildcardSym);
        return matches;
    }

    /**
     * 
     * @param {number|string} key 
     * @param {number} arrlen 
     * @returns {TrieNode[]}
     */
    getMatches(key, arrlen = 0) {
        const matches = [];
        if(key == undefined) return matches;

        const sKey = sanatizeKey(key);
        for(const _key of Object.keys(this)) {
            if(_key == sKey) {
                matches.push(this[_key]);
            } else if(matchIdxPattern(_key,sKey,arrlen)){
                matches.push(this[_key]);
            }
        }
        if(TrieNode.WildcardSym in this)
            matches.push(this[TrieNode.WildcardSym]);
        return matches;
    }

    /**
     * 
     * @param {string|number} key 
     * @param {number} arrlen 
     * @returns {TrieNode[]}
     */
    getMatchKeys(key, arrlen = 0) {
        const matches = [];
        if(key == undefined) return matches;

        const sKey = sanatizeKey(key);
        for(const _key of Object.keys(this)) {
            if(_key == sKey) {
                matches.push(_key);
            } else if(matchIdxPattern(_key,sKey,arrlen)){
                matches.push(_key);
            }
        }
        if(TrieNode.WildcardSym in this)
            matches.push(this[TrieNode.WildcardSym]);
        return matches;
    }

    /**
     * @param {"change"|"structure"} type 
     * @param {() => void} callback 
     */
    addListener(type,callback) {
        if(!this[Symbol.for("eventListeners")].has(type))
            this[Symbol.for("eventListeners")].set(type,[callback]);
        else
            this[Symbol.for("eventListeners")].get(type).push(callback);
        return this;
    }

    /**
     * @param {"change"|"structure"} type 
     * @param {() => void} callback 
     */
    removeListener(type,callback) {
        if(!this[Symbol.for("eventListeners")].has(type))
            return;

        const idx = this[Symbol.for("eventListeners")].get(type).indexOf(callback);
        if(idx > -1)
            return this[Symbol.for("eventListeners")].get(type).splice(idx,1)[0];
    }

    /**
     * 
     * @param {string} type 
     * @returns {(()=>void)[]}
     */
    getListeners(type) {
        if(!this[Symbol.for("eventListeners")].has(type))
            return [];
        return this[Symbol.for("eventListeners")].get(type);
    }

    /**
     * 
     * @param {string} tag 
     * @param {*} dataObj 
     */
    addData(tag,dataObj) {
        this[Symbol.for("eventData")].set(tag,dataObj);
    }

    /**
     * 
     * @param {string} tag 
     * @returns {*}
     */
    getData(tag) {
        return this[Symbol.for("eventData")].get(tag);
    }

    /**
     * 
     * @param {string} tag 
     * @param {*} dataObj 
     * @returns {boolean} true if data existed and was removed
     */
    removeData(tag,dataObj) {
        Map.prototype.delete
        return this[Symbol.for("eventData")].delete(tag);
    }
}

export class EventBus {

    static triePathWalkHandler = function ({obj, token}, options) {
        const type = options?.type;
        if(!(obj instanceof TrieNode))
            return {action:"skip"};
        const next = [];
        switch (token.type) {
            case "A_WILDCARD":
            case "O_WILDCARD":
                for(const key of obj.getWildcardKeys())
                    next.push({type:"O_KEY",value:key});
                break;

            case "O_KEY":
                for(const key of obj.getKeyKeys(token.value))
                    next.push({type:"O_KEY",value:key});
                break;

            case "A_LIST":
                for(const idx of token.value){
                    for(const key of obj.getIdxKeys(idx)) {
                        next.push({type:"O_KEY",value:key});
                    }
                }
                break;

            case "A_SLICE": 
                for(const key of obj.getSliceKeys(token.value.min,token.value.max)) {
                    next.push({type:"O_KEY",value:key});
                }
                break;

            case "END":
                for(const func of obj.getListeners(type)) {
                    next.push(func());
                }
                return {override_objs:next};
                break;
            case "T_ROOT":
            default:
                return {action:"continue"}
        }
        return {action:"continue",override_tokens:next};
    }

    static EventMetaSym = Symbol("eventMeta");

    constructor () {
        this.trie = new TrieNode();
    }

    /**
     * 
     * @param {string} type 
     * @param {Path} target
     * @param {() => void} callback
     */
    addListener(type,target,callback) {
        const path = Path.pathTo(target);
        path.origin = this.trie;
        path.resolve({
            flat:true,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode) {
                    let next = [];
                    switch(token.type) {
                        case "O_WILDCARD": 
                        case "A_WILDCARD":
                            obj.addWildcard();
                            break;
                        case "O_KEY":
                            obj.addKey(token.value);
                            break;
                        case "A_LIST":
                            for(const idx of token.value) {
                                obj.addKey(idx);
                            }
                            break;
                        case "A_SLICE":
                            let {min,max} = token.value;
                            obj.addSlice(min,max);
                            break;
                        case "N_ACCESSORS":
                            for(const acc in token.value) {
                                obj.addKey(acc);
                            }
                            break;
                        case "END": 
                            obj.addListener(type,callback);
                            return {override_objs:obj.getListeners()};
                    }
                }
                return EventBus.triePathWalkHandler(params);
            }
        }).map(x => x.result);
    }

    /**
     * 
     * @param {string} type 
     * @param {Object|Path} target
     */
    getListeners(type,target) {
        const path = Path.pathTo(target); // re-origin path to this trie
        path.origin = this.trie;
        return path.resolve({
            flat:true,
            forwardHandler: (params) => {
                if(params.token.type === "END")
                    return {override_objs:params.obj?.getListeners(type)};
                return EventBus.triePathWalkHandler(params);
            }
        }).map(x => x.result);
    }

    /**
     * 
     * @param {string} type 
     * @param {Path} target
     * @param {() => void} ogcallback original reference to callback registered
     */
    removeListener(type,target,ogcallback) {
        const _path = Path.pathTo(target); // re-origin path to this trie
        _path.origin = this.trie;
        return _path.resolve({
            flat:true,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(token.type === "END") {
                    return {override_objs:[obj.removeListener(type,ogcallback)]}
                }
                return EventBus.triePathWalkHandler(params);
            }
        }).map(x => x.result);
    }

    /**
     * 
     * @param {string} type 
     * @param {Object|Path} target 
     * @returns {any[]} Array of results of all callbacks called.
     */
    emit(type,target) {
        const path = Path.pathTo(target);
        if(path == undefined) return;
        
        const arraySizes = new Map();
        path.resolve({
            forwardHandler:(params) => {
                const {obj,token,context,accessor} = params;

                if(!(obj instanceof Object))
                    return {action:"skip"};

                if(token.type === "T_ROOT") {
                    return {action:"continue"};
                }

                let trieMatches = [];
                /** @type {TrieNode[]} */
                
                if(Path.isRoot(obj)) {
                    trieMatches = [this.trie];
                } else {
                    let trieCtx = context?.[EventBus.EventMetaSym];
                    if(!Array.isArray(trieCtx))
                        return {action:"continue"};

                    for(const trieNode of trieCtx) {
                        const arrlen = Array.isArray(context) ? context.length : null;
                        if(accessor != null)
                            trieMatches.push(...trieNode.getMatches(accessor,arrlen));
                    }
                }               

                if(token.type === "END"){
                    const results = [];
                    for(const trieNode of trieMatches) {
                        for(const listener of trieNode.getListeners(type))
                            results.push(listener());
                    }
                    return {override_objs:results};
                }

                obj[EventBus.EventMetaSym] = trieMatches;
                return {action:"continue"};

            },
            reverseHandler: (params) => {
                const {obj,token,context,accessor} = params;
                if(obj instanceof Object && EventBus.EventMetaSym in obj)
                    obj[EventBus.EventMetaSym] = null; //cleanup
            }
        });
    }

    destroy() {
        this.trie.destroy();
    }
}
