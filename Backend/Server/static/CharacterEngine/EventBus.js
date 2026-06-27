import {Path} from "./Path.js";
import { sanatizeKey } from "./helpers.js";

class TrieNode {
    constructor () {
        this[Symbol.for("eventListeners")] = {};
    }

    destroy() {
        for(const [key,value] of Object.entries(node)) {
            value.destroy();
            this[Symbol.for("parent")] = null;
            this[Symbol.for("eventListeners")] = null;
            delete this[key];
        }
    }

    addKey(key) {
        const newKey = sanatizeKey(key);
        if(newKey in this) return this[newKey];

        this[newKey] = new TrieNode();
        this[newKey][Symbol.for("parent")] = this;
        return this[newKey]
    }

    getKey(key) {
        const sKey = sanatizeKey(key);
        if(!(sKey in this)) return undefined;

        return this[sKey]
    }

    addWildcard() {
        return this.addKey(Symbol.for("wildcard"));
    }

    addSlice(min = 0,max = null) {
        const newItems = []
        if(max != undefined) {
            for(let idx = min;idx < max;idx++) {
                newItems.push(this.addKey(idx));
            }
        } else {
            newItems.push(this.addKey(min + ':'));
        }
        return newItems;
    }

    getWildcard() {
        return this[Symbol.for("wildcard")];
    }

    // doesn't work without arrlen yet
    matchIdx(idx = 0,max = null,arrlen = 0, testobj = {}) {
        const matches = [];
        if(idx < 0) idx += arrlen;
        if(max != null && max < 0) max += arrlen;
        if(max != null && max <= idx && arrlen > 0) return matches;
        for(const key of Object.keys(testobj)) {
            if(key.includes(":")) {
                let [kmin,kmax] = key.split(":").map(x => parseInt(x));
                if(kmin < 0) kmin += arrlen;
                if(kmax < 0) kmax += arrlen;
                if(isNaN(kmax)) {
                    if(idx >= kmin || (max != null && max > kmin))
                        matches.push(testobj[key]);
                } else {
                    if(kmax > kmin && idx < kmax && (idx >= kmin || (max != null && max > kmin)))
                        matches.push(testobj[key]);
                    else if(kmax < kmin && (idx >= kmin && (max == null || max > kmax)))
                        matches.push(testobj[key]);
                }
            } else {
                let kv = parseInt(key);
                if(kv < 0) kv += arrlen;
                if(idx === kv || (max != null && kv >= idx && kv < max)) {
                    matches.push(testobj[key]);
                }
            }
        }
        return matches;
    }

    getMatches(key, arrlen = 0) {
        const matches = [];
        if(this[Symbol.for("wildcard")] != undefined)
            matches.push(this[Symbol.for("wildcard")]);
        if(key == undefined) return matches;

        const sKey = sanatizeKey(key);
        for(const _key of Object.keys(this)) {
            if(_key == sKey) {
                matches.push(this[_key]);
            } else if(!isNaN(sKey)) {
                if (_key.at(-1) === ":") {
                    let min = parseInt(_key.slice(0,-1));
                    if(isNaN(min)) continue;

                    if(min < 0) min += arrlen;

                    if(min <= parseInt(sKey))
                        matches.push(this[_key]);
                } else if (parseInt(_key) < 0) {
                    const idx = parseInt(_key) + arrlen;
                    if(idx == parseInt(sKey))
                        matches.push(this[_key]);
                }
            }
        }
        return matches;
    }

    getKeyMatches(key, arrlen = 0) {
        const matches = [];
        if(this[Symbol.for("wildcard")] != undefined)
            matches.push(Symbol.for("wildcard"));

        const sKey = sanatizeKey(key);
        for(const _key of Object.keys(this)) {
            if(_key == sKey) {
                matches.push(_key);
            } else if(!isNaN(sKey)) {
                if (_key.at(-1) === ":") {
                    let min = parseInt(_key.slice(0,-1));
                    if(isNaN(min)) continue;

                    if(min < 0) min += arrlen;

                    if(min <= parseInt(sKey))
                        matches.push(_key);
                } else if (parseInt(_key) < 0) {
                    const idx = parseInt(_key) + arrlen;
                    if(idx == parseInt(sKey))
                        matches.push(_key);
                }
            }
        }
        return matches
    }

