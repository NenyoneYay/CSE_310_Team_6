import {Path} from "./Path.js";
import {ExprValue} from "./ExprValue.js";
import {compareObj, sanatizeKey} from "./helpers.js";
import { EventBus, Listener } from "./EventBus.js";

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
        /** @type {Path[]} */
        this.emitters = [];

        // dependents and precedents are mapped directly to nodes after
        // the character data tree is constructed. Maps are used to 
        /** @type {Map<BaseNode,{[accessor:string]:Number}>} */
        this.dependents = new Map();
        /** @type {Map<BaseNode,{[accessor:string]:Number}>} */
        this.precedents = new Map();

        // dependencyModifications defines what changes need to be made in the next
        // dependency evaluation pass. Stores a list of Objects of the form:
        // {type:"add/remove",path:<Path>,amount:<Number>}
        /** @type {{type:String,path:Path,amount:Number}[]} */
        this.dependencyModifications = [];

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
                this.evaluate();
        }

        this.inputFocusHandler = (event) => {
            
        }

        this.inputBlurHandler = (event) => {
            this.evaluate();
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
    attachInput (element) {
        this.renderedElement = element;
        element.addEventListener("change",this.inputChangeHandler);
        this.evaluate();
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    detachInput () {
        this.renderedElement?.removeEventListener("change",this.inputChangeHandler)
        this.renderedElement = null;
    }

    set(value) {
        this.setDirty();
        this.evaluate();
    }

    // idea: allow visited to be a loop counter to allow circular 
    // loops and recalculate up to x amount of times.
    setDirty() {
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
            // for (let node of this.dependents.keys()) {
            //     if (node instanceof BaseNode) {
            //         node.setDirty()
            //     }
            // }
            
            // // if made async, please await this call so that loops can be
            // // detected.
            const stale_accessors = {...this.accessors}
            this.evaluate();
            if(!compareObj(this.accessors,stale_accessors)) {
                this.evBus?.emit("change",this);
                for(const emitPath of this.emitters) {
                    this.evBus?.emit("modify",emitPath);
                }
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
            
            try {
                // for(let dependent of this.dependents.keys()) {
                //     if (dependent instanceof BaseNode)
                //         dependent.evaluate();
                // }
                //this.evBus?.emit("change",this);
            } catch (e) {
                this.isErrorSrc = false;
                this.error = e.message;
                throw e;
            }

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
        const updateListener = new Listener(this.setDirty,{applier: this});
        const thisPath = Path.pathTo(this).append("#value,max,min").concatenate(Path.pathTo(this));
        this.evBus.addListener("modify",thisPath,updateListener);

        this.dependencyModifications.forEach((mod) => {
            if(mod == null || mod.path == null || mod.type == null) return;

            
            if(mod.type == "add precedent")
                this.evBus.addListener("change",mod.path,updateListener)
            else if(mod.type === "add dependent")
                this.emitters.push(mod.path);
            // implement remove operations as well
            
            return;

            //Update Path
            // const resolvedPaths = mod.path.resolve({flat:true}) ?? null;
            
            // const pathCrawler = (pathResult) => {
            //     if(pathResult == null) return;
            //     else if (pathResult?.__type === "pathResult") {
            //         let node = null, accessor = null;

            //         if(pathResult.result instanceof BaseNode) {
            //             node = pathResult.result;
            //         } else if (pathResult.context instanceof BaseNode) {
            //             node = pathResult.context;
            //             accessor = pathResult.accessor;
            //         }

            //         if(node != null) {
            //             switch (mod.type) {
            //                 case "add precedent":
            //                     this.registerPrecedent(node,accessor,mod.amount);
            //                     break;
            //                 case "add dependent":
            //                     this.registerDependent(node,accessor,mod.amount);
            //                     break;
            //                 case "remove precedent":
            //                     this.unregisterPrecedent(node,accessor,mod.amount);
            //                     break;
            //                 case "remove dependent":
            //                     this.unregisterDependent(node,accessor,mod.amount);
            //                     break;
            //             }
            //         }
            //         return;
            //     } else if (Array.isArray(pathResult)) {
            //         pathResult.forEach(item => pathCrawler(item));
            //     } else if (pathResult instanceof Object) {
            //         console.error(`${Path.pathTo(this).str}: Encountered unexpected Object in dependency results.`);
            //     }
            // }
            // pathCrawler(resolvedPaths);
        });

        // Once connections are made, clear out modifications list
        this.dependencyModifications = [];
    }

    /**
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    registerPrecedent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = this.precedents.get(node) ?? {};
            const newDependentVal = node.dependents.get(this) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }

            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                newPrecedentVal[accessor] = pCount + amount;
                newDependentVal[accessor] = dCount + amount;
            }
            this.precedents.set(node,newPrecedentVal);
            node.dependents.set(this,newDependentVal);
        }
    }

    /**
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    registerDependent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = node.precedents.get(this) ?? {};
            const newDependentVal = this.dependents.get(node) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }
            
            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                newPrecedentVal[accessor] = pCount + amount;
                newDependentVal[accessor] = dCount + amount;
            }

            this.dependents.set(node,newDependentVal);
            node.precedents.set(this,newPrecedentVal);
        }
    }

    unregisterDependencies() {
        for(const [node,accessors] of this.precedents) {
            for (const [accessor,amount] of Object.entries(accessors)) {
                node.unregisterDependent(this,[accessor],amount);
            }
        }

        for(const [node,accessors] of this.dependents) {
            for (const [accessor,amount] of Object.entries(accessors)){
                node.unregisterPrecedent(this,[accessor],amount);
            }
        }
    }

    /**
     * 
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    unregisterPrecedent(node, accessors = null, amount = 1){
        if (node instanceof BaseNode) {
            const newPrecedentVal = this.precedents.get(node) ?? {};
            const newDependentVal = node.dependents.get(this) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }
            
            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                if(newPrecedentVal?.[accessor] != undefined) {
                    if(pCount > amount) newPrecedentVal[accessor] = pCount - amount;
                    else delete newPrecedentVal[accessor];
                }

                if(newDependentVal?.[accessor] != undefined) {
                    if(dCount > amount) newDependentVal[accessor] = pCount - amount;
                    else delete newDependentVal[accessor];
                }
            }

            if(Object.keys(newPrecedentVal).length > 0) {
                this.precedents.set(node,newPrecedentVal);
            } else {
                this.precedents.delete(node);
            }

            if(Object.keys(newDependentVal).length > 0) {
                node.dependents.set(this,newDependentVal);
            } else {
                node.dependents.delete(this);
            }

            this.evaluate();
        }
    }

    /**
     * 
     * @param {BaseNode} node 
     * @param {string|string[]} accessors 
     * @param {Number} amount 
     */
    unregisterDependent(node, accessors = null, amount = 1) {
        if (node instanceof BaseNode) {
            const newPrecedentVal = node.precedents.get(this) ?? {};
            const newDependentVal = this.dependents.get(node) ?? {};
            if (accessors == null) {
                accessors = ["value"];
            } else if(!Array.isArray(accessors)) {
                accessors = [accessors];
            }
            
            for (const accessor of accessors) {
                const pCount = newPrecedentVal?.[accessor] ?? 0;
                const dCount = newDependentVal?.[accessor] ?? 0;
                if(newPrecedentVal?.[accessor] != undefined) {
                    if(pCount > amount) newPrecedentVal[accessor] = pCount - amount;
                    else delete newPrecedentVal[accessor];
                }

                if(newDependentVal?.[accessor] != undefined) {
                    if(dCount > amount) newDependentVal[accessor] = pCount - amount;
                    else delete newDependentVal[accessor];
                }
            }

            if(Object.keys(newPrecedentVal).length > 0) {
                node.precedents.set(this,newPrecedentVal);
            } else {
                node.precedents.delete(this);
            }

            if(Object.keys(newDependentVal).length > 0) {
                this.dependents.set(node,newDependentVal);
            } else {
                this.dependents.delete(node);
            }

            node.evaluate();
        }
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

        this.value.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        });
        this.max.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        });
        this.min.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
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
            this.evaluate();
            if(this.renderedElement?.type === "text")
                this.renderHTML(this.accessors.value);
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
                this.setDirty();
            }
        }
        this.evaluate();
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
                this.dependencyModifications.push(...getDepMods(this.value,value));
            }
            if(min != undefined && min !== this.min.value) {
                try {min = JSON.parse(min)} catch (err) {}
                this.dependencyModifications.push(...getDepMods(this.min,min)); 
            }
            if(max != undefined && max !== this.max.value) {
                try {max = JSON.parse(max)} catch (err) {}
                this.dependencyModifications.push(...getDepMods(this.max,max)); 
            }

            this.evaluateDependencies();
            this.setDirty();
        }
        this.evaluate();
    }

    evaluate() {
        if(this.dirty) {
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
                for(const [node,accessors] of this.precedents.entries()) {
                    if (node instanceof ModifierNode){

                        if(!node.accessors.condition) continue;

                        for (let accessor of Object.keys(accessors)) {
                            // do something with the node operation and value
                            // priority order: replace first, then multiply, then add
                            if(accessor === "node") accessor = "value";
                            if(modOperations[accessor] == undefined) {
                                modOperations[accessor] = {};
                            }
                            const accessorMods = modOperations[accessor];
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
                    modProcessOrder.push(modOperationsBase)
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
        this.dependencyModifications.push({type:"add dependent",path:this.target,amount:1});

        this.operation = operation;
        this.tier = "default";
        if (typeof(tier) === "string") {
            this.tier = sanatizeKey(tier);
        } else if (typeof(tier) === "number") {
            this.tier = tier;
        }

        this.condition = new ExprValue(condition ?? true, this);
        this.condition.precedentPaths.forEach(depPath => {
            this.dependencyModifications.push({type:"add precedent",path:depPath,amount:1});
        })

        this.accessors.condition = condition ?? true;
    }

    evaluateDependencies() {
        super.evaluateDependencies();
    }

    evaluate() {
        if (this.dirty) {
            this.accessors.condition = this.condition.evaluate();
        }
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
                this.dependencyModifications.push(...getDepMods(this.condition,condition));
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
}