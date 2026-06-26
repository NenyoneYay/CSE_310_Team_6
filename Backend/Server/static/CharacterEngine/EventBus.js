import {Path} from "./Path.js";
import { sanatizeKey } from "./helpers.js";

export class EventBus {

    static triePathWalkHandler = function ({obj, token}, options) {
        const type = options?.type;
        if(obj instanceof EventBus.TrieNode) {
            let next = [];
            switch(token.type) {
                case "T_ROOT":
                    next.push(this.trie);
                    break;
                case "O_WILDCARD": 
                case "A_WILDCARD":
                    next.push(...Object.values(obj));
                    if(obj.getWildcard() != null)
                        next.push(obj.getWildcard());
                    break;
                case "O_KEY":
                    next.push(...obj.getMatches(token.value));
                    break;
                case "A_LIST":
                    for(const idx of token.value) {
                        next.push(...obj.getMatches(token.value));
                    }
                    break;
                case "A_SLICE":
                    let {min,max} = token.value;
                    if(max != undefined) {
                        for(let i = min ?? 0;i < max;i++) {
                            next.push(...obj.getMatches(i));
                        }
                    } else {
                        next.push(...obj.getMatches(min ?? 0));
                    }
                    break;
                case "N_ACCESSORS":
                    for(const acc in token.value) {
                        next.push(...obj.getMatches(acc));
                    }
                    break;
                case "END": 
                    if(type != null)
                        return {overrides:obj.getListeners(type)};
                default:
                    return {action:"continue"};
            }
            return {action:"skip_token",overrides:next};
        }
    }

    static TrieNode = class TrieNode {
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

            this[newKey] = new EventBus.TrieNode();
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

    constructor () {
        this.trie = new EventBus.TrieNode();
    }

    /**
     * 
     * @param {"change","structure"} type 
     * @param {Path} path
     * @param {() => void} callback
     */
    addListener(type,path,callback) {
        const _path = new Path(Path.pathTo(path),this.trie);
        _path.resolve({
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(obj instanceof EventBus.TrieNode) {
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
                            return {overrides:[obj?.[Symbol.for("eventListeners")]]}
                        default:
                            return {action:"continue"};
                    }
                    return {action:"skip_token",overrides:next};
                }
            }
        })
    }

    /**
     * 
     * @param {"change","structure"} type 
     * @param {Path} path
     */
    getListeners(type,path) {
        const _path = new Path(Path.pathTo(path),this.trie); // re-origin path to this trie
        return _path.resolve({
            flat:true,
            forwardHandler: (params) => {
                if(params.token.type === "END")
                    return {overrides:params.obj?.getListeners(type)};
                return EventBus.triePathWalkHandler(params);
            }
        }).map(pathResult => pathResult.result);
    }

    /**
     * 
     * @param {"change","structure"} type 
     * @param {Path} path
     * @param {() => void} ogcallback original reference to callback registered
     */
    removeListener(type,path,ogcallback) {
        const _path = new Path(Path.pathTo(path),this.trie); // re-origin path to this trie
        return _path.resolve({
            flat:true,
            forwardHandler: (params) => {
                const {obj,token} = params;
                if(token.type === "END") {
                    return {overrides:[obj.removeListener(type,ogcallback)]}
                }
                return EventBus.triePathWalkHandler(params);
            }
        }).map(pathResult => pathResult.result);
    }

    /**
     * 
     * @param {string} type 
     * @param {Object} origin 
     * @returns {any[]} Array of results of all callbacks called.
     */
    emit(type,origin) {
        const path = Path.pathTo(origin);
        if(path == undefined) return;
        
        const arraySizes = new Map();
        path.resolve({
            forwardHandler:(params) => {
                const {obj,token} = params;
                if(Array.isArray(obj)) {
                    arraySizes.set(token,obj.length);
                }
            }
        });

        path.origin = this.trie;

        return path.resolve({
            flat:true,
            forwardHandler: (params) => {
                const {obj, token} = params;
                const next = [];

                /** @type {EventBus.TrieNode} */
                let trieNode = obj;
                if(!(obj instanceof EventBus.TrieNode)) {
                    trieNode = this.trie;
                }
                switch (token.type) {
                    case "T_ROOT":
                        next.push(this.trie);
                        break;
                    case "A_WILDCARD":
                    case "O_WILDCARD":
                        next.push(...Object.values(trieNode));
                        if(obj.getWildcard() != null)
                            next.push(obj.getWildcard());
                        break;

                    case "O_KEY":
                        next.push(...trieNode.getMatches(token.value));
                        break;

                    case "A_LIST":
                        next.push(...trieNode.getMatches(token.value, arraySizes.get(token)));
                        break;

                    case "A_SLICE":
                        const {min,max} = token.value;
                        const arraySize = arraySizes.get(token) ?? 0;
                        if(max != undefined){
                            for(let i = min ?? 0;i < max ?? arraySize;i++) {
                                next.push(...trieNode.getMatches(i))
                            }
                        }
                        break;

                    case "END":
                        for(const func of trieNode.getListeners(type)) {
                            next.push(func());
                        }
                        return {overrides:next};
                        break;

                    default:
                        return {action:"continue"}
                }
                return {action:"skip_token",overrides:next};
            }
        });
    }

    destroy() {
        this.trie.destroy();
    }
}