    /**
     * @param {"change"|"structure"} type 
     * @param {() => void} callback 
     */
    addListener(type,callback) {
        if(this[Symbol.for("eventListeners")][type] == undefined)
            this[Symbol.for("eventListeners")][type] = [callback];
        else
            this[Symbol.for("eventListeners")][type].push(callback);
        return this;
    }

    /**
     * @param {"change"|"structure"} type 
     * @param {() => void} callback 
     */
    removeListener(type,callback) {
        if(this[Symbol.for("eventListeners")][type] == undefined)
            return;

        const idx = this[Symbol.for("eventListeners")][type].indexOf(callback);
        if(idx > -1)
            return this[Symbol.for("eventListeners")][type].splice(idx,1)[0];
    }

    getListeners(type) {
        if(this[Symbol.for("eventListeners")][type] == undefined)
            return [];
        return this[Symbol.for("eventListeners")][type];
    }
}

export class EventBus {

    static triePathWalkHandler = function ({obj, token}, options) {
        const type = options?.type;
        if(!(obj instanceof TrieNode))
            return {action:"skip"};
        const next = [];
        switch (token.type) {
            case "T_ROOT":
                return {action:"continue",overrides:[this.trie]};
                break;
            case "A_WILDCARD":
            case "O_WILDCARD":
                for(const key of Object.keys(obj)) {
                    next.push({type:"O_KEY",value:key});
                }
                if(obj[Symbol.for("wildcard")] != null)
                    next.push({type:"O_KEY",value:Symbol.for("wildcard")});
                break;

            case "O_KEY":
                for(const key of obj.getKeyMatches(token.value))
                    next.push({type:"O_KEY",value:key});
                break;

            case "A_LIST":
                for(const idx of token.value){
                    for(const key of obj.getKeyMatches(idx)) {
                        next.push({type:"O_KEY",value:key});
                        accessMap.set(key)
                    }
                }
                break;

            case "A_SLICE": {
                    let {min,max} = token.value;
                    const matches = obj.getMatches()
                    if(max == undefined){
                        
                    } else if(max > min){
                        for(let i = min ?? 0;i < max;i++) {
                            for(const key of obj.getKeyMatches(i)) {
                                next.push({type:"O_KEY",value:key});
                            }
                        }
                    } else {
                        
                    }
                }
                break;

            case "END":
                for(const func of obj.getListeners(type)) {
                    next.push(func());
                }
                return {overrides:next};
                break;

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
        const _path = Path.pathTo(target);
        _path.origin = this.trie;
        _path.resolve({
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof TrieNode) {
                    let next = [];
                    switch(token.type) {
                        case "T_ROOT":
                            next.push(this.trie);
                            break;
                        case "O_WILDCARD": 
                        case "A_WILDCARD":
                            next.push(obj.addWildcard());
                            break;
                        case "O_KEY":
                            next.push(obj.addKey(token.value));
                            break;
                        case "A_LIST":
                            for(const idx of token.value) {
                                next.push(obj.addKey(idx));
                            }
                            break;
                        case "A_SLICE":
                            let {min,max} = token.value;
                            next = obj.addSlice(min,max);
                            break;
                        case "N_ACCESSORS":
                            for(const acc in token.value) {
                                next.push(obj.addKey(acc));
                            }
                            break;
                        case "END": 
                            obj.addListener(type,callback);
                            return {override_objs:[obj?.[Symbol.for("eventListeners")]]}
                        default:
                            return {action:"continue"};
                    }
                    return {action:"skip_token",override_objs:next};
                }
            }
        })
    }

    /**
     * 
     * @param {string} type 
     * @param {Object|Path} target
     */
    getListeners(type,target) {
        const _path = Path.pathTo(target); // re-origin path to this trie
        _path.origin = this.trie;
        return _path.resolve({
            flat:true,
            forwardHandler: (params) => {
                if(params.token.type === "END")
                    return {override_objs:params.obj?.getListeners(type)};
                return EventBus.triePathWalkHandler(params);
            }
        }).map(pathResult => pathResult.result);
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
        }).map(pathResult => pathResult.result);
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
                // working on new resolver that attaches TrieNode matches to
                // the current object, then accesses them from the previous 
                // context. Better than ArraySizes map.
                if(token.type === "T_ROOT") {
                    return {action:"continue"};
                }

                let trieMatches = [];
                let trieCtx = context?.[EventBus.EventMetaSym] ?? obj?.[EventBus.EventMetaSym];
                if(Path.isRoot(obj)) {
                    trieMatches = [this.trie];
                    obj[EventBus.EventMetaSym] = trieMatches;
                    return {action:"continue"}
                }

                if(!Array.isArray(trieCtx))
                    return{action:"continue"};

                const next = [obj]
                for(const trieNode of trieCtx) {
                    switch(token.type) {
                        case 'O_WILDCARD' :
                            for(const key of Object.keys(trieNode))
                                trieMatches.push(key);
                            if(Symbol.for("wildcard") in trieNode)
                                trieMatches.push(trieNode[Symbol.for("wildcard")]);
                            break;
                        case 'O_KEY'      :
                            trieMatches.push(...trieNode.getMatches(token.value));
                            break;
                        case 'A_LIST'     :
                            if(Array.isArray(obj)) {
                                for(const idx of token.value) {
                                    trieMatches.push(...trieNode.getMatches(idx,obj.length));
                                }
                            }
                            break;
                        case 'A_SLICE'    :
                            if(Array.isArray(obj)) {
                                const {min,max} = token.value;

                            }
                            break;
                        case 'A_WILDCARD' :
                            break;
                        case 'T_GROUP'    :
                            break;
                        case 'N_ACCESSORS':
                            break;
                        default:
                            return {action:"continue"};
                    }
                }

                obj[EventBus.EventMetaSym] = trieMatches;
                return {action:"continue",override_objs: next};


                if(Array.isArray(obj)) {
                    let accessMap = arraySizes.get(token);
                    if(accessMap == undefined)
                        accessMap = new Map();
                    accessMap.set(accessor,obj.length);
                    arraySizes.set(token,accessMap);
                }
            }
        });

        path.origin = this.trie;

        return path.resolve({
            flat:true,
            forwardHandler: (params) => {
                const {obj, token,accessor} = params;
                const next = [];

                if(!(obj instanceof TrieNode))
                    return {action:"skip"};

                const accessMap = arraySizes.get(token);
                switch (token.type) {
                    case "T_ROOT":
                        next.push(this.trie);
                        break;
                    case "A_WILDCARD":
                    case "O_WILDCARD":
                        for(const key of Object.keys(obj)) {
                            next.push({type:"O_KEY",value:key});
                        }
                        if(obj[Symbol.for("wildcard")] != null)
                            next.push({type:"O_KEY",value:Symbol.for("wildcard")});
                        break;

                    case "O_KEY":
                        for(const key of obj.getKeyMatches(token.value))
                            next.push({type:"O_KEY",value:key});
                        break;

                    case "A_LIST":{
                            const arraySize = accessMap.get(accessor);
                            for(const idx of token.value){
                                for(const key of obj.getKeyMatches(idx,arraySize)) {
                                    next.push({type:"O_KEY",value:key});
                                    accessMap.set(key)
                                }
                            }
                        }
                        break;

                    case "A_SLICE": {
                            const {min,max} = token.value;
                            const arraySize = accessMap.get(accessor) ?? 0;
                            if(max != undefined){
                                for(let i = min ?? 0;i < max ?? arraySize;i++) {
                                    for(const key of obj.getKeyMatches(i)) {
                                        next.push({type:"O_KEY",value:key});
                                    }
                                }
                            }
                        }
                        break;

                    case "END":
                        for(const func of obj.getListeners(type)) {
                            next.push(func());
                        }
                        return {override_objs:next};
                        break;

                    default:
                        return {action:"continue"}
                }
                return {action:"continue",override_tokens:next};
                //return {action:"skip_token",overrides:next};
            }
        });
    }

    destroy() {
        this.trie.destroy();
    }
}
