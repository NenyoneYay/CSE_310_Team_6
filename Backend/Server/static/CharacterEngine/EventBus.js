import {Path, PathToken} from "./Path.js";
import { sanatizeKey } from "./helpers.js";


export class Listener {
    /**
     * 
     * @param {() => void} callback 
     * @param {Object} applier To be used as `this` object when callback is called
     * @param {any[]} args Arguments in ordered array to be passed to callback
     */
    constructor (callback,{thisArg = undefined,args = undefined} = {}) {
        this.callback = callback;
        this.thisArg = thisArg;
        this.args = args;
        this.locked = false;
    }

    trigger() {
        if(!this.locked) {
            console.log(`Listener triggered!`);
            return this.callback.apply(this.thisArg,this.args);
        }
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

class TrieRegistration {
    constructor (trieNode, type, channel, payload) {
        this.trieNodes = trieNode;
        this.type = type;
        this.channel = channel;
        this.payload = payload;
    }

    destroy() {
        for(const trieNode of this.trieNodes)
            this.trieNode.unregister(this);
        this.payload = null;
        this.trieNode = null;
    }

    unregister() {
        this.destroy();
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

const regTypePropMap = new Map([["listener","listeners"],["data","data"]])

class TrieNode {

    static WildcardSym = Symbol("wildcard");
    static RegistrationsSym = Symbol("registrations")

    constructor () {
        this[TrieNode.RegistrationsSym] = {
            listeners: new Map(),
            data: new Map()
        }
    }

    destroy() {
        for(const [key,value] of Object.entries(node)) {
            value.destroy();
            this[Symbol.for("parent")] = null;
            for(const regMap of Object.values(this[TrieNode.RegistrationsSym])) {
                for(const regSet of /** @type {Map<string,Set<TrieRegistration>>} */(regMap).values()) {
                    for(const reg of regSet) {
                        reg.destroy();
                    }
                }
            }
            delete this[key];
        }
    }

    /**
     * 
     * @param {"listener"|"data"} type 
     * @param {string} key 
     * @param {TrieRegistration|any} payload 
     * @returns {TrieRegistration|undefined} 
     */
    register(type,key,payload) {
        let regMap = this[TrieNode.RegistrationsSym][regTypePropMap.get(type)];
        if(regMap != undefined) {
            let rval = new TrieRegistration(this,type,key,payload);
            if(!regMap.has(key)) regMap.set(key,new Set());
            regMap.get(key).add(rval);
            return rval;
        }
        return undefined;
    }

    /**
     * 
     * @param {TrieRegistration} registration 
     */
    unregister(registration) {
        if(!(registration instanceof TrieRegistration))
            return false;
        let regMap = this[TrieNode.RegistrationsSym][regTypePropMap.get(registration.type)];
        if(regMap != undefined) {
            /** @type {Map<string,Set<TrieRegistration>>}*/
            (regMap).get(registration.channel)?.delete(registration);
            return true;
        }
        return false;
    }

    /**
     * 
     * @param {string} type 
     * @param {string} key 
     * @returns {Set<TrieRegistration>|undefined}
     */
    getRegistrations(type,key) {
        let regMap = this[TrieNode.RegistrationsSym][regTypePropMap.get(type)];
        if(regMap != undefined) {
            return regMap.get(key);
        }
        return undefined;
    }

    /**
     * @param {"change"|"structure"} channel 
     * @param {Listener} listener 
     */
    registerListener(channel,listener) {
        return this.register("listener",channel,listener);
    }

    /**
     * 
     * @param {string} channel 
     * @returns {Listener[]}
     */
    getListeners(channel) {
        const regSet = this.getRegistrations("listener",channel);
        if(regSet == undefined) return [];
        return [...regSet.values().map(reg => reg.payload)];
    }

    /**
     * @param {string} channel 
     * @returns {any[]}
     */
    triggerListeners(channel) {
        const results = []
        for(const listener of this.getListeners(channel)) {
            results.push(listener.trigger());
        }
        return results;
    }

    /**
     * 
     * @param {string} channel 
     * @param {*} data 
     */
    registerData(channel,data) {
        return this.register("data",channel,data)
    }

    /**
     * 
     * @param {string} channel 
     * @returns {any[]} data stored across all registrations under `channel`
     */
    getData(channel) {
        const regSet = this.getRegistrations("data",channel);
        if(regSet == undefined) return [];
        return [...regSet.values().map(reg => reg.payload)];
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
}

export class EventBus {

    static triePathWalkHandler = function (context) {
        const {obj, token} = context;
        if(!(obj instanceof TrieNode))
            return {action:"skip"};
        const next = [];
        switch (token.type) {
            case "T_DEEP_WILDCARD":
                break;
            case "A_WILDCARD":
            case "O_WILDCARD":
                for(const key of obj.getWildcardKeys())
                    next.push(new PathToken("O_KEY",key));
                break;

            case "O_KEY":
                for(const key of obj.getKeyKeys(token.value))
                    next.push(new PathToken("O_KEY",key));
                break;

            case "A_LIST":
                for(const idx of token.value){
                    for(const key of obj.getIdxKeys(idx)) {
                        next.push(new PathToken("O_KEY",key));
                    }
                }
                break;

            case "A_SLICE": 
                for(const key of obj.getSliceKeys(token.value.min,token.value.max)) {
                    next.push(new PathToken("O_KEY",key));
                }
                break;
            case "N_ACCESSORS":
                for(const acc of token.value)
                    for(const key of obj.getKeyKeys(acc))
                        next.push(new PathToken("O_KEY",key));
                break;
            case "T_ROOT":
            default:
                return {action:"continue"}
        }
        return {action:"continue",override_tokens:next};
    }

    static triePathBuildHandler = function (context) {
        const {obj,token} = context;
        if(!(obj instanceof TrieNode))
            return {action:"continue"}
        const next = [];
        switch(token.type) {
            case "O_WILDCARD": 
            case "A_WILDCARD":
                next.push(new PathToken("O_KEY",obj.addWildcard().key));
                break;
            case "O_KEY":
                next.push(new PathToken("O_KEY",obj.addKey(token.value).key));
                break;
            case "A_LIST":
                for(const idx of token.value) {
                    next.push(new PathToken("O_KEY",obj.addKey(idx).key));
                }
                break;
            case "A_SLICE":
                let {min,max} = token.value;
                next.push(new PathToken("O_KEY",obj.addSlice(min,max).key));
                break;
            case "N_ACCESSORS":
                for(const acc of token.value) {
                    next.push(new PathToken("O_KEY",obj.addKey(acc).key));
                }
                break;
            default:
                return{action:"continue"};
        }
        return {action:"continue",override_tokens:next};
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
     * @param {"listener"|"data"} type 
     * @param {string} channel 
     * @param {Path|Object} target 
     * @param {TrieRegistration|*} payload 
     * @returns {TrieRegistration[]}
     */
    register(type,channel,target,payload) {
        if(typeof(payload) === "function")
            payload = new Listener(payload);
        if(type === "listener" && !(payload instanceof Listener))
            return undefined;
        const path = Path.pathTo(target);
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (context) => {
                const {obj,token} = context;
                if(obj instanceof TrieNode && token === Path.END_TOKEN) {
                    return {override_objs:[obj.register(type,channel,payload)]};
                }
                return EventBus.triePathBuildHandler(context);
            }
        });
    }

    /**
     * @param {TrieRegistration} registration 
     */
    unregister(registration) {
        registration.destroy();
    }

    /**
     * 
     * @param {"listener"|"data"} type 
     * @param {string} channel 
     * @param {Path|Object} target 
     * @returns {TrieRegistration[]}
     */
    getRegistrations(type,channel,target) {
        const path = Path.pathTo(target);
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (context) => {
                if(context.obj instanceof TrieNode && context.token === Path.END_TOKEN) {
                    return {override_objs:context.obj.getRegistrations(type,channel) ?? []};
                }
                return EventBus.triePathWalkHandler(context);
            }
        });
    }

    /**
     * 
     * @param {string} channel 
     * @param {Path} target
     * @param {Listener} listener
     * @returns {TrieRegistration[]}
     */
    registerListener(channel,target,listener) {
        if((typeof(listener) === "function"))
            listener = new Listener(listener);
        else if(!(listener instanceof Listener))
            return undefined;

        const path = Path.pathTo(target);
        path.origin = this.trie;
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode && token === Path.END_TOKEN) {
                    return {override_objs:[obj.registerListener(channel,listener)]};
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
                if(obj instanceof TrieNode && token === Path.END_TOKEN) {
                    return {override_objs:obj.getListeners(type) ?? []};
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
        
        console.log(`Emitting '${type}' event to '${path.str}'`);

        /** @type {Set<Listener>} */
        const listenerTriggers = new Set();

        path.resolve({
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

                if(token === Path.END_TOKEN){
                    // collect triggered listeners into a set for single
                    // defered execution.
                    for(const trieNode of trieMatches) {
                        for(const listener of trieNode.getListeners(type))
                            listenerTriggers.add(listener); 
                    }
                    // skip putting the TrieNode into the result collection.
                    return {action:"skip"};
                }

                // prune branches that don't have any matching events under them
                if(trieMatches.length <= 0)
                    return {action:"skip"}; 

                context[EventBus.EventMetaSym] = trieMatches; 
                return {action:"continue"};
            }
        });

        const rval = new Array(listenerTriggers.size)
        let ridx = 0;
        // defer triggers so the recursion stack doesn't overflow
        for(const listener of listenerTriggers)
            rval[ridx++] = listener.trigger();
        return rval;
    }

    /**
     * 
     * @param {string} type 
     * @param {Object|Path} target 
     * @param {any} data
     * @returns {TrieRegistration[]} Array of results of setting data.
     */
    registerData(tag,target,data) {
        const path = Path.pathTo(target); // re-origin path to this trie
        path.origin = this.trie;
        path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode && token === Path.END_TOKEN) {
                    return {override_objs:[obj.registerData(tag, data)]};
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
    getData(channel,target) {
        const path = Path.pathTo(target); 
        path.origin = this.trie; // re-origin path to this trie
        return path.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (context) => {
                const {obj, token} = context;
                if(obj instanceof TrieNode && token === Path.END_TOKEN)
                    return {override_objs:obj.getData(channel)};
                return EventBus.triePathWalkHandler(context);
            },
            resultHandler: (context) => {
                const {result} = context;
                if(result instanceof TrieNode || result == null) {
                    return {action:"discard"};
                }
                return {action:"keep"};
            }
        });
    }

    destroy() {
        this.trie.destroy();
    }
}
