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

        /** @type {HTMLInputElement} */
        this.renderedInput = null;
        /** @type {HTMLElement} */
        this.renderContainer = null;

        this.inputChangeHandler = (event) => {
            if (this.renderedInput != null) {
                let newVal = this.accessors.value;
                switch (this.renderedInput.type) {
                    case "number":
                        newVal = Number(this.renderedInput.value);
                        break;
                    case "checkbox":
                        newVal = Boolean(this.renderedInput.checked);
                        break; 
                    case "text":
                    default:
                        newVal = this.renderedInput.value;
                }
                if(document.activeElement === this.renderedInput)
                    this.set({value:newVal});
                else
                    this.updateRenderedInput();
            }
        }

        this.inputFocusHandler = (event) => {
            
        }

        this.inputBlurHandler = (event) => {
            this.updateRenderedInput();
        }
    }

    getDisplayValue(value = undefined) {
        if(value == undefined) value = this.accessors.value;
        return value;
    }

    renderHTML() {
        this.renderInputHTML();
        if(this.renderContainer == null) {
            this.renderContainer = document.createElement("div");
            this.renderContainer.append(this.renderedInput);
        }
        return this.renderContainer;
    }

    renderInputHTML(){
        let value = this.accessors.value;
        if(Number.isNaN(value)) {
            value = "NaN";
        }

        let inputType = "text";

        if(this.renderedInput == null || this.renderedInput.type != inputType) {
            const newElement = document.createElement("input");
            newElement.type = "text";
            newElement.classList.add("field-input");
            if(this.renderedInput != null) {
                const oldElement = this.renderedInput;
                // remove event listeners to avoid triggering extra events.
                this.renderedInput.removeEventListener("focus",this.inputFocusHandler);
                this.renderedInput.removeEventListener("input",this.inputChangeHandler);
                this.renderedInput.removeEventListener("blur",this.inputBlurHandler);
                oldElement.replaceWith(newElement);
            }
            this.renderedInput = newElement;
            if(this.error != null) this.setError(this.error,this.isErrorSrc);
            else if(this.warning != null) this.setWarning(this.warning);

            if(this[Symbol.for("virtual")]) {
                this.renderedInput.disabled = true;
            } else {
                this.renderedInput.addEventListener("focus", this.inputFocusHandler);
                this.renderedInput.addEventListener("input",this.inputChangeHandler);
                this.renderedInput.addEventListener("blur", this.inputBlurHandler);
            }
        }
        this.updateRenderedInput(value);
        return this.renderedInput;
    }

    unrenderHTML() {
        if(this.renderedInput != null) {;
            this.renderedInput.removeEventListener("focus",this.inputFocusHandler);
            this.renderedInput.removeEventListener("input",this.inputChangeHandler);
            this.renderedInput.removeEventListener("blur",this.inputBlurHandler);
            this.renderedInput.remove();
            this.renderedInput = null;
        }
        if(this.renderContainer != null) {
            this.renderContainer.remove();
            this.renderContainer = null;
        }
    }

    updateRenderedInput(value) {
        if(value == undefined) value = this.accessors.value;
        if (this.renderedInput != null) {
            switch (this.renderedInput.type) {
                case "checkbox":
                    this.renderedInput.checked = !!value;
                    break; 
                case "text":
                case "number":
                default:
                    this.renderedInput.value = value;
                    this.renderedInput.style.width = Math.min(String(value).length,25) + "ch"
            }
        }
    }

    /**
     * 
     * @param {HTMLInputElement} element 
     */
    detachInput () {
        this.renderedInput?.removeEventListener("focus", this.inputFocusHandler);
        this.renderedInput?.removeEventListener("input",this.inputChangeHandler);
        this.renderedInput?.removeEventListener("blur", this.inputBlurHandler);
        this.renderedInput = null;
    }

    setError(message, isErrorSrc = false) {
        this.isErrorSrc = isErrorSrc;
        this.error = message;
        this.accessors.value = NaN;
        if(this.renderedInput != null) {
            this.renderedInput.style.color = "#990000";
            this.renderedInput.title = message;
        }
    }

    setWarning(message) {
        this.warning = message;
        if(this.renderedInput != null) {
            this.renderedInput.style.color = "#94650d";
            this.renderedInput.title = message;
        }
    }

    clearErrors() {
        this.isErrorSrc = false;
        this.error = null;
        this.warning = null;
        if(this.renderedInput != null) {
            this.renderedInput.style.color = "";
            this.renderedInput.title = "";
        }
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
            this.setError(`Node Source: '${Path.pathTo(this).str}' is part of a dependency loop.`,true);
            throw EvalError(this.error);
        }

        try {
            // // if made async, please await the emit call so that cycles can be
            // // detected.
            const stale_accessors = {...this.accessors}
            this.evaluate();
            if(compareObj(this.accessors,stale_accessors) != undefined) {
                this.dirty = true;
            }

            if(this.dirty) {
                this.evBus?.emit("change",this);
                this.updateDependants();
                if(this[DATA_CHANGE_HANDLER]) this[DATA_CHANGE_HANDLER]();
                this.dirty = false;
            }
        } catch (e){
            this.setError(e.message,false);
            throw(e);
        } finally {
            this.visited = false;
        }
    }

    /**
     * 
     * @param {Path[]} specificDependants 
     */
    updateDependants(specificDependants = undefined) {
        /** @type {Set<BaseNode>} */
        const updateNodes = new Set();

        const resolvePath = (path) => {
            path.resolve({
                noReturn:true,
                forwardHandler: (context) => {
                    if(context.obj instanceof BaseNode && context.obj !== this) {
                        updateNodes.add(context.obj);
                        return {action:"skip"};
                    }
                },
            });
        }

        if(Array.isArray(specificDependants)) {
            for(const path of specificDependants) {
                // skip any random non-path entries
                if(!(path instanceof Path)) continue;
                resolvePath(path);
            }
        } else {
            // collect all unique node endpoints across all dependent paths
            for(const pathMap of this.dependants.values()) {
                for(const path of pathMap.values()) {
                    resolvePath(path);
                }
            }
        }
        
        // iterate set to only send one update per node in dependent paths.
        for(const node of updateNodes) {
            if(node instanceof BaseNode) node.update();
        }
    }

    evaluate() {
        this.clearErrors();

        if(document.activeElement !== this.renderedInput || this.renderedInput.type === "checkbox")
            this.updateRenderedInput();
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
                            const path = pathMap.get(change.path.str);
                            if(path != undefined) this.updateDependants([path]);
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
        const name = Path.getName(this);
        const parent = this[Symbol.for("parent")];
        if(parent != null && name != undefined) {
            const emitPath = Path.pathTo(this);
            // Delete node from parent
            if(Array.isArray(parent)) {
                const nIdx = parent.indexOf(this);
                parent.splice(nIdx, 1);
            } else {
                const nIdx = parent[Symbol.for("okeys")]?.indexOf(name) ?? -1;
                if(nIdx >= 0) parent[Symbol.for("okeys")].splice(nIdx, 1);
                delete (parent[name]);
            }
            this.evBus.emit("change",emitPath);
            this[Symbol.for("parent")] = null;
            this[EventManager.TrieDataSym]?.destroy();
        }
    }
}

