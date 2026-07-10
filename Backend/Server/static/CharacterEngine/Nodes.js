import {Path} from "./Path.js";
import {ExprValue} from "./ExprValue.js";
import {compareObj, sanatizeKey} from "./helpers.js";
import { EventManager, Listener , TrieRegistration } from "./EventManager.js";

const DATA_CHANGE_HANDLER = Symbol("dataChangeHandler");

export class Container {
    static defaultDataObj = {
        direction: "column",
        content: null
    }
    /**
     * @param {boolean} virtual
     * @param {Container} parent
     * @param {{direction:("row"|"column"),content:any}} dataObj
     */
    constructor(virtual, parent, dataObj) {
        this[Symbol.for("virtual")] = virtual;
        this[Symbol.for("parent")] = parent;
        let {direction,content} = {...Container.defaultDataObj, ...dataObj}

        this.renderedElement = null;
        this.content = null;
        if (content instanceof Object) {
            ({__direction:direction, ...this.content} = content);
            this.content[Symbol.for("parent")] = this;
        } else {
            this.content = content;
        }
    }

    /**
     * @returns {HTMLElement}
     */
    renderHTML() {
        const newElement = document.createElement("div");
        this.renderedElement = newElement;
        return newElement;
    }

    destroy() {
        delete this.renderedElement;
        delete this[Symbol.for("parent")]
    }

    getSaveData() {
        if(this.virtual) return undefined;
        let rval = {
            __type: "container",
            direction: this.direction,
            content: this.content
        }

        const isDefault = compareObj(rval,Container.defaultDataObj,{keyBlacklist:["__type","content"]}) == undefined;

        if(Array.isArray(this.content) || (this.content instanceof BaseNode) 
            || !(this.content instanceof Object)
        ) {
            if (isDefault) rval = rval.content;
        } else {
            if(Container.defaultDataObj.direction !== rval.direction) 
                rval.content["__direction"] = rval.direction;
            // do same for any other metadata fields

            rval = rval.content;
        }
            
        return rval
    }
}

export class Placeholder extends Container{
    constructor(virtual, parent, dataObj) {
        super(virtual, parent, dataObj)
    }
}

export class BaseNode {
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

        this[Symbol.for("parent")] = parent;
        this[Symbol.for("virtual")] = virtual;

        this.raw = dataObj;
        this.accessors = {
            value: dataVal
        };
        this.passThrough = undefined;

        /** @type {EventManager|undefined} */
        this.evBus = undefined;

        // dependencyModifications defines what changes need to be made in the next
        // dependency evaluation pass. Stores a list of Objects of the form:
        // {type:"add/remove",path:<Path>,amount:<Number>}
        /** @type {{type:string,src:string,path:Path}[]} */
        this.listenerChanges = [];

        // Map: (source => Map( relPathStr => TrieRegistration ))
        /** @type {Map<string,Map<string,TrieRegistration>>} */
        this.listenerRegistrations = new Map()

        // Map: (source => Map( relPathStr => Path ))
        /** @type {Map<string,Map<string, Path>>} */
        this.dependants = new Map();

        // readonly property: updateListener
        Object.defineProperty(this,'updateListener',{
            value:new Listener(this.update,{thisArg:this}),
            writable:false,
            configurable:false,
            enumerable:true
        });

        this.editMode = false;

        this.dirty = true;
        this.visited = false;
        
        this.error = null;
        this.warning = null;
        this.isErrorSrc = false;

        this.renderedElement = null;

        this.inputChangeHandler = (event) => {
            if (this.renderedElement != null) {
                let newVal = this.accessors.value;
                switch (this.renderedElement.type) {
                    case "number":
                        newVal = Number(this.renderedElement.value);
                        break;
                    case "checkbox":
                        newVal = Boolean(this.renderedElement.checked);
                        break; 
                    case "text":
                    default:
                        newVal = this.renderedElement.value;
                }
                if(document.activeElement === this.renderedElement)
                    this.set({value:newVal});
                else
                    this.updateRenderedElement();
            }
        }

        this.inputFocusHandler = (event) => {
            
        }

