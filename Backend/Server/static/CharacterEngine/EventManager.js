import { BaseNode, DataNode, ModifierNode } from "./Nodes.js";
import {Path, PathToken} from "./Path.js";
import { sanatizeKey } from "./helpers.js";


/**
 * @typedef {"listener"|"data"} TrieRegistrationType
 */

const regTypePropMap = new Map([["listener","listeners"],["data","data"]])

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

export class TrieRegistration {

    /**
     * 
     * @param {TrieRegistrationType} type,
     * @param {string} channel,
     * @param {*} payload 
     */
    constructor (type,channel,payload) {
        Object.defineProperties(this, {
            channel:   { value: channel,   writable: false, configurable: false, enumerable: true },
            type:      { value: type,      writable: false, configurable: false, enumerable: true },
            trieNodes: { value: new Set(), writable: false, configurable: false, enumerable: true },
        });
        this.payload = payload;
    }

    destroy() {
        for(const trieNode of this.trieNodes) {
            trieNode.removeRegistration(this);
        }
        this.payload = null;
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

class TrieNode {

    /**
     * @typedef {{key:string|number|symbol,node:TrieNode}} TrieMatch
     */

    static AnchorSym = Symbol("anchor")
    static WildcardSym = Symbol("wildcard");
    static DeepWildcardSym = Symbol("deepWildcard");
    static RegistrationsSym = Symbol("registrations");

    static createRegistration(type,channel,payload) {
        return new TrieRegistration(type,channel,payload);
    }

    static createListenerRegistration(channel,payload) {
        return new TrieRegistration("listener",channel,payload);
    }

    static createDataRegistration(channel,payload) {
        return new TrieRegistration("data",channel,payload);
    }

    constructor (anchor = null) {
        if(anchor instanceof Object) {
            this[TrieNode.AnchorSym] = anchor;
        }
        this[TrieNode.RegistrationsSym] = {
            listeners: new Map(),
            data: new Map()
        }
        this[TrieNode.RegistrationsSym] = new Map();
    }

    getAnchor() {
        return this[TrieNode.AnchorSym];
    }

    destroy() {
        for(const [key,value] of Object.entries(this)) {
            value.destroy();
            delete this[key];
        }
        /** @type {Map<string,Map<string,Set<TrieRegistration>>>} */
        const registrations = this[TrieNode.RegistrationsSym];
        for(const regMap of registrations.values()) {
            for(const regSet of regMap.values()) {
                for(const reg of regSet) {
                    reg.destroy();
                }
            }
        }
        this[TrieNode.WildcardSym]?.destroy();
        if(this[TrieNode.DeepWildcardSym] instanceof TrieNode && this[TrieNode.DeepWildcardSym] != this)
            this[TrieNode.DeepWildcardSym].destroy();
        delete this[TrieNode.WildcardSym];
        delete this[TrieNode.DeepWildcardSym];
        this[TrieNode.AnchorSym] = null;
        this[Symbol.for("parent")] = null;
    }

    /**
     * 
     * @param {TrieRegistrationType} type 
     * @param {string} channel 
     * @returns {boolean}
     */
    hasRegistrations(type = null, channel = null) {
        /** @type {Map<string,Map<string,Set<TrieRegistration>>>} */
        const registrations = this[TrieNode.RegistrationsSym];

        const _checkMap = (regMap) => {
            if(regMap == undefined) return false;
            if(channel == null) {
                for(const regSet of regMap.values()) {
                    if(regSet.size > 0) return true;
                }
            } else {
                const regSet = regMap.get(channel);
                if(regSet != undefined && regSet.size > 0)
                    return true;
            }
            return false;
        }

        if(type == null) {
            for(const regMap of registrations.values()) {
                if(_checkMap(regMap)) return true;
            }
        } else {
            const regMap = registrations.get(type);
            if(_checkMap(regMap)) return true;
        }
        return false;
    }

    /**
     * 
     * @param {TrieRegistrationType} type 
     * @param {string} channel 
     * @param {boolean} create 
     * @returns {Set<TrieRegistration>|undefined}
     */
    getRegistrationSet(type,channel,create=false) {
        if(!this[TrieNode.RegistrationsSym].has(type)) {
            if(create) this[TrieNode.RegistrationsSym].set(type,new Map());
            else return undefined;
        }
        /** @type {Map<string,TrieRegistration>} */
        const regMap = this[TrieNode.RegistrationsSym].get(type);
        if(!regMap.has(channel)) { 
            if(create) regMap.set(channel,new Set());
            else return undefined;
        }
        return regMap.get(channel);
    }

    /**
     * 
     * @param {TrieRegistration} registration 
     */
    addRegistration(registration) {
        const regSet = this.getRegistrationSet(registration.type,registration.channel,true);
        if(regSet != undefined) {
            regSet.add(registration);
            registration.trieNodes.add(this);
        }
    }

    /**
     * 
     * @param {TrieRegistration} registration 
     */
    removeRegistration(registration) {
        let rval = false;
        const regSet = this.getRegistrationSet(registration.type,registration.channel);
        if(regSet != undefined) {
            rval = regSet.delete(registration);
            registration.trieNodes.delete(this);
        }
        return rval;
    }

    /**
     * @returns {TrieMatch[]}
     */
    matchWildcards() {
        const matches = [];
        if(TrieNode.WildcardSym in this)
            matches.push({key:TrieNode.WildcardSym, node:this[TrieNode.WildcardSym]});
        if(TrieNode.DeepWildcardSym in this)
            matches.push({key:TrieNode.DeepWildcardSym, node:this[TrieNode.DeepWildcardSym]});
        return matches;
    }

    /**
     * @param {string|number|symbol} key 
     * @returns {TrieMatch}
     */
    addKey(key) {
        const newKey = sanatizeKey(key);
        if(newKey in this) return {key:newKey, node:this[newKey]};

        this[newKey] = new TrieNode(this[TrieNode.AnchorSym]);
        this[newKey][Symbol.for("parent")] = this;
        return {key:newKey,node:this[newKey]};
    }

    /**
     * 
     * @param {string|number|symbol} key 
     * @returns {TrieMatch[]}
     */
    matchKey(key) {
        const matches = [];
        if(key == undefined) return matches;

        const sKey = sanatizeKey(key);
        if(sKey in this)
            matches.push({key:sKey,node:this[sKey]});

        matches.push(...this.matchWildcards());
        return matches;
    }

    /**
     * 
     * @param {number} idx 
     * @returns {TrieMatch}
     */
    addIdx(idx) {
        return this.addKey(idx);
    }

    /**
     * 
     * @param {number} idx
     * @param {number} arrlen
     * @returns {TrieMatch[]}
     */
    matchIdx(idx, arrlen = undefined) {
        const matches = [];
        for(const key of Object.keys(this)) {
            if(matchIdxPattern(key,idx,arrlen))
                matches.push({key:key,node:this[key]});
        }

        matches.push(...this.matchWildcards());
        return matches;
    }

    /**
     * @returns {TrieMatch}
     */
    addWildcard() {
        return this.addKey(TrieNode.WildcardSym);
    }

    matchWildcard() {
        const matches = [];
        for(const [key,node] of Object.entries(this)) {
            matches.push({key:key,node:node});
        }
        matches.push(...this.matchWildcards());
        return matches;
    }

    /**
     * @returns {TrieMatch}
     */
    addDeepWildcard() {
        const rval = this.addKey(TrieNode.DeepWildcardSym);
        this[TrieNode.DeepWildcardSym][TrieNode.DeepWildcardSym] = this[TrieNode.DeepWildcardSym];
        return rval;
    }

    /**
     * Handles it's own deep recursion. !! Don't let walkers continue with deep
     * wildcard handling !!
     * @returns {TrieMatch[]}
     */
    matchDeepWildcard() {
        const matches = [];
        for(const [key,node] of Object.entries(this)) {
            if(node.hasRegistrations()) matches.push({key:key,node:node});
            matches.push(...node.matchDeepWildcard());
        }
        const wildcardNode = this[TrieNode.WildcardSym]
        if(wildcardNode instanceof TrieNode) {
            if(wildcardNode.hasRegistrations())
                matches.push({key:TrieNode.WildcardSym, node: wildcardNode});
            matches.push(...wildcardNode.matchDeepWildcard());
        }
        const deepWildcardNode = this[TrieNode.DeepWildcardSym]
        if(deepWildcardNode instanceof trieNode && deepWildcardNode != this) {
            if(deepWildcardNode.hasRegistrations) 
                matches.push({key:TrieNode.DeepWildcardSym, node:deepWildcardNode});
            matches.push(...wildcardNode.matchDeepWildcard());
        }
        return matches;
    }

    /**
     * 
     * @param {number} min 
     * @param {number} max 
     * @returns {TrieMatch}
     */
    addSlice(min = null,max = null) {
        return this.addKey(`${min ?? ''}:${max ?? ''}`);
    }

    /**
     * 
     * @param {number} min 
     * @param {number} max 
     * @param {number} arrlen 
     * @returns {TrieMatch[]}
     */
    matchSlice(min = null,max = null,arrlen = null) {
        const matches = [];
        const str = `${min ?? ''}:${max ?? ''}`;
        for(const key of Object.keys(this)) {
            if(matchIdxPattern(key,str,arrlen))
                matches.push({key:key,node:this[key]});
        }
        matches.push(...this.matchWildcards());
        return matches;
    }

    /**
    * @param {TrieNode} this 
    * @param {Object} obj 
    * @param {PathToken} token 
    * @returns {TrieMatch[]}
    */
    matchToken(token, obj = null) {
        const matches = [];
        if(!(this instanceof TrieNode)) return matches;
        switch(token.type) {
            case "T_DEEP_WILDCARD":
                return this.matchDeepWildcard();
                break;
            case "O_WILDCARD": 
            case "A_WILDCARD":
                return this.matchWildcard();
                break;
            case "O_KEY":
                return this.matchKey(token.value);
                break;
            case "A_LIST":
                for(const idx of token.value) {
                    if(Array.isArray(obj)) {
                        matches.push(...this.matchIdx(idx,obj.length));
                    } else if (obj == null) {
                        matches.push(...this.matchIdx(idx));
                    }
                }
                return matches;
                break;
            case "A_SLICE":
                let {min,max} = token.value;
                if(Array.isArray(obj)) {
                    matches.push(...this.matchSlice(min,max,obj.length));
                } else if (obj == null) {
                    matches.push(...this.matchSlice(min,max));
                }
                return matches;
                break;
            case "N_ACCESSORS":
                for(const acc of token.value) {
                    matches.push(...this.matchKey(acc));
                }
                return matches;
                break;
            default:
                return matches;
        }
        return matches;
    }
}


export class EventManager {

    static EventManagerSym = Symbol("EventManager")
    static TrieDataSym = Symbol("TrieData")

    static triePathBuildHandler(context) {
        const {obj,token} = context;

        // Handle special movement tokens
        switch(token.type) {
            case 'T_ROOT'     :
                if(obj instanceof TrieNode)
                    return {action:"continue",override_objs:[obj.getAnchor()]}
                return {action:"continue"};
            case 'T_GROUP'    :
                return {action:"continue"};
            case 'T_BACK'     :
                if(obj instanceof TrieNode && obj[Symbol.for("parent")] == undefined)
                    return {action:"continue", override_objs:[obj.getAnchor()]};
                return {action:"continue"};
        }

        
        // on forward walk, ensure there is a trie to walk into
        let trieNode = undefined;
        if(obj instanceof TrieNode) {
            trieNode = obj;
        } else if (obj instanceof Object) {
            if(obj[EventManager.TrieDataSym] == undefined)
                obj[EventManager.TrieDataSym] = new TrieNode(obj);
            trieNode = obj[EventManager.TrieDataSym];
        } else {
            // This is a primative value and doesn't have any children.
            // It is probably the end of the path.
            return {action:"continue"};
        }

        if(trieNode instanceof TrieNode) {
            const next_tokens = [];
            switch(token.type) {
                case "T_DEEP_WILDCARD":
                    return {action:"skip_token",override_objs:[trieNode.addDeepWildcard().node]}
                    break;
                case "O_WILDCARD": 
                case "A_WILDCARD":
                    next_tokens.push(new PathToken("O_KEY",trieNode.addWildcard().key));
                    break;
                case "O_KEY":
                    next_tokens.push(new PathToken("O_KEY",trieNode.addKey(token.value).key));
                    break;
                case "A_LIST":
                    for(const idx of token.value) {
                        next_tokens.push(new PathToken("O_KEY",trieNode.addIdx(idx).key));
                    }
                    break;
                case "A_SLICE":
                    let {min,max} = token.value;
                    next_tokens.push(new PathToken("O_KEY",trieNode.addSlice(min,max).key));
                    break;
                case "N_ACCESSORS":
                    for(const acc of token.value) {
                        next_tokens.push(new PathToken("O_KEY",trieNode.addKey(acc).key));
                    }
                    break;
                default:
                    return {action:"continue"};
            }
            return {action:"continue",override_tokens:next_tokens,override_objs:[trieNode]}
        }
    }

    static triePathWalkHandler(context) {
        const {obj,token,prevContext} = context;

        /** @type {TrieMatch[]} */
        const trieCtx = prevContext?.trieMatches ?? [];
        context.trieMatches = [];

        switch(token.type) {
            case "T_ROOT":
            case "T_GROUP":
            case "T_BACK":
            case "END":
                return {action:"continue"}
                break;
        }

        const thisTrie = obj[EventManager.TrieDataSym]
        if(thisTrie instanceof TrieNode) {
            context.trieMatches.push(...thisTrie.matchToken(token,obj));
        }

        if(token.type === "T_DEEP_WILDCARD") {
            context.trieMatches.push(...trieCtx);
            return {action:"continue"};
        }

        for(const {key,node} of trieCtx) {
            context.trieMatches.push(...node.matchToken(token,obj));
        }
        
        return {action:"continue"}
    }

    constructor (anchor) {
        this.anchor = anchor;
        this.signals = new Map();
    }
    /**
     * @param {TrieRegistrationType} type
     * @param {string} channel 
     * @param {Path} target 
     * @param {any} payload
     */
    register(type,channel,target,payload) {
        if(!(target instanceof Path) && target instanceof Object) {
            target = Path.pathTo(target);
        }
        if(!(target instanceof Path)) return undefined;
        if(target.origin == undefined) target.origin = this.anchor;

        const registration = TrieNode.createRegistration(type,channel,payload)
        target.resolve({
            noReturn: true,
            forwardHandler: (context) => {
                if(context.obj instanceof TrieNode && context.token === Path.END_TOKEN) {
                    context.obj.addRegistration(registration)
                    return {action:"skip"};
                }
                return EventManager.triePathBuildHandler(context);
            }
        });
        return registration;
    }

    getRegistrations(type,channel,target,resultHandler = undefined) {
        // Data retrieval always starts from root in order to get all data
        if(target.origin == null) target.origin = this.anchor;
        target = Path.pathTo(target);
        if(!(target instanceof Path)) return undefined;

        if(resultHandler == undefined || typeof(resultHandler) !== "function") {
            resultHandler = (context) => {
                if(!(context.result instanceof TrieRegistration))
                    return {action:"discard"};
            }
        }

        return target.resolve({
            flat:true,
            wrapResults:false,
            startContext:{trieMatches: []},
            forwardHandler: (context) => {
                const {obj,token, prevContext} = context;

                if(token === Path.END_TOKEN) {
                    const rvals = [];
                    for(const {key,node} of /** @type {TrieMatch[]} */(prevContext.trieMatches)) {
                        const registrations = node.getRegistrationSet(type,channel)
                        if(registrations == undefined) continue;
                        rvals.push(...registrations);
                    }
                    return {action:"continue", override_objs:rvals};
                }

                return EventManager.triePathWalkHandler(context);
            },
            resultHandler: resultHandler
        });
    }

    /**
     * @param {TrieRegistration} registration 
     */
    unregister(registration){
        registration.unregister();
    }
    
    /**
     * 
     * @param {string} channel 
     * @param {Path} target 
     * @param {Listener} listener
     */
    registerListener(channel,target,listener) {
        if(!(listener instanceof Listener))
            return undefined;
        return this.register("listener",channel,target,listener);
    }

    /**
     * @param {string} channel 
     * @param {Path} target 
     * @param {any} payload
     */
    registerData(channel,target,payload) {
        return this.register("data",channel,target,payload);
    }

    getData(channel,target) {
        
        return this.getRegistrations("data",channel,target,(context) => {
            if(context.result instanceof TrieRegistration) {
                return {action:"override", value:context.result.payload};
            } else {
                return {action:"discard"};
            }
        })
    }

    /**
     * @param {string} channel 
     * @param {Path|Object} target 
     * @returns {Array}
     */
    emit(channel,target) {
        // Trie registration retrival starts at root to grab all
        // registrations, not just relative ones.
        target = Path.pathTo(target);

        console.log(`Emitting '${channel}' event to '${target.str}'`)

        /** @type {Set<Listener>} */
        const listenerTriggers = new Set();

        target.resolve({
            noReturn:true,
            startContext:{trieMatches: []},
            forwardHandler: (context) => {
                const {obj,token, prevContext} = context;

                if(token === Path.END_TOKEN) {
                    for(const {key,node} of /** @type {TrieMatch[]} */(prevContext.trieMatches)) {
                        const registrations = node.getRegistrationSet("listener",channel)
                        if(registrations == undefined) return {action:"skip"};
                        for(const reg of registrations) {
                            if(reg.payload instanceof Listener)
                                listenerTriggers.add(reg.payload)
                        }
                    }
                    return {action:"skip"};
                }

                return EventManager.triePathWalkHandler(context);
            },
        });

        const rval = new Array(listenerTriggers.size);
        let ridx = 0;
        for(const listener of listenerTriggers)
            rval[ridx++] = listener.trigger();
        return rval;
    }
}