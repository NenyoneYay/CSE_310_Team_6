import {Path} from "./Path.js";
import { sanatizeKey } from "./helpers.js";


export class Listener {
    /**
     * 
     * @param {() => void} callback 
     * @param {Object} applier To be used as `this` object when callback is called
     * @param {any[]} args Arguments in ordered array to be passed to callback
     */
    constructor (callback,{applier = undefined,args = undefined} = {}) {
        this.callback = callback;
        this.applier = applier;
        this.args = args;
        this.locked = false;
    }

    trigger() {
        if(!this.locked)
            return this.callback.apply(this.applier,this.args);
        return undefined;
    }

    /**
     * @param {boolean} state 
     * @returns {boolean} New locked state
     */
    lock(state = true) {
        return this.locked = state;
    }

    /**
     * @param {any[]} newArgs 
     */
    setArgs(newArgs = undefined) {
        this.args = newArgs;
    }
}

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
     * @param {string|number|symbol} key 
     * @returns {{key:string|number|symbol,value:TrieNode}}
     */
    addKey(key) {
        const newKey = sanatizeKey(key);
        if(newKey in this) return {key:newKey, value:this[newKey]};

        this[newKey] = new TrieNode();
        this[newKey][Symbol.for("parent")] = this;
        return {key:newKey,value:this[newKey]};
    }

    /**
     * 
     * @param {string|number|symbol} key 
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
     * @param {string|number|symbol} key 
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
     * @returns {{key:symbol,value:TrieNode}}
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
     * @returns {{key:string,value:TrieNode}}
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
    addListener(type,listener) {
        if(this[Symbol.for("eventListeners")].has(type))
            this[Symbol.for("eventListeners")].get(type).push(listener);
        else
            this[Symbol.for("eventListeners")].set(type,[listener]);
        return this;
    }

    /**
     * @param {"change"|"structure"} type 
     * @param {Listener | () => void} actor 
     */
    removeListener(type,actor) {
        if(!this[Symbol.for("eventListeners")].has(type))
            return;

        
        /** @type {() => boolean} */
        let finder;

        if(actor instanceof Listener) 
            /** @param {Listener} listener */
            finder = (listener) => listener === actor;
        else
            /** @param {Listener} listener */
            finder = (listener) => listener.callback === actor;

        const idx = /** @type {Listener[]}*/
            (this[Symbol.for("eventListeners")].get(type))
            .findIndex(finder);

        if(idx > -1)
            return this[Symbol.for("eventListeners")].get(type).splice(idx,1)[0];
    }

    /**
     * 
     * @param {string} type 
     * @returns {Listener[]}
     */
    getListeners(type) {
        if(!this[Symbol.for("eventListeners")].has(type))
            return [];
        return this[Symbol.for("eventListeners")].get(type);
    }

    /**
     * @param {string} type 
     * @returns {any[]}
     */
    triggerListeners(type) {
        const results = []
        for(const listener of this.getListeners(type)) {
            results.push(listener.trigger());
        }
        return results;
    }

    /**
     * 
     * @param {string} tag 
     * @param {*} dataObj 
     */
    setData(tag,dataObj) {
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
     * @returns {boolean} true if data existed and was removed
     */
    deleteData(tag) {
        return /** @type {Map} */(this[Symbol.for("eventData")]).delete(tag);
    }
}

export class EventBus {