        this.inputBlurHandler = (event) => {
            this.updateRenderedElement();
        }
    }

    getDisplayValue(value = undefined) {
        if(value == undefined) value = this.accessors.value;
        return value;
    }

    renderHTML() {
        let value = this.accessors.value;
        if(Number.isNaN(value)) {
            value = "NaN";
        }

        let inputType = "text";
        if(!this.editMode) {
            switch (typeof(value)) {
                case "string":
                    inputType = "text";
                    break;
                case "number":
                    inputType = "number";
                    break;
                case "boolean":
                    inputType = "checkbox";
                    break;
                default:
                    inputType = "text";
            }
        }

        if(this.renderedElement == null || this.renderedElement.type != inputType) {
            const newElement = document.createElement("input");
            newElement.type = inputType ?? "text";
            newElement.classList.add("field-input");
            if(this.renderedElement != null) {
                const oldElement = this.renderedElement;
                // remove event listeners to avoid triggering extra events.
                this.unrenderHTML();
                oldElement.replaceWith(newElement);
            }
            this.renderedElement = newElement;
            if(this[Symbol.for("virtual")]) {
                this.renderedElement.disabled = true;
            } else {
                this.renderedElement.addEventListener("focus", this.inputFocusHandler);
                this.renderedElement.addEventListener("input",this.inputChangeHandler);
                this.renderedElement.addEventListener("blur", this.inputBlurHandler);
            }
        }
        this.updateRenderedElement(value);
        return this.renderedElement;
    }

    unrenderHTML() {
        if(this.renderedElement == null) return;
        this.renderedElement.removeEventListener("focus",this.inputFocusHandler);
        this.renderedElement.removeEventListener("input",this.inputChangeHandler);
        this.renderedElement.removeEventListener("blur",this.inputBlurHandler);
        this.renderedElement = null;
    }

    updateRenderedElement(value) {
        if(value == undefined) value = this.accessors.value;
        if (this.renderedElement != null) {
            switch (this.renderedElement.type) {
                case "checkbox":
                    this.renderedElement.checked = !!value;
                    break; 
                case "text":
                case "number":
                default:
                    this.renderedElement.value = value;
                    this.renderedElement.style.width = Math.min(String(value).length,25) + "ch"
            }
        }
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    detachInput () {
        this.renderedElement?.removeEventListener("focus", this.inputFocusHandler);
        this.renderedElement?.removeEventListener("input",this.inputChangeHandler);
        this.renderedElement?.removeEventListener("blur", this.inputBlurHandler);
        this.renderedElement = null;
    }

    set({value = null}) {
        let success = false;
        if(value != null) {
            this.accessors.value = value;
            success = true;
        }
        if(success) this.update();
    }

    // idea: allow visited to be a loop counter to allow circular 
    // loops and recalculate up to x amount of times.
    update() {
        if (!this.visited) {
            this.visited = true;
        } else {
            this.visited = false;
            //Update path
            this.error = `Node Source: '${Path.pathTo(this).str}' is part of a dependency loop.`;
            this.isErrorSrc = true;
            this.renderedElement.value = this.accessors.value;
            throw EvalError(this.error);
        }

        try {
            if(!this.dirty){
                this.dirty = true;
            }
            
            // // if made async, please await the emit call so that cycles can be
            // // detected.
            const stale_accessors = {...this.accessors}
            this.evaluate();
            if(compareObj(this.accessors,stale_accessors,{keyBlacklist:["base"]}) != undefined) {
                this.evBus?.emit("change",this);

                for(const pathMap of this.dependants.values()) {
                    for(const path of pathMap.values()) {
                        /** @type {BaseNode[]} */
                        const nodes = path.resolve({
                            flat:true,
                            wrapResults:false,
                            forwardHandler: (context) => {
                                if(context.obj instanceof BaseNode && context.obj !== this) {
                                    return {action:"return"};
                                }
                            },
                            resultHandler:(context) => {
                                if(!(context.result instanceof BaseNode))
                                    return {action:"discard"};
                            }
                        });
                        for(const node of nodes) {
                            node.update();
                        }
                    }
                }
                if(this[DATA_CHANGE_HANDLER]) this[DATA_CHANGE_HANDLER]();
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
        if (this.dirty) {
            this.dirty = false;
            this.isErrorSrc = false;
            this.error = null;
            this.warning = null;
        }

        if(document.activeElement !== this.renderedElement || this.renderedElement.type === "checkbox")
            this.updateRenderedElement();
        return this.accessors.value;
    }

    evaluateDependencies() {
        this.evBus = Path.findRoot(this)[Symbol.for("EventBus")];
        if(this.evBus == null) return;
        this.listenerChanges.forEach((change) => {
            if(change == null || change.path == null || change.type == null) return;

            switch (change.type) {
                case "add listener":
                case "add precedent":
                    if(!this.listenerRegistrations.has(change.src))
                        this.listenerRegistrations.set(change.src,new Map());
                    const regMap = this.listenerRegistrations.get(change.src)
                    if(!regMap.has(change.path.str)) {
                        regMap.set(
                            change.path.str,
                            this.evBus.registerListener("change",change.path,this.updateListener)
                        );
                    }
                    break;
                case "add dependant":
                    if(!this.dependants.has(change.src))
                        this.dependants.set(change.src,new Map());
                    this.dependants.get(change.src).set(change.path.str,change.path);
                    break;
                case "remove listener":
                case "remove precedent":
                    if(this.listenerRegistrations.has(change.src)) {
                        /** @type {Map<string,TrieRegistration>} */
                        const regMap = this.listenerRegistrations.get(change.src);
                        if(regMap != undefined) {
                            const reg = regMap.get(change.path.str);
                            if(reg != undefined) {
                                reg.unregister();
                            }
                            regMap.delete(change.path.str);
                        }
                    }
                    break;
                case "remove dependant":
                    if(this.dependants.has(change.src)) {
                        /** @type {Map<string,TrieRegistration>} */
                        const pathMap = this.dependants.get(change.src);
                        if(pathMap != undefined) {
                            pathMap.delete(change.path.str);
                        }
                    }
                    break;
            }
            
            return;
        });

        // Once connections are made, clear out modifications list
        this.listenerChanges = [];
    }

    unregisterDependencies() {
        for(const pathMap of this.dependants.values()) {
            pathMap.clear();
        }
        this.dependants.clear();
        for(const regMap of this.listenerRegistrations.values()) {
            for(const reg of regMap.values()) {
                reg.unregister();
            }
            regMap.clear();
        }
        this.listenerRegistrations.clear();
    }

    getSaveData() {
        if (this[Symbol.for("virtual")]) return undefined;
        return null;
    }

    
    destroy() {
        this.unregisterDependencies();
        this.detachInput();
        this[Symbol.for("parent")] = null;
    }
}

export class DataNode extends BaseNode {
    static defaultDataObj = {
        value:0,
        min:undefined,
        max:undefined,
        prefix: '',
        postfix: ''
    }
    /**
     * @param {boolean} virtual 
     * @param {string} path 
     * @param {{
     *     value:(string|number|boolean|null),
     *     max?:(string|number),
     *     min?:(string|number)
     *   }?} dataObj
     */
    constructor(virtual, parent, dataObj) {
        let {value,min,max,prefix,postfix} = {...DataNode.defaultDataObj,...dataObj};
        super(virtual, parent,{value:value});
        //Update Pathes
        this.value = new ExprValue(value,this);
        this.max = new ExprValue(max,this);
        this.min = new ExprValue(min,this);
        /** @type {string} */
        this.prefix = String(prefix ?? '');
        /** @type {string} */
        this.postfix = String(postfix ?? '');

        this.valuePath = new Path("#value",this);
        this.maxPath = new Path("#max",this);
        this.minPath= new Path("#min",this);
        this.basePath= new Path("#base",this);

        this.value.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",src:"value",path:depPath});
        });
        this.max.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",src:"max",path:depPath,amount:1});
        });
        this.min.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",src:"min",path:depPath,amount:1});
        });

        this.accessors = {
            base: 0,
            value: value,
            max: max,
            min: min
        }

        const baseInputFocusHandler = this.inputFocusHandler;
        this.inputFocusHandler = (event) => {
            this.renderHTML();
        }
        this.inputBlurHandler = (event) => {
            if (this.renderedElement?.type === "text"){
                this.modify({value:this.renderedElement.value});
            }
            this.renderHTML();
        }
        const baseInputChangeHandler = this.inputChangeHandler;
        this.inputChangeHandler = (event) => {
            if(!this.value.isExpr)
                baseInputChangeHandler(event);
        }
    }

    renderHTML() {
        const focused = (document.activeElement === this.renderedElement);
        let value = this.accessors.value;
        if(focused || this.editMode) {
            value = this.value.value;
        } else {
            value = this.getDisplayValue(value);
        }

        if(Number.isNaN(value))
            value = "NaN";

        let inputType = "text";
        if(!this.editMode){
            switch (typeof(value)) {
                case "string":
                    inputType = "text";
                    break;
                case "number":
                    inputType = "number";
                    break;
                case "boolean":
                    inputType = "checkbox";
                    break;
                default:
                    inputType = "text";
            }
        }

        if(this.renderedElement == null || this.renderedElement.type != inputType) {
            const newElement = document.createElement("input");
            newElement.type = inputType;
            newElement.classList.add("field-input");
            if(this.renderedElement != null) {
                // remove event listeners to avoid triggering extra events.
                this.renderedElement.removeEventListener("focus",this.inputFocusHandler);
                this.renderedElement.removeEventListener("input",this.inputChangeHandler);
                this.renderedElement.removeEventListener("blur",this.inputBlurHandler);
                this.renderedElement.replaceWith(newElement);
            }
            this.renderedElement = newElement;
            if(focused) this.renderedElement.focus();
            if(this[Symbol.for("virtual")]) {
                this.renderedElement.disabled = true;
            } else {
                this.renderedElement.addEventListener("focus", this.inputFocusHandler);
                this.renderedElement.addEventListener("input",this.inputChangeHandler);
                this.renderedElement.addEventListener("blur", this.inputBlurHandler);
            }
        }
        
        this.updateRenderedElement(value);
        if(focused) this.renderedElement.scrollIntoView({behavior:"smooth",block:"nearest"});
        return this.renderedElement;
    }

    getDisplayValue(value = undefined) {
        if(value == undefined) value = this.accessors.value;
        let currentValue = value;
        let prefixCalc = this.prefix;
        if(typeof(currentValue) === "number") {
            if(currentValue < 0)
                prefixCalc = this.prefix.replace(/\+(\s*)$/," $1");
            if(!Number.isInteger(currentValue))
                currentValue = currentValue.toFixed(2);
        }
        if(["number","string"].includes(typeof(currentValue))) {
            value = prefixCalc + currentValue + this.postfix;
        }
        return value;
    }

    updateRenderedElement(value = undefined) {
        if(value == undefined) {
            value = this.getDisplayValue();
        }
        
        if(this.renderedElement != null) {
            switch(this.renderedElement.type) {
                case "checkbox":
                    this.renderedElement.value = !!value;
                    break;
                default:
                    this.renderedElement.value = value;
                    this.renderedElement.style.width = this.renderedElement.value.length + "ch";
            }
        }

        return value;
    }

    /**
     * 
     * @param {Map<string,Path>} oldPaths 
     * @param {Map<string,Path>} newPaths 
     * @param {"precedent"|"dependent"} type 
     * @returns 
     */
    calculateDepMods(src,oldPaths,newPaths,type="precedent") {
        if(!(["precedent","dependant"].includes(type))) return;

        const dependencyMods = [];
        newPaths.forEach((path, key) => {
            if (oldPaths.has(key)) {
                oldPaths.delete(key)
            } else {
                dependencyMods.push({type:`add ${type}`,path:path,src})
            }
        });
        oldPaths.forEach((path,key) => {
            dependencyMods.push({type:`remove ${type}`,path:path,src})
        })
        return dependencyMods;
    }

    set({value=undefined,min=undefined,max=undefined}) {
        if(!this[Symbol.for("virtual")]) {
            let success = false;
            if(value != undefined) {
                if(this.value.set(value)) 
                    success = true;
            }
            if(min != undefined) if(this.min.set(min)) success = true;
            if(max != undefined) if(this.max.set(max)) success = true;
            if(success) {
                this.update();
            }
        }
    }

    /**
     * @param {{
     *  value:(string|number|boolean|undefined),
     *  min:(string|number|boolean|undefined),
     *  max:(string|number|boolean|undefined)
     * }}  
     */
    modify({value=undefined,min=undefined,max=undefined}) {
        /**
         * @param {ExprValue} accessor 
         * @param {string|boolean|number} newVal 
         * @returns {Array<{type:string,path:Path,amount:Number}>}
         */
        const getDepMods = (src,accessor,newVal) => {
            const dependencyMods = [];
            const oldPaths = accessor.modify(newVal,this);
            //Update Path
            return this.calculateDepMods(src,oldPaths,accessor.precedentPaths);
        }

        if(!this[Symbol.for("virtual")]) {
            if(value != undefined && value !== this.value.value) {
                try {value = JSON.parse(value)} catch (err) {}
                this.listenerChanges.push(...getDepMods("value",this.value,value));
            }
            if(min != undefined && min !== this.min.value) {
                try {min = JSON.parse(min)} catch (err) {}
                this.listenerChanges.push(...getDepMods("min",this.min,min)); 
            }
            if(max != undefined && max !== this.max.value) {
                try {max = JSON.parse(max)} catch (err) {}
                this.listenerChanges.push(...getDepMods("max",this.max,max)); 
            }

            this.evaluateDependencies();
            this.update();
        }
    }

    evaluate() {
        try {
            const clamp = (val, min, max) => {
                if (min != null) {
                    val = Math.max(val,min);
                }

                if (max != null) {
                    val = Math.min(val,max);
                }
                return val;
            }

            // Evaluate this node
            // max
            let result = this.max.evaluate();
            this.accessors.max = 
                (Number.isNaN(result) || result == null)
                ? null 
                : result;

            // min
            result = this.min.evaluate();
            this.accessors.min = 
                (Number.isNaN(result) || result == null)
                ? null 
                : result;

            this.accessors.base = this.value.evaluate();

            // calculate modifiers
            const modOperations = {}

            if(this.evBus != null){
                const setupMods = (accessorMods, node) => {
                    if(!node.accessors.condition) return;
                    switch(node.operation) {
                        case "replace":
                            if(accessorMods?.replace == undefined) {
                                accessorMods.replace = {__highest: node.tier}
                            } else if(node.tier > accessorMods.replace.__highest || accessorMods.replace.__highest === "default") {
                                accessorMods.replace.__highest = node.tier; // highest tier takes priority. "default" is lowest tier
                            }
                            accessorMods.replace[node.tier] = node.accessors.value;
                            break;
                        case "multiply":
                            if(accessorMods.replace != undefined)
                                break;
                            if(accessorMods?.multiply == undefined)
                                accessorMods.multiply = {}
                            if(accessorMods.multiply?.[node.tier] == undefined) {
                                accessorMods.multiply[node.tier] = node.accessors.value
                            } else {
                                accessorMods.multiply[node.tier] += node.accessors.value; // all multipliers of same tier add
                            }
                            break;
                        case "add":
                            if(accessorMods.replace != undefined)
                                break;
                            if(accessorMods?.add == undefined)
                                accessorMods.add = {}
                            if(accessorMods.add?.[node.tier] == undefined) {
                                accessorMods.add[node.tier] = node.accessors.value;
                            } else {
                                if(node.tier === "default") {               // default tier simply adds addition modifiers together
                                    accessorMods.add[node.tier] += node.accessors.value;
                                } else {                                    // specified tier sets strongest value
                                    if(Math.abs(node.accessors.value) > accessorMods.add[node.tier]) {
                                        accessorMods.add[node.tier] = node.accessors.value;
                                    }
                                }
                            }
                            break;
                        default:
                            //Skip over node
                            break;
                    }
                }

                const valueMods = [...this.evBus.getData("modifiers",this),...this.evBus.getData("modifiers",this.valuePath)];
                if(valueMods.length > 0) {
                    modOperations["value"] = {}
                    for(const dataobj of valueMods) {
                        setupMods(modOperations["value"],dataobj);
                    }
                }
                const maxMods = this.evBus.getData("modifiers",this.maxPath);
                if(maxMods.length > 0) {
                    modOperations["max"] = {}
                    for(const dataobj of maxMods) {
                        setupMods(modOperations["max"],dataobj);
                    }
                }
                const minMods = this.evBus.getData("modifiers",this.minPath);
                if(minMods.length > 0) {
                    modOperations["min"] = {}
                    for(const dataobj of minMods) {
                        setupMods(modOperations["min"],dataobj);
                    }
                }
                const baseMods = this.evBus.getData("modifiers",this.basePath);
                if(baseMods.length > 0) {
                    modOperations["base"] = {}
                    for(const dataobj of baseMods) {
                        setupMods(modOperations["base"],dataobj);
                    }
                } 
            }
            
            // apply modifiers
            this.accessors.base = clamp(
                this.accessors.base,
                this.accessors.min,
                this.accessors.max
            );

            const modProcessOrder = [];
            const {base:modOperationsBase,...modOperationsRest} = modOperations;
            if(modOperationsBase != undefined)
                modProcessOrder.push(['base',modOperationsBase]);
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
                    this.accessors.base = clamp(
                        this.accessors.base,
                        this.accessors.min,
                        this.accessors.max
                    );
                    this.accessors.value = this.accessors.base;
                }
            }

            this.accessors.value = clamp(
                this.accessors.value,
                this.accessors.min,
                this.accessors.max
            );

        } catch (e) {
            this.isErrorSrc = true;
            this.error = e.message;
            //Update Path
            e.message = `Node Source: ${Path.pathTo(this).str} ${e.message}`
            throw e;
        }
        return super.evaluate();
    }

    getSaveData() {
        let rval = super.getSaveData();
        if (rval === undefined) return rval;
        
        rval = {
            __type:"data",
            prefix: this.prefix,
            value: this.value.getSaveData(),
            min: this.min.getSaveData(),
            max: this.max.getSaveData(),
            postfix: this.postfix
        }
        const compareResult = compareObj(DataNode.defaultDataObj, rval, {keyWhitelist:["__type","value"]})

        if(Object.keys(compareResult).length <= 2)
            rval = rval.value;
        else 
            rval = compareResult;

        return rval;
    }
}

