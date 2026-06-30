import {Path} from "./Path.js";
import {ExprValue} from "./ExprValue.js";
import {compareObj, sanatizeKey} from "./helpers.js";
import { EventBus, Listener } from "./EventBus.js";

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

        const isDefault = compareObj(rval,Container.defaultDataObj,["__type","content"]);

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

        /** @type {EventBus|undefined} */
        this.evBus = undefined;

        // dependencyModifications defines what changes need to be made in the next
        // dependency evaluation pass. Stores a list of Objects of the form:
        // {type:"add/remove",path:<Path>,amount:<Number>}
        /** @type {{type:string,src:string,path:Path}[]} */
        this.listenerChanges = [];

        /** @type {Map<string,Listener[]>} */
        this.registeredListeners = new Map()
        this.updateListener = new Listener(this.update,{thisArg:this});

        this.dirty = true;
        this.visited = false;
        
        this.error = null;
        this.warning = null;
        this.isErrorSrc = false;

        this.inputType = null;
        this.renderedElement = null;

        this.inputChangeHandler = (event) => {
            let newVal = this.accessors.value;
            switch (this.inputType) {
                case "number":
                    if (this.renderedElement != null)
                        newVal = Number(this.renderedElement.value);
                    break;
                case "checkbox":
                    if (this.renderedElement != null)
                        newVal = Boolean(this.renderedElement.checked);
                    break; 
                case "text":
                default:
                    if (this.renderedElement != null)
                        newVal = this.renderedElement.value;
            }
            if(document.activeElement === this.renderedElement)
                this.set({value:newVal});
            else
                this.updateRenderedElement();
        }

        this.inputFocusHandler = (event) => {
            
        }

        this.inputBlurHandler = (event) => {
            this.updateRenderedElement();
        }
    }

    renderHTML(value = null) {
        if(value == null) value = this.accessors.value;
        switch (typeof(value)) {
            case "string":
                this.inputType = "text";
                break;
            case "number":
                this.inputType = "number";
                break;
            case "boolean":
                this.inputType = "checkbox";
                break;
            default:
                this.inputType = null;
        }

        if(this.renderedElement == null || this.renderedElement.type != this.inputType) {
            const newElement = document.createElement("input");
            newElement.type = this.inputType ?? "text";
            if(this.renderedElement != null) {
                const oldElement = this.renderedElement;
                oldElement.replaceWith(newElement);
            }
            this.renderedElement = newElement;
            this.updateRenderedElement(value);
            if(this[Symbol.for("virtual")]) {
                this.renderedElement.disabled = true;
            } else {
                this.renderedElement.addEventListener("focus", this.inputFocusHandler);
                this.renderedElement.addEventListener("input",this.inputChangeHandler);
                this.renderedElement.addEventListener("blur", this.inputBlurHandler);
            }
        }
        return this.renderedElement;
    }

    updateRenderedElement(value) {
        if (this.renderedElement != null) {
            switch (this.inputType) {
                case "checkbox":
                    this.renderedElement.checked = !!value;
                    break; 
                case "text":
                case "number":
                default:
                    this.renderedElement.value = value;
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

    set(value) {
        this.update();
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
            
            // // if made async, please await the emit call so that loops can be
            // // detected.
            const stale_accessors = {...this.accessors}
            this.evaluate();
            if(!compareObj(this.accessors,stale_accessors)) {
                this.evBus?.emit("change",this);
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

        if(document.activeElement !== this.renderedElement || this.inputType === "checkbox")
            this.updateRenderedElement(this.accessors.value);
        return this.accessors.value;
    }

    evaluateDependencies() {
        this.evBus = Path.findRoot(this)[Symbol.for("EventBus")];

        this.listenerChanges.forEach((mod) => {
            if(mod == null || mod.path == null || mod.type == null) return;

            // TODO: implement remove operations as well

            switch (mod.type) {
                case "add precedent":
                    this.evBus.registerListener("change",mod.path,this.updateListener)
                    break;
//                 case "add dependent":
//                     this.registerDependent(node,accessor,mod.amount);
//                     break;
//                 case "remove precedent":
//                     this.unregisterPrecedent(node,accessor,mod.amount);
//                     break;
//                 case "remove dependent":
//                     this.unregisterDependent(node,accessor,mod.amount);
//                     break;
            }
            
            return;
        });

        // Once connections are made, clear out modifications list
        this.listenerChanges = [];
    }

    getSaveData() {
        if (this[Symbol.for("virtual")]) return undefined;
        return null;
    }

    destroy() {
        this.detachInput();
        this.unregisterDependencies();
        delete this.raw;
        delete this.accessors;
    }
}

export class DataNode extends BaseNode {
    static defaultDataObj = {
        value:0,
        min:undefined,
        max:undefined,
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
        let {value,min,max} = {...DataNode.defaultDataObj,...dataObj};
        super(virtual, parent,{value:value, min:min, max:max});
        //Update Pathes
        this.value = new ExprValue(value,this);
        this.max = new ExprValue(max,this);
        this.min = new ExprValue(min,this);

        this.valuePath = new Path("#value",this);
        this.maxPath = new Path("#max",this);
        this.minPath= new Path("#min",this);
        this.basePath= new Path("#base",this);

        this.value.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",path:depPath,amount:1});
        });
        this.max.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",path:depPath,amount:1});
        });
        this.min.precedentPaths.forEach(depPath => {
            this.listenerChanges.push({type:"add precedent",path:depPath,amount:1});
        });

        this.dirty = true;

        this.accessors = {
            base: 0,
            value: value,
            max: max, 
            min: min
        }

        const baseInputFocusHandler = this.inputFocusHandler;
        this.inputFocusHandler = (event) => {
            if (this.value.isExpr && this.renderedElement.type !== "text") {
                this.renderHTML(this.value.value);
                this.renderedElement.focus();
            }
            this.updateRenderedElement(this.value.value);
        }
        this.inputBlurHandler = (event) => {
            if (this.renderedElement?.type === "text"){
                this.modify({value:this.renderedElement.value});
            }
            if(this.renderedElement?.type === "text")
                this.renderHTML(this.accessors.value);
            this.updateRenderedElement();
        }
        const baseInputChangeHandler = this.inputChangeHandler;
        this.inputChangeHandler = (event) => {
            if(!this.value.isExpr)
                baseInputChangeHandler(event);
        }
    }

    /**
     * 
     * @param {Map<string,Path>} oldPaths 
     * @param {Map<string,Path>} newPaths 
     * @param {"precedent"|"dependent"} type 
     * @returns 
     */
    calculateDepMods(oldPaths,newPaths,type="precedent") {
        if(!(["precedent","dependent"].includes(type))) return;

        const dependencyMods = [];
        newPaths.forEach((path, key) => {
            if (oldPaths.has(key)) {
                oldPaths.delete(key)
            } else {
                dependencyMods.push({type:`add ${type}`,path:path,amount:1})
            }
        });
        oldPaths.forEach((path,key) => {
            dependencyMods.push({type:`remove ${type}`,path:path,amount:1})
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
        const getDepMods = (accessor,newVal) => {
            const dependencyMods = [];
            const oldPaths = accessor.modify(newVal,this);
            //Update Path
            return this.calculateDepMods(oldPaths,accessor.precedentPaths);
        }

        if(!this[Symbol.for("virtual")]) {
            if(value != undefined && value !== this.value.value) {
                try {value = JSON.parse(value)} catch (err) {}
                this.listenerChanges.push(...getDepMods(this.value,value));
            }
            if(min != undefined && min !== this.min.value) {
                try {min = JSON.parse(min)} catch (err) {}
                this.listenerChanges.push(...getDepMods(this.min,min)); 
            }
            if(max != undefined && max !== this.max.value) {
                try {max = JSON.parse(max)} catch (err) {}
                this.listenerChanges.push(...getDepMods(this.max,max)); 
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
            __type: "data",
            value: this.value.getSaveData(),
            min: this.min.getSaveData(),
            max: this.max.getSaveData()
        }
        if(compareObj(DataNode.defaultDataObj, rval, ["__type","value"]))
            rval = rval.value;

        return rval;
    }
}

export class ModifierNode extends DataNode {
    static defaultDataObj = {
        ...super.defaultDataObj,
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
        const {target,operation,value,max,min,condition,tier=0} = {...ModifierNode.defaultDataObj, ...dataObj};
        super(virtual, parent, {target,operation,value,condition,tier});
        //Update Path
        if(target != undefined)
            this.target = new Path(target, this);
        else
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
            this.listenerChanges.push({type:"add precedent",path:depPath,amount:1});
        })

        this.accessors.condition = condition ?? true;
        this.registeredData = null;
    }

    [DATA_CHANGE_HANDLER]() {
        this?.target?.resolve({
            flat:true,
            wrapResults:false,
            forwardHandler: (context) => {
                const {obj,token} = context;
                if(obj instanceof BaseNode && obj !== this) {
                    return {action:"return"}
                }
            },
            resultHandler: (context) => {
                const {result} = context;
                if(!(result instanceof BaseNode))
                    return {action:"discard"};
            }
        }).forEach((node) => {
            node.update();
        });
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
        const getDepMods = (accessor,newVal) => {
            const dependencyMods = [];
            const oldPaths = accessor.modify(newVal,this);
            //Update Path
            return this.calculateDepMods(oldPaths,accessor.precedentPaths);
        }

        if(!this[Symbol.for("virtual")]) {
            if(condition != undefined) {
                try {condition = JSON.parse(condition)} catch (err) {}
                this.listenerChanges.push(...getDepMods(this.condition,condition));
            }
        }

        super.modify(...rest);
    }

    getSaveData() {
        let rval = super.getSaveData();
        if (rval === undefined) return rval;

        const newData = {
            __type: "modifier",
            target: this.target.raw,
            operation: this.operation,
            condition: this.condition.getSaveData(),
            tier: this.tier
        }

        if(rval instanceof Object) {
            Object.assign(rval,newData);
        } else {
            newData.value = rval;
            rval = newData;
        }

        return rval;
    }

    destroy() {
        super.destroy();
        if(this.registeredData != null) {
            if(Array.isArray(this.registeredData)) {
                for(const dataObj of this.registeredData)
                    this.registeredData.destroy();
            } else {
                this.registeredData.destroy();
            }
            this.registeredData = null;
        }
    }
}