export class DataNode extends BaseNode {
    static defaultDataObj = {
        value:0,
        min:undefined,
        max:undefined,
        prefix: '',
        postfix: '',
        __visible:true
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
    constructor(virtual, parent, dataObj = {}) {
        let {value,min,max,prefix,postfix,__visible} = {...DataNode.defaultDataObj,...dataObj};
        super(virtual, parent,{value:value});
        //Update Pathes
        this.__visible = !!__visible;
        if(dataObj[Symbol.for("essential")] ?? false) {
            this[Symbol.for("essential")] = true;
        }
        try {
            this.value = new ExprValue(value,this);
            this.max = new ExprValue(max,this);
            this.min = new ExprValue(min,this);
        
            /** @type {string} */
            this.prefix = String(prefix ?? '');
            /** @type {string} */
            this.postfix = String(postfix ?? '');
        } catch (e) {
            this.setError((this.error == null ? "" : this.error + "\n\n") + e.message,true);
        }

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

        this.inputFocusHandler = (event) => {
            this.renderHTML();
        }
        const baseInputChangeHandler = this.inputChangeHandler;

        this.inputBlurHandler = (event) => {
            if (this.editMode){
                this.modify({value:this.renderedInput.value});
            }
            this.renderHTML();
        }

        this.inputChangeHandler = (event) => {
            if(!(this.value.isExpr || this.editMode))
                baseInputChangeHandler(event);
        }
    }

    renderHTML() {
        this.renderInputHTML();
        if(this.renderedLabel == undefined) {
            this.renderedLabel = document.createElement("span");
            this.renderedLabel.classList.add("field-label");
            this.renderedLabel.textContent = Path.getName(this);
        }

        if(this.renderedMax == undefined) {
            this.renderedMax = document.createElement("span");
            this.renderedMax.textContent = `/ ${this.accessors.max}`;
            this.renderedMax.classList.add("field-text");
            if(!this[Symbol.for("virtual")]) {
                this.renderedMax.style.cursor = "pointer";
                this.renderedMax.addEventListener("click",() => this.renderSettingsHTML());
            }
        }
        if(this.renderContainer == null) {
            this.renderContainer = document.createElement("div");
            this.renderContainer.classList.add("field-input-container");
            if(this.renderedLabel != undefined)
                this.renderContainer.append(this.renderedLabel);

            if(this.renderedInput != undefined)
                this.renderContainer.append(this.renderedInput);

            if(this.renderedMax != undefined)
                this.renderContainer.append(this.renderedMax);
            

            if(this.editMode && !this[Symbol.for("virtual")]) {
                const editbtn = document.createElement("button");
                editbtn.title = "Edit field settings";
                editbtn.innerHTML = `<i class="ti ti-dots" style="font-size:10px" aria-hidden="true"></i>`;
                editbtn.classList.add("field-settings-btn");

                editbtn.addEventListener("click",() => this.renderSettingsHTML())
                this.renderContainer.append(editbtn);
            }
        }

        if(this.renderedMax != undefined) {
            if(this.max.value != undefined && this.max.value !== "")
                this.renderedMax.classList.remove("hidden");
            else
                this.renderedMax.classList.add("hidden");
        }
        
        return this.renderContainer;
    }

    renderInputHTML() {
        const focused = (document.activeElement === this.renderedInput);
        let value = this.accessors.value;
        if(focused) {
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
        } else {
            value = String(value);
        }
        if(this.renderedInput == null || this.renderedInput.type != inputType) {
            const newElement = document.createElement("input");
            newElement.type = inputType;
            newElement.classList.add("field-input");
            if(this.renderedInput != null) {
                // remove event listeners to avoid triggering extra events.
                this.renderedInput.removeEventListener("focus",this.inputFocusHandler);
                this.renderedInput.removeEventListener("input",this.inputChangeHandler);
                this.renderedInput.removeEventListener("blur",this.inputBlurHandler);
                this.renderedInput.replaceWith(newElement);
            }
            this.renderedInput = newElement;
            if(focused) this.renderedInput.focus();

            if(this.error != null) this.setError(this.error,this.isErrorSrc);
            else if(this.warning != null) this.setWarning(this.warning);

            if(this[Symbol.for("virtual")] || (this.value.isExpr && !this.editMode)) {
                this.renderedInput.disabled = true;
            } else {
                this.renderedInput.addEventListener("focus", this.inputFocusHandler);
                this.renderedInput.addEventListener("input",this.inputChangeHandler);
                this.renderedInput.addEventListener("blur", this.inputBlurHandler);
                if(this.renderedInput.tagName !== "TEXTAREA") {
                    this.renderedInput.addEventListener("keydown",(ev) => {
                        if(ev.key === "Enter") this.renderedInput.blur();
                    });
                }
            }
        }
        if(focused) this.renderedInput.scrollIntoView({behavior:"smooth",block:"nearest"});
        this.updateRenderedInput(value);
        return this.renderedInput;
    }

    renderSettingsHTML() {
        let popup = document.getElementById("node-settings-popup");
        if(popup == undefined) {
            popup = document.createElement("dialog");
            popup.id = "node-settings-popup";
            document.body.append(popup);
            popup.addEventListener("mousedown", (ev) => {
                const rect = popup.getBoundingClientRect();
                if( // if mouse is clicked outside of modal dialog, close it without setting values.
                    ev.clientX < rect.left 
                    || ev.clientX > rect.right
                    || ev.clientY < rect.top
                    || ev.clientY > rect.bottom
                ) {
                    popup.close();
                }
            })
        }
        popup.innerHTML = "";

        let nameInputContainer;
        let nameInputBox;
        if(this[Symbol.for("parent")] != undefined && !Array.isArray(this[Symbol.for("parent")])){
            nameInputContainer = document.createElement("div");
            const nameInputLabel = document.createElement("label");
            nameInputLabel.textContent = "name:";
            nameInputContainer.append(nameInputLabel);
            nameInputBox = document.createElement("input");
            nameInputBox.type = "text";
            nameInputBox.value = Path.getName(this);
            nameInputBox.classList.add("field-input");
            nameInputBox.placeholder = DataNode.defaultDataObj.prefix;
            nameInputContainer.append(nameInputBox);
        }

        const prefixInputContainer = document.createElement("div");
        const prefixInputLabel = document.createElement("label");
        prefixInputLabel.textContent = "Prefix:";
        prefixInputContainer.append(prefixInputLabel);
        const prefixInputBox = document.createElement("input");
        prefixInputBox.type = "text";
        prefixInputBox.value = this.prefix;
        prefixInputBox.classList.add("field-input");
        prefixInputBox.placeholder = DataNode.defaultDataObj.prefix;
        prefixInputContainer.append(prefixInputBox);

        const valueInputContainer = document.createElement("div");
        const valueInputLabel = document.createElement("label");
        valueInputLabel.textContent = "Value:";
        valueInputContainer.append(valueInputLabel);
        const valueInputBox = document.createElement("input");
        valueInputBox.type = "text";
        valueInputBox.value = this.value.value ?? "";
        valueInputBox.classList.add("field-input");
        valueInputBox.placeholder = DataNode.defaultDataObj.value;
        valueInputContainer.append(valueInputBox);
        
        const minInputContainer = document.createElement("div");
        const minInputLabel = document.createElement("label");
        minInputLabel.textContent = "Min:";
        minInputContainer.append(minInputLabel);
        const minInputBox = document.createElement("input");
        minInputBox.type = this.editMode ? "text" : "number";
        minInputBox.value = this.editMode || !this.min.isExpr ? this.min.value ?? "" : this.accessors.min;
        minInputBox.disabled = !this.editMode && this.min.isExpr;
        minInputBox.classList.add("field-input");
        minInputBox.placeholder = DataNode.defaultDataObj.min;
        minInputContainer.append(minInputBox);

        const maxInputContainer = document.createElement("div");
        const maxInputLabel = document.createElement("label");
        maxInputLabel.textContent = "Max:";
        maxInputContainer.append(maxInputLabel);
        const maxInputBox = document.createElement("input");
        maxInputBox.type = this.editMode ? "text" : "number";
        maxInputBox.value = this.editMode || !this.max.isExpr ? this.max.value ?? "" : this.accessors.max;
        maxInputBox.disabled = !this.editMode && this.max.isExpr;
        maxInputBox.classList.add("field-input");
        maxInputBox.placeholder = DataNode.defaultDataObj.max;
        maxInputContainer.append(maxInputBox);

        const postfixInputContainer = document.createElement("div");
        const postfixInputLabel = document.createElement("label");
        postfixInputLabel.textContent = "Postfix:";
        postfixInputContainer.append(postfixInputLabel);
        const postfixInputBox = document.createElement("input");
        postfixInputBox.type = "text";
        postfixInputBox.value = this.postfix;
        postfixInputBox.classList.add("field-input");
        postfixInputBox.placeholder = DataNode.defaultDataObj.postfix;
        postfixInputContainer.append(postfixInputBox);

        const applyBtn = document.createElement("button");
        applyBtn.textContent = "Apply";
        applyBtn.onclick = () => {
            this.modify({
                name:nameInputBox?.value,
                prefix:prefixInputBox.value,
                value:valueInputBox.value,
                min:minInputBox.value,
                max:maxInputBox.value,
                postfix:postfixInputBox.value
            });
            popup.close();
        }

        if(nameInputBox) {
            nameInputBox.addEventListener("keypress",(ev) => {
                if(ev.key === "Enter") {
                    ev.preventDefault();
                    if(!ev.shiftKey) prefixInputBox.focus();
                }
            });
        }

        prefixInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) {if(nameInputBox) nameInputBox.focus();}
                else valueInputBox.focus();
            }
        });

        valueInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) prefixInputBox.focus();
                else minInputBox.focus();
            }
        });

        minInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) { 
                    if(this.editMode) valueInputBox.focus();
                }
                else maxInputBox.focus();
            }
        });

        maxInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) minInputBox.focus();
                else if (this.editMode) postfixInputBox.focus();
                else applyBtn.focus();
            }
        });

        postfixInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) maxInputBox.focus();
                else applyBtn.focus();
            }
        });

        applyBtn.addEventListener("keydown",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) {
                    if(this.editMode)
                        postfixInputBox.focus();
                    else
                        maxInputBox.focus();
                }
                else applyBtn.click();
            }
        })


        if(this.editMode) {
            if(nameInputContainer) popup.appendChild(nameInputContainer);
            popup.appendChild(prefixInputContainer);
            popup.appendChild(valueInputContainer);
        }
        popup.appendChild(minInputContainer);
        popup.appendChild(maxInputContainer);
        if(this.editMode) {
            popup.appendChild(postfixInputContainer);
        }
        popup.appendChild(applyBtn);
        popup.showModal();
        return popup;
    }
    
    unrenderHTML() {
        super.unrenderHTML();
        if(this.renderedMax != undefined) {
            this.renderedMax.remove();
            this.renderedMax = undefined;
        }

        const popup = document.getElementById("node-settings-popup");
        if(popup != undefined)
            popup.innerHTML = "";
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

    updateRenderedInput(value = undefined) {
        if(value == undefined) {
            value = this.getDisplayValue();
        }
        
        if(this.renderedInput != null) {
            switch(this.renderedInput.type) {
                case "checkbox":
                    this.renderedInput.checked = !!value;
                    break;
                default:
                    this.renderedInput.value = value;
                    if(this.editMode)
                        this.renderedInput.style.width = String(this.value.value).length + "ch";
                    else
                        this.renderedInput.style.width = this.renderedInput.value.length + "ch";
            }
        }

        if(this.renderedMax != undefined) {
            if(this.accessors.max != undefined) {
                this.renderedMax.textContent = `/ ${this.accessors.max}`;
                this.renderedMax.classList.remove("hidden");
            } else {
                this.renderedMax.classList.add("hidden");
            }
        }

        if(this.renderedLabel != undefined) {
            const name = Path.getName(this);
            this.renderedLabel.textContent = name;
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
    modify({name=undefined,value=undefined,min=undefined,max=undefined,prefix=undefined,postfix=undefined}) {
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

        if(name    === "") name    = undefined;
        if(value   === "") value   = DataNode.defaultDataObj.value;
        if(prefix  === "") prefix  = DataNode.defaultDataObj.prefix;
        if(postfix === "") postfix = DataNode.defaultDataObj.postfix;

        if(!this.editMode && (this.min.isExpr || typeof(min) != "number")) min = undefined;
        if(!this.editMode && (this.max.isExpr || typeof(max) != "number")) max = undefined;

        try {
            if(!this[Symbol.for("virtual")]) {
                if(
                    name != undefined && typeof(name) === "string"
                    && this[Symbol.for("parent")] != undefined 
                    && !Array.isArray(this[Symbol.for("parent")])
                ) {
                    const oldName = Path.getName(this);
                    if(name != oldName) {
                        let newName = name;
                        let nameCount = 0;
                        while(newName in this[Symbol.for("parent")])
                            newName = `${name} (${++nameCount})`;
                        // parent "okeys" array
                        const pokeys = this[Symbol.for("parent")][Symbol.for("okeys")];
                        
                        if(Array.isArray(pokeys)) {
                            const okeyIdx = pokeys.indexOf(oldName);
                            if(okeyIdx >= 0) pokeys.splice(okeyIdx,1,newName);
                            else pokeys.push(newName);
                        }
                        const oldPath = Path.pathTo(this);
                        this[Symbol.for("parent")][newName] = this;
                        delete this[Symbol.for("parent")][oldName];
                        this.__name = newName;
                        this.evBus?.emit("change",oldPath);
                        this.evBus?.emit("change",this);
                    }
                }
                if(value != undefined && value !== this.value.value) {
                    try {value = JSON.parse(value)} catch (err) {}
                    this.listenerChanges.push(...getDepMods("value",this.value,value));
                }
                if(min != undefined) {
                    if(min === "") min = DataNode.defaultDataObj.min;
                    if(min !== this.min.value) {
                        try {min = JSON.parse(min)} catch (err) {}
                        this.listenerChanges.push(...getDepMods("min",this.min,min)); 
                    }
                }
                if(max != undefined) {
                    if(max === "") max = DataNode.defaultDataObj.max;
                    if(max !== this.max.value) {
                        try {max = JSON.parse(max)} catch (err) {}
                        this.listenerChanges.push(...getDepMods("max",this.max,max)); 
                    }
                }
                if(prefix != undefined && prefix !== this.prefix && typeof(prefix) === "string") {
                    this.prefix = prefix;
                }
                if(postfix != undefined && postfix !== this.postfix && typeof(postfix) === "string") {
                    this.postfix = postfix;
                }

                this.evaluateDependencies();
                this.update();
                this.renderHTML();
            }
        } catch (e) {
            this.setError(e.message, true);
            e.message = `Error modifying node: ${Path.pathTo(this).str} - ${e.message}`;
            throw e;
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
            let result = Number(this.max.evaluate());
            this.accessors.max = 
                (isNaN(result))
                ? null 
                : result;

            // min
            result = Number(this.min.evaluate());
            this.accessors.min = 
                (isNaN(result))
                ? null 
                : result;

            this.accessors.base = this.value.evaluate();
            this.accessors.base = clamp(
                this.accessors.base,
                this.accessors.min,
                this.accessors.max
            );

            // calculate modifiers

            if(this.evBus != null){
                const modProcessOrder = [];

                const setupMods = (accessorMods, node) => {
                    if(!node.accessors.condition) return;
                    switch(node.operation) {
                        case "replace":
                            if(accessorMods?.replace == undefined) {
                                accessorMods.replace = {__strongest: node.tier}
                            } else if(Math.abs(node.tier) > Math.abs(accessorMods.replace.__strongest) || accessorMods.replace.__highest === "default") {
                                accessorMods.replace.__strongest = node.tier;   // strongest tier (+/-) takes priority. "default" is lowest tier
                            }
                            accessorMods.replace[node.tier] = node.accessors.value;
                            break;
                        case "multiply":
                            if(accessorMods?.multiply == undefined)
                                accessorMods.multiply = {}
                            if(accessorMods.multiply?.[node.tier] == undefined) {
                                accessorMods.multiply[node.tier] = node.accessors.value
                            } else {
                                accessorMods.multiply[node.tier] += node.accessors.value; // all multipliers of same tier add
                            }
                            break;
                        case "add":
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

                const evaluateMods = (accessor,operations) => {
                    if(this.accessors[accessor] != undefined) {
                        if(operations.replace != undefined) {                   
                            this.accessors[accessor] = operations.replace[operations.replace.__strongest]; // strongest tier wins
                            if(operations.replace.__strongest >= 0) return;     // positive replace operations overrule other operations
                        }
                        if(operations.multiply != undefined) {                  // TODO: Come back to this and decide if multiply or add comes first
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

                const maxMods = this.evBus.getData("modifiers",this.maxPath);
                if(maxMods.length > 0) {
                    const modOperations = {}
                    for(const dataobj of maxMods) {
                        setupMods(modOperations,dataobj);
                    }
                    evaluateMods("max",modOperations);
                    result = Number(this.accessors.max);
                    this.accessors.max = 
                        (isNaN(result))
                        ? null 
                        : result;
                }

                const minMods = this.evBus.getData("modifiers",this.minPath);
                if(minMods.length > 0) {
                    const modOperations = {}
                    for(const dataobj of minMods) {
                        setupMods(modOperations,dataobj);
                    }
                    evaluateMods("min", modOperations);
                    result = Number(this.accessors.min);
                    this.accessors.min = 
                        (isNaN(result))
                        ? null 
                        : result;
                }

                const baseMods = this.evBus.getData("modifiers",this.basePath);
                if(baseMods.length > 0) {
                    const modOperations= {}
                    for(const dataobj of baseMods) {
                        setupMods(modOperations,dataobj);
                    }
                    evaluateMods("base", modOperations);
                }

                this.accessors.base = clamp(
                    this.accessors.base,
                    this.accessors.min,
                    this.accessors.max
                );
                this.accessors.value = this.accessors.base;

                const valueMods = [...this.evBus.getData("modifiers",this),...this.evBus.getData("modifiers",this.valuePath)];
                if(valueMods.length > 0) {
                    const modOperations = {}
                    for(const dataobj of valueMods) {
                        setupMods(modOperations,dataobj);
                    }
                    evaluateMods("value", modOperations);

                    this.accessors.value = clamp(
                        this.accessors.value,
                        this.accessors.min,
                        this.accessors.max
                    );
                }

            } else {
                this.accessors.value = this.accessors.base;
            }

        } catch (e) {
            //Update Path
            this.setError(e.message,true);
            e.message = `Node Source: ${Path.pathTo(this).str} ${e.message}`
            this.accessors.value = NaN;
            throw e;
        }
        return super.evaluate();
    }

    getSaveData() {
        let rval = super.getSaveData();
        if (rval === undefined) return rval;
        
        rval = {
            __type:"data",
            __visible: this.__visible,
            prefix: this.prefix,
            value: this.value.getSaveData(),
            min: this.min.getSaveData(),
            max: this.max.getSaveData(),
            postfix: this.postfix
        }
        const compareResult = compareObj(DataNode.defaultDataObj, rval, {keyWhitelist:["__type","value"],keyBlacklist:["__essential"]})

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
        try {
            this.condition = new ExprValue(condition ?? true, this);
            this.condition.precedentPaths.forEach(depPath => {
                this.listenerChanges.push({type:"add precedent",path:depPath,src:"condition"});
            })
        } catch (e) {
            this.setError((this.error == null ? "" : this.error + "\n\n") + e.message, true);
        }

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
        if(typeof(this.accessors.condition) !== "boolean") {
            this.accessors.condition = ModifierNode.defaultDataObj.condition;
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
    modify({target = undefined, condition = undefined,tier = undefined, operation = undefined,...rest}) {
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

        if(target    === "") target    = ModifierNode.defaultDataObj.target;
        if(condition === "") condition = ModifierNode.defaultDataObj.condition;
        if(tier      === "") tier      = ModifierNode.defaultDataObj.tier;
        if(operation === "") operation = ModifierNode.defaultDataObj.operation;

        try {
            if(!this[Symbol.for("virtual")]) {
                if(condition != undefined && condition != this.condition.value) {
                    try {condition = JSON.parse(condition)} catch (err) {}
                    this.listenerChanges.push(...getDepMods("condition",this.condition,condition));
                    // evaluation will determine if this value changes and becomes dirty.
                }
                if(target != undefined) {
                    const newTarget = new Path(target,this);
                    if(this.target == undefined || newTarget.str != this.target?.str) {
                        // data registration needs to change locations now
                        this.registeredData?.unregister();
                        // the evaluateDependencies step will find this null 
                        // value and re-register the data at the new path
                        this.registeredData = null;
                        this.listenerChanges.push({type:"remove dependant",src:"target",path:this.target});
                        this.listenerChanges.push({type:"add dependant",src:"target",path:newTarget});
                        this.target = newTarget;
                        this.dirty = true;
                    }
                }
                if(tier != undefined && ["number","string"].includes(typeof(tier)) && tier != this.tier) {
                    this.tier = tier;
                    this.dirty = true;
                }
                if(operation != undefined 
                    && typeof(operation) === "string"
                    && ["add","multiply","replace"].includes(operation) 
                    && operation != this.operation
                ) {
                    this.operation = operation;
                    this.dirty = true;
                }
            }
        } catch (e) {
            this.setError(e.message, true);
            e.message = `Error modifying node: ${Path.pathTo(this).str} - ${e.message}`;
            throw e;
        }

        super.modify(rest ?? {});
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

    renderSettingsHTML() {
        let popup = document.getElementById("node-settings-popup");
        if(popup == undefined) {
            popup = document.createElement("dialog");
            popup.id = "node-settings-popup";
            document.body.append(popup);
            popup.addEventListener("mousedown", (ev) => {
                const rect = popup.getBoundingClientRect();
                if( // if mouse is clicked outside of modal dialog, close it without setting values.
                    ev.clientX < rect.left 
                    || ev.clientX > rect.right
                    || ev.clientY < rect.top
                    || ev.clientY > rect.bottom
                ) {
                    popup.close();
                }
            })
        }
        popup.innerHTML = "";


        let nameInputContainer;
        let nameInputBox;
        if(this[Symbol.for("parent")] != undefined && !Array.isArray(this[Symbol.for("parent")])){
            nameInputContainer = document.createElement("div");
            const nameInputLabel = document.createElement("label");
            nameInputLabel.textContent = "name:";
            nameInputContainer.append(nameInputLabel);
            nameInputBox = document.createElement("input");
            nameInputBox.type = "text";
            nameInputBox.value = Path.getName(this);
            nameInputBox.classList.add("field-input");
            nameInputBox.placeholder = DataNode.defaultDataObj.prefix;
            nameInputContainer.append(nameInputBox);
        }

        // ================== Modifier Node input boxes ========================

        const targetInputContainer = document.createElement("div");
        const targetInputLabel = document.createElement("label");
        targetInputLabel.textContent = "Target:";
        targetInputContainer.append(targetInputLabel);
        const targetInputBox = document.createElement("input");
        targetInputBox.type = "text";
        targetInputBox.value = this.target?.str ?? "";
        targetInputBox.classList.add("field-input");
        targetInputBox.placeholder = ModifierNode.defaultDataObj.target;
        targetInputContainer.append(targetInputBox);

        const conditionInputContainer = document.createElement("div");
        const conditionInputLabel = document.createElement("label");
        conditionInputLabel.textContent = "Condition:";
        conditionInputContainer.append(conditionInputLabel);
        const conditionInputBox = document.createElement("input");
        conditionInputBox.type = "text";
        conditionInputBox.value = this.condition?.value ?? "";
        conditionInputBox.classList.add("field-input");
        conditionInputBox.placeholder = ModifierNode.defaultDataObj.condition;
        conditionInputContainer.append(conditionInputBox);

        const operationTierInputContainer = document.createElement("div");
        const operationInputLabel = document.createElement("label");
        operationInputLabel.textContent = "Operation:";
        operationTierInputContainer.append(operationInputLabel);
        const operationInputBox = document.createElement("select");
        operationInputBox.innerHTML = `
            <option value="add">add</option>
            <option value="multiply">multiply</option>
            <option value="replace">replace</option>
        `
        operationInputBox.style.cursor = "pointer"
        operationInputBox.value = this.operation;
        operationInputBox.classList.add("field-input");
        operationTierInputContainer.append(operationInputBox);

        const tierInputLabel = document.createElement("label");
        tierInputLabel.textContent = "Tier:";
        operationTierInputContainer.append(tierInputLabel);
        const tierInputBox = document.createElement("input");
        tierInputBox.type = "text";
        tierInputBox.value = this.tier;
        tierInputBox.classList.add("field-input");
        tierInputBox.placeholder = ModifierNode.defaultDataObj.tier;
        operationTierInputContainer.append(tierInputBox);

        // ==================== Data Node input boxes ==========================
        const prefixInputContainer = document.createElement("div");
        const prefixInputLabel = document.createElement("label");
        prefixInputLabel.textContent = "Prefix:";
        prefixInputContainer.append(prefixInputLabel);
        const prefixInputBox = document.createElement("input");
        prefixInputBox.type = "text";
        prefixInputBox.value = this.prefix;
        prefixInputBox.classList.add("field-input");
        prefixInputBox.placeholder = DataNode.defaultDataObj.prefix;
        prefixInputContainer.append(prefixInputBox);

        const valueInputContainer = document.createElement("div");
        const valueInputLabel = document.createElement("label");
        valueInputLabel.textContent = "Value:";
        valueInputContainer.append(valueInputLabel);
        const valueInputBox = document.createElement("input");
        valueInputBox.type = "text";
        valueInputBox.value = this.value.value ?? "";
        valueInputBox.classList.add("field-input");
        valueInputBox.placeholder = DataNode.defaultDataObj.value;
        valueInputContainer.append(valueInputBox);
        
        const minInputContainer = document.createElement("div");
        const minInputLabel = document.createElement("label");
        minInputLabel.textContent = "Min:";
        minInputContainer.append(minInputLabel);
        const minInputBox = document.createElement("input");
        minInputBox.type = this.editMode ? "text" : "number";
        minInputBox.value = this.editMode || !this.min.isExpr ? this.min.value ?? "" : this.accessors.min;
        minInputBox.disabled = !this.editMode && this.min.isExpr;
        minInputBox.classList.add("field-input");
        minInputBox.placeholder = DataNode.defaultDataObj.min;
        minInputContainer.append(minInputBox);

        const maxInputContainer = document.createElement("div");
        const maxInputLabel = document.createElement("label");
        maxInputLabel.textContent = "Max:";
        maxInputContainer.append(maxInputLabel);
        const maxInputBox = document.createElement("input");
        maxInputBox.type = this.editMode ? "text" : "number";
        maxInputBox.value = this.editMode || !this.max.isExpr ? this.max.value ?? "" : this.accessors.max;
        maxInputBox.disabled = !this.editMode && this.max.isExpr;
        maxInputBox.classList.add("field-input");
        maxInputBox.placeholder = DataNode.defaultDataObj.max;
        maxInputContainer.append(maxInputBox);

        const postfixInputContainer = document.createElement("div");
        const postfixInputLabel = document.createElement("label");
        postfixInputLabel.textContent = "Postfix:";
        postfixInputContainer.append(postfixInputLabel);
        const postfixInputBox = document.createElement("input");
        postfixInputBox.type = "text";
        postfixInputBox.value = this.postfix;
        postfixInputBox.classList.add("field-input");
        postfixInputBox.placeholder = DataNode.defaultDataObj.postfix;
        postfixInputContainer.append(postfixInputBox);

        // =====================================================================

        const applyBtn = document.createElement("button");
        applyBtn.textContent = "Apply";
        applyBtn.onclick = () => {
            this.modify({
                target:targetInputBox.value,
                operation:operationInputBox.value,
                tier:tierInputBox.value,
                condition:conditionInputBox.value,
                name:nameInputBox?.value,
                prefix:prefixInputBox.value,
                value:valueInputBox.value,
                min:minInputBox.value,
                max:maxInputBox.value,
                postfix:postfixInputBox.value
            });
            popup.close();
        }

        if(nameInputBox) {
            nameInputBox.addEventListener("keypress",(ev) => {
                if(ev.key === "Enter") {
                    ev.preventDefault();
                    if(!ev.shiftKey) targetInputBox.focus();
                }
            });
        }

        targetInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) {if(nameInputBox) nameInputBox.focus();}
                else operationInputBox.focus();
            }
        });

        operationInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) targetInputBox.focus();
                else tierInputBox.focus();
            }
        });

        tierInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) operationInputBox.focus();
                else conditionInputBox.focus();
            }
        });

        conditionInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) tierInputBox.focus();
                else prefixInputBox.focus();
            }
        });

        prefixInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) conditionInputBox.focus();
                else valueInputBox.focus();
            }
        });

        valueInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) prefixInputBox.focus();
                else minInputBox.focus();
            }
        });

        minInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) {
                    if(this.editMode) valueInputBox.focus();
                }
                else maxInputBox.focus();
            }
        });

        maxInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) minInputBox.focus();
                else if(this.editMode) postfixInputBox.focus();
                else applyBtn.focus();
            }
        });

        postfixInputBox.addEventListener("keypress",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) maxInputBox.focus();
                else applyBtn.focus();
            }
        });

        applyBtn.addEventListener("keydown",(ev) => {
            if(ev.key === "Enter") {
                ev.preventDefault();
                if(ev.shiftKey) {
                    if(this.editMode) postfixInputBox.focus();
                    else maxInputBox.focus();
                }
                else applyBtn.click();
            }
        })

        if(this.editMode) {
            if(nameInputContainer) popup.appendChild(nameInputContainer);
            popup.appendChild(targetInputContainer);
            popup.appendChild(operationTierInputContainer);
            popup.appendChild(conditionInputContainer);
            popup.appendChild(prefixInputContainer);
            popup.appendChild(valueInputContainer);
        }
        popup.appendChild(minInputContainer);
        popup.appendChild(maxInputContainer);
        if(this.editMode) {
            popup.appendChild(postfixInputContainer);
        }
        popup.appendChild(applyBtn);
        popup.showModal();
    }

    destroy() {
        if(this.registeredData != null) {
            if(Array.isArray(this.registeredData)) {
                for(const dataReg of this.registeredData)
                    this.registeredData.destroy();
            } else {
                this.registeredData.destroy();
            }
            this.registeredData = null;
            this.updateDependants();
        }
        super.destroy();
    }
}