export class ModifierNode extends DataNode {
    static defaultDataObj = {
        target: undefined,
        operation:"add",
        condition: true,
        tier: "default",
    }
    /**
     * @param {boolean} virtual 
     * @param {string} path 
     * @param {{
     *  target:string,
     *  operation:("add"|"multiply"|"replace"),
     *  value:(number|"string starting with '='"|boolean),
     *  max:(number|"string starting with '='"|boolean),
     *  min:(number|"string starting with '='"|boolean),
     *  tier: number
     * }} dataObj
     */
    constructor(virtual, parent, dataObj) {
        const {target,operation,condition,tier=0,...rest} = {...ModifierNode.defaultDataObj, ...dataObj};
        super(virtual, parent, rest);
        //Update Path
        if(target != undefined) {
            this.target = new Path(target, this);
            this.listenerChanges.push({type:"add dependant",path:this.target,src:"target"});
        } else
            this.target = undefined;
        

        this.operation = operation;
        this.tier = "default";
        if (typeof(tier) === "string") {
            this.tier = sanatizeKey(tier);
        } else if (typeof(tier) === "number") {
            this.tier = tier;
        }

        this.condition = new ExprValue(condition ?? true, this);
        this.condition.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",path:depPath,src:"condition"});
        })

        this.accessors.condition = condition ?? true;
        this.registeredData = null;
    }

    evaluateDependencies() {
        super.evaluateDependencies();
        if(this.evBus != null && this.registeredData == null) {
            this.registeredData = this.evBus.registerData('modifiers',this.target,this);
        }
    }

    evaluate() {
        this.accessors.condition = this.condition.evaluate();
        super.evaluate();
    }

        /**
     * @param {{
     *  condition:(string|boolean|undefined),
     *  value:(string|number|boolean|undefined),
     *  min:(string|number|boolean|undefined),
     *  max:(string|number|boolean|undefined)
     * }}  
     */
    modify({condition = undefined,...rest}) {
        /**
         * @param {ExprValue} accessor 
         * @param {string|boolean|number} newVal 
         * @returns {Array<{type:string,path:Path,amount:Number}>}
         */
        const getDepMods = (src,accessor,newVal) => {
            const dependencyMods = [];
            const oldPaths = accessor.modify(newVal,this);
            //Update Path
            return this.calculateDepMods(src,oldPaths,accessor.precedentPaths);
        }

        if(!this[Symbol.for("virtual")]) {
            if(condition != undefined) {
                try {condition = JSON.parse(condition)} catch (err) {}
                this.listenerChanges.push(...getDepMods("condition",this.condition,condition));
            }
        }
        if(rest != undefined)
            super.modify(rest);
    }

    getSaveData() {
        let rval = super.getSaveData();
        if (rval === undefined) return rval;

        const newData = {
            __type: "modifier",
            target: this.target.str,
            operation: this.operation,
            condition: this.condition.getSaveData(),
            tier: this.tier
        }

        const compareResult = compareObj(ModifierNode.defaultDataObj, newData, {keyWhitelist: ["__type","target","operation"]})

        if(rval instanceof Object) {
            Object.assign(rval,compareResult);
        } else {
            compareResult.value = rval;
            rval = compareResult;
        }

        return rval;
    }

    destroy() {
        super.destroy();
        if(this.registeredData != null) {
            if(Array.isArray(this.registeredData)) {
                for(const dataReg of this.registeredData)
                    this.registeredData.destroy();
            } else {
                this.registeredData.destroy();
            }
            this.registeredData = null;
        }
    }
}