    static triePathWalkHandler = function (params, options = {}) {
        const {obj, token} = params;
        const {type} = options;
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
            case "N_ACCESSORS":
                for(const acc of token.value)
                    for(const key of obj.getKeyKeys(acc))
                        next.push({type:"O_KEY",value:key});
                break;
            case "T_ROOT":
            default:
                return {action:"continue"}
        }
        return {action:"continue",override_tokens:next};
    }

    static triePathBuildHandler = function (params) {
        const {obj,token} = params;
        if(obj instanceof TrieNode) {
            const next = [];
            switch(token.type) {
                case "O_WILDCARD": 
                case "A_WILDCARD":
                    next.push({type:"O_KEY",value:obj.addWildcard().key});
                    break;
                case "O_KEY":
                    next.push({type:"O_KEY",value:obj.addKey(token.value).key});
                    break;
                case "A_LIST":
                    for(const idx of token.value) {
                        next.push({type:"O_KEY",value:obj.addKey(idx).key});
                    }
                    break;
                case "A_SLICE":
                    let {min,max} = token.value;
                    next.push({type:"O_KEY",value:obj.addSlice(min,max).key});
                    break;
                case "N_ACCESSORS":
                    for(const acc of token.value) {
                        next.push({type:"O_KEY",value:obj.addKey(acc).key});
                    }
                    break;
                default:
                    return{action:"continue"};
            }
            return {action:"continue",override_tokens:next};
        }
    }

    static EventMetaSym = Symbol("eventMeta");

    constructor () {
        this.trie = new TrieNode();
        this.signals = new Map();
    }

    /**
     * @param {string} name 
     * @param {Listener} listener 
     */
    addSignalListener(name,listener) {
        if(thie.signals.has(name)) {
            this.signals.get(name).push(listener);
        } else {
            this.signals.set(name,[listener]);
        }
    }

    /**
     * @param {string} name 
     * @param {Listener} listener 
     */
    removeSignalListener(name,listener) {
        if(thie.signals.has(name)) {
            /** @type {Listener[]} */
            const listeners = this.signals.get(name);
            const idx = listeners.indexOf(listener);
            return listeners.splice(idx,1)[0];
        }
    }

    getSignalListeners(name) {
        return this.signals.get(name);
    }

    emitSignal(name) {
        if(this.signals.has(name)) {
            for(const listener of this.signals.get(name))
                listener.trigger();
        }
    }

    /**
     * 
     * @param {string} type 
     * @param {Path} target
     * @param {Listener} listener
     */
    addListener(type,target,listener) {
        if((listener instanceof Function))
            listener = new Listener(listener);
        else if(!listener instanceof Listener)
            return undefined;

        const path = Path.pathTo(target);
        path.origin = this.trie;
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode && token.type === "END") {
                    obj.addListener(type,listener);
                    return {override_objs:obj.getListeners()};
                }
                return EventBus.triePathBuildHandler(params);
            }
        });
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
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode && token.type === "END")
                    return {override_objs:obj.getListeners(type)};
                return EventBus.triePathWalkHandler(params);
            }
        });
    }

    /**
     * 
     * @param {string} type 
     * @param {Path} target
     * @param {Listener} oglistener original reference to Listener registered
     */
    removeListener(type,target,oglistener) {
        const _path = Path.pathTo(target); // re-origin path to this trie
        _path.origin = this.trie;
        return _path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(token.type === "END") {
                    return {override_objs:[obj.removeListener(type,oglistener)]}
                }
                return EventBus.triePathWalkHandler(params);
            }
        });
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
        
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler:(context) => {
                const {obj,token,accessor,prevContext} = context;
                

                if(token.type === "T_ROOT") {
                    return {action:"continue"};
                }

                let trieMatches = [];
                
                if(obj === path.origin) {
                    trieMatches = [this.trie];
                } else {
                    /** @type {TrieNode[]} */
                    let trieCtx = prevContext?.[EventBus.EventMetaSym];
                    if(!Array.isArray(trieCtx))
                        return {action:"skip"};

                    for(const trieNode of trieCtx) {
                        if(accessor != null) {
                            if(Array.isArray(prevContext.obj)) {
                                trieMatches.push(...trieNode.getIdx(accessor, prevContext.obj.length));
                            } else {
                                trieMatches.push(...trieNode.getKey(accessor));
                            }
                        }
                    }
                } 

                if(token.type === "END"){
                    const results = [];
                    for(const trieNode of trieMatches) {
                        results.push(...trieNode.triggerListeners(type))
                    }
                    return {override_objs:results};
                }

                context[EventBus.EventMetaSym] = trieMatches; 
                return {action:"continue"};
            }
        });
    }

    /**
     * 
     * @param {string} type 
     * @param {Object|Path} target 
     * @param {any} dataObj
     * @returns {any[]} Array of results of setting data.
     */
    setData(tag,target,dataObj) {
        const path = Path.pathTo(target); // re-origin path to this trie
        path.origin = this.trie;
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode && token.type === "END") {
                    return {override_objs:obj.setData(tag,dataObj)};
                }
                return EventBus.triePathBuildHandler(params);
            }
        });
    }

    /**
     * 
     * @param {string} type 
     * @param {Object|Path} target 
     * @returns {any[]} Array of results of data retrieval.
     */
    getData(tag,target) {
        const path = Path.pathTo(target); 
        path.origin = this.trie; // re-origin path to this trie
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj, token} = params;
                if(obj instanceof TrieNode && token.type === "END")
                    return {override_objs:obj.getData(tag)};
                return EventBus.triePathWalkHandler(params);
            }
        });
    }

    deleteData(tag,target) {
        const path = Path.pathTo(target); 
        path.origin = this.trie; // re-origin path to this trie
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj, token} = params;
                if(obj instanceof TrieNode && token.type === "END")
                    return {override_objs:obj.deleteData(tag)};
                return EventBus.triePathWalkHandler(params);
            }
        });
    }

    destroy() {
        this.trie.destroy();
    }
}
