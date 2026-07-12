import { BaseNode, DataNode } from './CharacterEngine/Nodes.js';
import { Character } from './CharacterEngine/CharacterEngine.js';
import { testChar } from './CharacterEngine/test.js';
import { Path } from './CharacterEngine/Path.js';
import { EventManager } from './CharacterEngine/EventManager.js';

let loadedChar = new Character();
window.getLoadedChar = () => loadedChar;

let sheet = {
    [Symbol.for("okeys")]:["Basics","Ability Scores","Combat"],
    "Basics": {
        [Symbol.for("okeys")]:["Name","Class","Level"],
        "__type": "section",
        "expanded": true,
        "Name": {
            "__type": "data",
            "value": "Bob"
        },
        "Class": {
            "__type": "data",
            "value": "Warlock"
        },
        "Level": {
            "__type": "data",
            "value": "1"
        },
    },
    "Ability Scores": {
        [Symbol.for("okeys")]:["Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"],
        "__type": "section",
        "expanded": true,
        "Strength": {
            [Symbol.for("okeys")]:["score","mod","save"],
            "__type": "section",
            "expanded": false,
            "score": {
                "__type": "data",
                "value": 10,
                "min": 0,
                "max": 20
            },
            "mod": {
                "__type": "data",
                "value": 0
            },
            "save": {
                "__type": "data",
                "value": 0
            }
        },
        "Dexterity": {
            [Symbol.for("okeys")]:["score","mod","save"],
            "__type": "section",
            "expanded": false,
            "score": {
                "__type": "data",
                "value": 15,
                "min": 0,
                "max": 20
            },
            "mod": {
                "__type": "data",
                "value": 0
            },
            "save": {
                "__type": "data",
                "value": 0
            }
        },
        "Constitution": {
            [Symbol.for("okeys")]:["score","mod","save"],
            "__type": "section",
            "expanded": false,
            "score": {
                "__type": "data",
                "value": 13,
                "min": 0,
                "max": 20
            },
            "mod": {
                "__type": "data",
                "value": 0
            },
            "save": {
                "__type": "data",
                "value": 0
            }
        },
        "Intelligence": {
            [Symbol.for("okeys")]:["score","mod","save"],
            "__type": "section",
            "expanded": false,
            "score": {
                "__type": "data",
                "value": 18,
                "min": 0,
                "max": 20
            },
            "mod": {
                "__type": "data",
                "value": 0
            },
            "save": {
                "__type": "data",
                "value": 0
            }
        },
        "Wisdom": {
            [Symbol.for("okeys")]:["score","mod","save"],
            "__type": "section",
            "expanded": false,
            "score": {
                "__type": "data",
                "value": 11,
                "min": 0,
                "max": 20
            },
            "mod": {
                "__type": "data",
                "value": 0
            },
            "save": {
                "__type": "data",
                "value": 0
            }
        },
        "Charisma": {
            [Symbol.for("okeys")]:["score","mod","save"],
            "__type": "section",
            "expanded": false,
            "score": {
                "__type": "data",
                "value": 8,
                "min": 0,
                "max": 20
            },
            "mod": {
                "__type": "data",
                "value": 0
            },
            "save": {
                "__type": "data",
                "value": 0
            }
        }
    },
    "Combat": {
        [Symbol.for("okeys")]:["HP","AC","Speed"],
        "__type": "section",
        "expanded": true,
        "HP": {
            "__type": "data",
            "value": 20
        },
        "AC": {
            "__type": "data",
            "value": 12
        },
        "Speed": {
            "__type": "data",
            "value": "30ft"
        },
    }
};



// Operations for sheet above ////////////////////
function getItemWithOkey(obj, index){
    return obj[obj[Symbol.for("okeys")][index]];
}
function getItemNameWithOkey(obj, index){
    return obj[Symbol.for("okeys")][index];
}
function getOkeyWithItemName(obj, name){
    return obj[Symbol.for("okeys")].indexOf(name);
}
function moveItemWithOkeys(obj, oldIndex, newIndex){
    const movingItem = obj[Symbol.for("okeys")].splice(oldIndex,1)[0];
    obj[Symbol.for("okeys")].splice(newIndex,0,movingItem);
    return movingItem;
}
function moveItemWithItemNames(obj, fromItemName, toItemName){
    moveItemWithOkeys(
        obj,
        getOkeyWithItemName(obj,fromItemName),
        getOkeyWithItemName(obj,toItemName),
    )
}
function moveItemToOkey(obj, itemName, newIndex){
    moveItemWithOkeys(
        obj,
        getOkeyWithItemName(obj,fromItemName),
        newIndex,
    )
}

function getName(obj,parent) {
    if(obj == undefined) return undefined;
    if(parent == undefined) 
        return "";
    if(Array.isArray(parent))
        return parent.indexOf(obj);
    else if (obj instanceof Object) {
        return Object.keys(parent)?.find(key => parent[key] === obj);
    } else
        return undefined;
}

function rename(obj,parent,newName) {
    if(Array.isArray(parent)){
        return undefined;
    } else {
        let oldKey = getName(obj,parent);
        if(oldKey == undefined) return undefined;
        if(newName === oldKey || newName.startsWith("__")) return oldKey;

        let newKey = newName;
        let keyCount = 0;
        while (newKey in parent) {
            newKey = `${newName} (${++keyCount})`
        }
        
        parent[newKey] = parent[oldKey];
        delete parent[oldKey];
        obj.__name = newKey;

        if(parent[Symbol.for("okeys")] == undefined) 
            parent[Symbol.for("okeys")] = [newKey];
        else {
            const okeyIdx = parent[Symbol.for("okeys")].indexOf(oldKey);
            if(okeyIdx >= 0)
                parent[Symbol.for("okeys")][okeyIdx] = newKey;
            else 
                parent[Symbol.for("okeys")].push(newKey);
        }
        
        return newKey;
    }
}
//////////////////////////////////////////////////////

function okeyObjToList(obj){
    let list = [];
    for (const okey of obj[Symbol.for("okeys")]){
        list.push(obj[okey]);
    }
    return list;
}



/** @type {Object} */
let dragSrc = null;
/** @type {string|number} */
let dragSrcName = null;
/** @type {{[okeys:symbol]:string[],[x:string]:any}|Array} */
let dragSrcParent = null;

/**@type {HTMLElement|null} */
let dragSrcElem = null;
/**@type {HTMLElement|null} */
let dragSrcSepElem = null;

function makeEmptyMessage(container) {
    const em = document.createElement("div");
    em.className = "empty-msg";
    em.textContent = "No content yet — add one below.";
    container.appendChild(em);
    return em;
}

function makeFieldInput(fieldData) {

    if (fieldData.type === "textarea") {
        const getVisualRows = (textarea) => {
            const computedStyle = window.getComputedStyle(textarea);
            
            // Get the line height pixel value
            const lineHeight = parseInt(computedStyle.lineHeight, 10);
            
            // Get actual text height inside the element
            const scrollHeight = textarea.scrollHeight; 
            
            // Calculate total visible rows
            return Math.floor(scrollHeight / lineHeight);
        }
        const ta = document.createElement("textarea");
        ta.className = "field-input";
        ta.value = fieldData.value || "";
        ta.rows = 2;
        ta.addEventListener("input", e => {
            fieldData.value = e.target.value;
            updatePreview(); 
        });
        ta.addEventListener("mousedown", e => e.stopPropagation());
        return ta;
        
    }
    else if (fieldData.type === "checkbox") {

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "field-input";
        cb.checked = fieldData.value === true || fieldData.value === "true";
        cb.addEventListener("change", e => {
            fieldData.value = e.target.checked; 
            updatePreview(); 
        });
        cb.addEventListener("mousedown", e => e.stopPropagation());
        return cb;
        
    }
    const inp = document.createElement("input");
    inp.type = fieldData.type === "number" ? "number" : "text";
    inp.className = "field-input";
    inp.value = fieldData.value || "";
    inp.style.minWidth = Math.min(String(fieldData.value || "").length,5) + "ch";
    inp.placeholder = fieldData.type === "number" ? "0" : "—";
    inp.addEventListener("input", e => {
        fieldData.value = e.target.value;
        inp.style.minWidth = Math.min(String(fieldData.value || "").length,5) + "ch";
        updatePreview(); 
    });
    // prevent drag from firing when clicking into the input
    inp.addEventListener("mousedown", e => e.stopPropagation());
    return inp;
}

function makeNode(nodeData, inputType, parent, container) {
    if(!(nodeData instanceof BaseNode)) {
        console.error("Node data not of node type");
        return;
    }
    const nodeName = getName(nodeData,parent);
    if(!Array.isArray(parent) && nodeData.__name !== nodeName) {
        nodeData.__name = nodeName;
    }
    if(nodeData[Symbol.for("parent")] == undefined)
        nodeData[Symbol.for("parent")] = parent;
    if(nodeData.__visible == undefined)
        nodeData.__visible = true;

    if(previewMode && !nodeData.__visible) return;
    if(!previewMode && nodeData[Symbol.for("virtual")]) return;

    const sepElem = document.createElement("div");
    sepElem.classList.add("seperator");

    const nodeElem = document.createElement("div");
    nodeElem.className = "field";

    if(!previewMode) {
        const handle = document.createElement("i");
        handle.draggable = true;
        handle.className = "ti ti-grip-vertical drag-handle";
        handle.setAttribute("aria-hidden","true");

        nodeElem.appendChild(handle);

        const eyeBtn = document.createElement("i");
        if(nodeData.__visible ?? true) {
            eyeBtn.className = "ti ti-eye section-icon-button";
        } else {
            eyeBtn.className = "ti ti-eye-closed section-icon-button";
        }

        eyeBtn.addEventListener("click", ev => {
            nodeData.__visible = !(nodeData.__visible ?? true);

            if(nodeData.__visible) {
                eyeBtn.className = "ti ti-eye section-icon-button";
            } else {
                eyeBtn.className = "ti ti-eye-closed section-icon-button";
            }
        });
        nodeElem.append(eyeBtn);
    }

    const inner = document.createElement("div");
    inner.className = "field-inner";
    if(inputType === "textarea") inner.style.flexDirection="column";

    if(!Array.isArray(parent)) {
        const lbl = document.createElement("span");
        lbl.className = "field-label";
        lbl.textContent = nodeData.__name;
        inner.appendChild(lbl);
    }


    nodeData.unrenderHTML();
    nodeData.editMode = !previewMode;
    const inputEl = nodeData.renderHTML();

    
    inner.appendChild(inputEl);

    nodeElem.appendChild(inner);

    if(!previewMode) {
        if(!(nodeData[Symbol.for("essential")] ?? false)){
            const delBtn = document.createElement("button");
            delBtn.className = "delete-btn";
            delBtn.title = "Remove field";
            delBtn.innerHTML = `<i class="ti ti-x"></i>`;
            delBtn.addEventListener("click", e => {

                e.stopPropagation();
                // nodeData.destroy(); // not implemented here, but will be used later
                if(nodeData instanceof BaseNode) {
                    nodeData.destroy();
                } else {
                    if(Array.isArray(parent)) {
                        const fIdx = parent.indexOf(nodeData);
                        parent.splice(fIdx, 1);
                    } else {
                        const fIdx = parent[Symbol.for("okeys")].indexOf(nodeData.__name);
                        parent[Symbol.for("okeys")].splice(fIdx, 1);
                        delete (parent[nodeData.__name]);
                    }
                }

                // Update HTML
                nodeElem.remove();
                sepElem.remove();
                updatePreview();

                if( (Array.isArray(parent) && parent.length <= 0)
                    || (!Array.isArray(parent) && parent[Symbol.for("okeys")].length <= 0)
                ) {
                    makeEmptyMessage(container);
                }
                
            });
            nodeElem.appendChild(delBtn);
        }

        nodeElem.addEventListener("dragstart", e => {

            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") 
                return;

            dragSrc = nodeData; dragSrcParent = parent;
            dragSrcElem = nodeElem; dragSrcSepElem = sepElem;
            
            setTimeout(() => nodeElem.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
            e.stopPropagation();
            
        });
        nodeElem.addEventListener("dragend", () => {
            nodeElem.classList.remove("dragging"); 
        });
        nodeElem.addEventListener("dragover", e => {

            if (dragSrcParent === parent && dragSrc !== nodeData) {

                e.preventDefault(); 
                e.stopPropagation(); 
                e.dataTransfer.dropEffect = "move";

                nodeElem.classList.add("drop-indicator");
            }
            
        });
        nodeElem.addEventListener("dragleave", () => nodeElem.classList.remove("drop-indicator"));
        nodeElem.addEventListener("drop", e => {

            e.preventDefault(); 
            e.stopPropagation();

            if (dragSrcParent === parent && dragSrc !== nodeData) {

                let fromIdx = 0;
                let toIdx = 0;
                if(Array.isArray(parent)) {
                    fromIdx = parent.indexOf(dragSrc);
                    toIdx = parent.indexOf(nodeData);
                    const [moved] = parent.splice(fromIdx, 1);
                    parent.splice(toIdx, 0, moved);
                } else if (parent?.[Symbol.for("okeys")] != undefined) {
                    fromIdx = parent[Symbol.for("okeys")].indexOf(dragSrc.__name);
                    toIdx = parent[Symbol.for("okeys")].indexOf(nodeData.__name);
                    const [moved] = parent[Symbol.for("okeys")].splice(fromIdx, 1);
                    parent[Symbol.for("okeys")].splice(toIdx, 0, moved);
                }
                
                // Update HTML
                if(fromIdx < toIdx) {
                    sepElem.insertAdjacentElement('afterend',dragSrcElem);
                } else {
                    nodeElem.insertAdjacentElement('beforebegin',dragSrcElem);
                }
                dragSrcElem.insertAdjacentElement('afterend', dragSrcSepElem);
                updatePreview();
            }
            dragSrcElem = null;
            dragSrcSepElem = null;
            dragSrcParent = null;
            dragSrcName = null;
            nodeElem.classList.remove("drop-indicator");
        });
    }

    container.appendChild(nodeElem);
    container.appendChild(sepElem);
    return nodeElem;
}

function makeContainer(containerData, parent, container) {
    if(containerData.__direction == undefined)
        containerData.__direction = "row";
    if(containerData.__expanded == undefined)
        containerData.__expanded = true;
    if(containerData.__visible == undefined)
        containerData.__visible = true;
    if(containerData[Symbol.for("okeys")] == undefined)
        containerData[Symbol.for("okeys")] = [];
    if(containerData[Symbol.for("parent")] == undefined)
        containerData[Symbol.for("parent")] = parent;

    if(previewMode && !containerData.__visible) return;

    const containerName = getName(containerData,parent);
    if(containerData.__name !== containerName && !Array.isArray(parent))
        containerData.__name = containerName;

    const sepElem = document.createElement("div");
    sepElem.classList.add("seperator");

    const secElem = document.createElement("div");
    secElem.className = "section";

    const hdr = document.createElement("div");
    hdr.className = "section-header";

    const fieldList = document.createElement("div");
    fieldList.className = "field-list";
    if(Array.isArray(containerData)) {
        fieldList.style.flexDirection = "column";
    } else {
        fieldList.style.flexDirection = containerData.__direction ?? "row";
    }

    if(!(containerData.__expanded ?? false)) {
        fieldList.classList.add("hidden")
    }

    if( (Array.isArray(containerData) && containerData.length <= 0)
        || (!Array.isArray(containerData) && containerData[Symbol.for("okeys")].length <= 0)
    ) {
        makeEmptyMessage(fieldList);
    }

    if(!previewMode) {
        const handle = document.createElement("i");
        handle.draggable = true;
        handle.className = "ti ti-grip-vertical drag-handle";
        handle.setAttribute("aria-hidden","true");
        hdr.appendChild(handle);

        if(!Array.isArray(containerData)) {
            const directionBtn = document.createElement("button");
            directionBtn.className = "direction";
            if(containerData.__direction === "row"){
                directionBtn.innerHTML = '<i class="ti ti-layout-rows"></i>';
            }else{
                directionBtn.innerHTML = '<i class="ti ti-layout-columns"></i>';
            }
            
            directionBtn.addEventListener("click", e =>{
                e.stopPropagation();
                if(containerData.__direction === "column"){
                    containerData.__direction = "row";
                    directionBtn.innerHTML = '<i/ class = "ti ti-layout-rows"></i>';
                }else{
                    containerData.__direction = "column";
                    directionBtn.innerHTML = '<i class="ti ti-layout-columns"></i>';
                }

                fieldList.style.flexDirection = containerData.__direction;
                updatePreview();

            });
            hdr.appendChild(directionBtn);

            const eyeBtn = document.createElement("i");
            if(containerData.__visible ?? true) {
                eyeBtn.className = "ti ti-eye section-icon-button";
            } else {
                eyeBtn.className = "ti ti-eye-closed section-icon-button";
            }

            eyeBtn.addEventListener("click", ev => {
                containerData.__visible = !(containerData.__visible ?? true);

                if(containerData.__visible) {
                    eyeBtn.className = "ti ti-eye section-icon-button";
                } else {
                    eyeBtn.className = "ti ti-eye-closed section-icon-button";
                }
            });

            hdr.appendChild(eyeBtn);
        }
        
    }

    const expander = document.createElement("i");
    let addRow = null
    if(containerData.__expanded ?? true) {
        expander.className = "ti ti-caret-up section-icon-button";
    } else {
        expander.className = "ti ti-caret-down section-icon-button";
    }
    expander.addEventListener("click", ev => {
        containerData.__expanded = !(containerData.__expanded ?? true);

        if(containerData.__expanded) {
            expander.className = "ti ti-caret-up section-icon-button";
            fieldList.classList.remove("hidden");
            addRow?.classList?.remove("hidden");
        } else {
            expander.className = "ti ti-caret-down section-icon-button";
            fieldList.classList.add("hidden");
            addRow?.classList?.add("hidden");
        }
    });
    hdr.append(expander);

    if(!Array.isArray(parent)) {
        const titleInp = document.createElement("input");
        titleInp.className = "section-title";
        titleInp.value = containerName;
        titleInp.disabled = previewMode;
        if(!previewMode) {
            titleInp.addEventListener("change", e => {
                const newName = e.target.value;
                e.target.value = rename(containerData,parent,newName) ?? containerData.__name;
                const emitPath = new Path("__name",containerData);
                loadedChar.eventManager.emit("change",emitPath);
                updatePreview();
            });
        }
        hdr.appendChild(titleInp);
    }

    if(!previewMode) {
        if(!(containerData[Symbol.for("essential")] ?? false)){
            const delBtn = document.createElement("button");
            delBtn.className = "delete-btn";
            delBtn.title = "Remove section";
            delBtn.innerHTML = `<i class="ti ti-x"></i>`;
            delBtn.addEventListener("click", () => {

                // containerData.destroy()
                (new Path("**",containerData)).resolve({
                    noReturn:true,
                    reverseHandler: (context) => {
                        if(context.obj instanceof BaseNode) {
                            context.obj.destroy();
                        } else if(context.obj instanceof Object) {
                            if(Array.isArray(context.obj)) {
                                for(const [idx,val] of context.obj.entries()) {
                                    context.obj[idx] = undefined;
                                    loadedChar.eventManager.emit("change", new Path(`[${idx}]`,context.obj));
                                }
                            }else {
                                for(const key of Object.keys(context.obj)) {
                                    context.obj[key] = undefined;
                                    loadedChar.eventManager.emit("change", new Path(key,context.obj));
                                }
                            }
                            context.obj[Symbol.for("parent")] = null;
                            context.obj[EventManager.TrieDataSym]?.destroy();
                        }
                    }
                });

                if(Array.isArray(parent)) {
                    const secIdx = parent.indexOf(containerData);
                    parent.splice(secIdx, 1);
                } else {
                    const okeyIdx = parent[Symbol.for("okeys")].indexOf(containerData.__name);
                    parent[Symbol.for("okeys")].splice(okeyIdx, 1);
                    delete parent[containerData.__name]
                }

                // Update HTML
                secElem.remove();
                sepElem.remove();
                updatePreview();


                if( (Array.isArray(parent) && parent.length <= 0)
                    || (!Array.isArray(parent) && parent[Symbol.for("okeys")].length <= 0)
                ) {
                    makeEmptyMessage(container);
                }
            });
            hdr.appendChild(delBtn);
        }

        hdr.addEventListener("dragstart", e => {

            dragSrc = containerData; dragSrcParent = parent;
            dragSrcElem = secElem; dragSrcSepElem = sepElem;
            setTimeout(() => secElem.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
                
        });
        hdr.addEventListener("dragend", () => {
            
            secElem.classList.remove("dragging"); 
        });
        hdr.addEventListener("dragover", e => {

            if (dragSrcParent === parent && dragSrc !== containerData) {
                e.preventDefault(); 
                e.dataTransfer.dropEffect = "move";

                hdr.classList.add("drop-indicator");
            }
                
        });
        hdr.addEventListener("dragleave", () => hdr.classList.remove("drop-indicator"));
        hdr.addEventListener("drop", e => {

            e.preventDefault();
            if (dragSrcParent === parent && dragSrc !== containerData) {

                let fromIdx = 0; let toIdx = 0;
                if(Array.isArray(parent)) {
                    fromIdx = parent.indexOf(dragSrc);
                    toIdx = parent.indexOf(containerData);
                    const [moved] = parent.splice(fromIdx, 1);
                    parent.splice(toIdx, 0, moved);
                } else {
                    fromIdx = parent[Symbol.for("okeys")].indexOf(dragSrc.__name);
                    toIdx = parent[Symbol.for("okeys")].indexOf(containerData.__name);
                    const [moved] = parent[Symbol.for("okeys")].splice(fromIdx, 1);
                    parent[Symbol.for("okeys")].splice(toIdx, 0, moved);
                }
               
                
                // Update HTML
                if(fromIdx < toIdx) {
                    sepElem.insertAdjacentElement('afterend',dragSrcElem);
                } else {
                    secElem.insertAdjacentElement('beforebegin',dragSrcElem);
                }
                dragSrcElem.insertAdjacentElement('afterend',dragSrcSepElem);
                updatePreview();
            }
            dragSrcElem = null;
            dragSrcSepElem = null;
            dragSrcParent = null;
            dragSrc = null;
            hdr.classList.remove("drop-indicator");
        });
    }

    if(Array.isArray(containerData)) {
        containerData.forEach((item,idx) => {
            if (Array.isArray(item) || (item.__type !== "data" && !(item instanceof BaseNode))){
                makeContainer(item,containerData,fieldList);
            } else {
                makeNode(item,"text",containerData,fieldList);
            }
        })
    } else {
        containerData[Symbol.for("okeys")].forEach((key,idx) => {
            const item = containerData[key];
            if (Array.isArray(item) || (item.__type !== "data" && !(item instanceof BaseNode))){
                makeContainer(item,containerData,fieldList);
            } else {
                makeNode(item,"text",containerData,fieldList);
            } 
        });
    }

    secElem.appendChild(hdr);
    secElem.appendChild(fieldList);

    if(!previewMode) {
        addRow = document.createElement("div");
        addRow.className = "add-field-row";
        if(!(containerData.__expanded ?? true)) {
            addRow.classList.add("hidden");
        }

        const labelInp = document.createElement("input");
        labelInp.placeholder = "Field label…";

        const typeSelect = document.createElement("select");
        ["data","section"].forEach(t => {

            const opt = document.createElement("option");
            opt.value = t; opt.textContent = t;
            typeSelect.appendChild(opt);
        
        });

    
        const addBtn = document.createElement("button");
        addBtn.innerHTML = `<i class="ti ti-plus" aria-hidden="true"></i>`;
        addBtn.addEventListener("click", () => {

            const label = labelInp.value.trim();
            if (!label) 
                return;

            // Update HTML: remove empty message
            const em = secElem.querySelector(":scope > .field-list > .empty-msg");
            if (em != null) {
                em.remove();
            }

            if(typeSelect.value !== "section") {
                const newNodeData = loadedChar.buildTree({__type:"data",value:"blank"},containerData,false,label);
                if(newNodeData != undefined) {
                    makeNode(newNodeData,typeSelect.value,containerData,fieldList);
                }
            } else {
                const newSecData = loadedChar.buildTree({},containerData,false,label);
                if(newSecData != undefined) {
                    makeContainer(newSecData,containerData,fieldList);
                }
            }

            labelInp.value = "";
            updatePreview();
            
        });
        labelInp.addEventListener("keydown", e => {
            if (e.key === "Enter") addBtn.click(); 
        });

        addRow.appendChild(labelInp);
        addRow.appendChild(typeSelect);
        addRow.appendChild(addBtn);

        secElem.appendChild(addRow);
    }
    
    container.appendChild(secElem);
    container.appendChild(sepElem);
    return secElem;
}


const sectionLabelInp = document.getElementById("new-section-name");
const sectionList = document.getElementById("section-list");
const sectionAddBtn = document.getElementById("btn-add-section");
function render(characterData) {

    sectionList.innerHTML = "";

    characterData[Symbol.for("okeys")].forEach((key, idx) => {
        const item = characterData[key];
        if (Array.isArray(item) || (item.__type !== "data" && !(item instanceof BaseNode))){
            makeContainer(item,characterData,sectionList);
        } else {
            makeNode(item,"text",characterData,sectionList);
        }
    });

    updatePreview();

}

sectionAddBtn.addEventListener("click", () => {
    if(sectionLabelInp == null || sectionList == null) return;
    if(loadedChar == null) return;
    const label = sectionLabelInp.value.trim() || "New section";
    
    const newSecData = {__type:"section"};

    let newLabel = label;
    let labelCount = 0;
    while (newLabel in loadedChar.root) {
        newLabel = `${label} (${++labelCount})`
    }
    loadedChar.root[newLabel] = newSecData;
    loadedChar.root[Symbol.for("okeys")].push(newLabel);
    newSecData.__name = newLabel;
    makeContainer(newSecData,loadedChar.root,sectionList);

    sectionLabelInp.value = ""; 

});

document.getElementById("new-section-name").addEventListener("keydown", e => {

    if (e.key === "Enter") 
        document.getElementById("btn-add-section").click();

});

document.getElementById("btn-save").addEventListener("click", () => {

    const blob = new Blob([loadedChar.getSaveData()], {
        type: "application/json" 
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a"); 
    a.href = url; 
    a.download = "character-sheet.json"; 

    a.click();
    URL.revokeObjectURL(url);

});

document.getElementById("btn-load-trigger").addEventListener("click", () => {

    document.getElementById("file-input").click();

});

document.getElementById("file-input").addEventListener("change", e => {

    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {

        try {

            // const parsed = JSON.parse(ev.target.result);
            // if (!parsed.content) {
            //     alert("Invalid character sheet JSON."); return; 
            // }
            if(loadedChar) loadedChar.destroy();
            loadedChar = new Character(ev.target.result);
            render(loadedChar.root);
            
        } catch (err) {
            throw(err)
            //alert("Could not parse JSON file.");
        }
        
    };
    reader.readAsText(file);

});

let previewVisible = false;
document.getElementById("btn-preview").addEventListener("click", () => {

    previewVisible = !previewVisible;
    const el = document.getElementById("json-preview");
    const btn = document.getElementById("btn-preview");
    if(previewVisible) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
    btn.innerHTML = previewVisible
        ? `<i class="ti ti-code" aria-hidden="true"></i> Hide JSON`
        : `<i class="ti ti-code" aria-hidden="true"></i> Show JSON`;
    updatePreview();
});
    
// hides buttons while not in edit mode
let previewMode = true;
const modeBtn = document.getElementById("btn-mode");
modeBtn.addEventListener("click", () => {
    previewMode = !previewMode;
    modeBtn.innerHTML = previewMode
        ? `<i class="ti ti-pencil-off"></i> Edit mode`
        : `<i class="ti ti-pencil"></i> Edit mode`;
    
    if(previewMode) {
        sectionLabelInp.classList.add("hidden");
        sectionAddBtn.classList.add("hidden");
    } else {
        sectionLabelInp.classList.remove("hidden");
        sectionAddBtn.classList.remove("hidden");
    }
    
    // Re-rendering is probably fine here
    if(loadedChar != null)
        render(loadedChar.root);
});
if(previewMode) {
    sectionLabelInp.classList.add("hidden");
    sectionAddBtn.classList.add("hidden");
    modeBtn.innerHTML = `<i class="ti ti-pencil-off"></i> Edit mode`;
}

function updatePreview() {

    if (!previewVisible) return;
        document.getElementById("json-preview").textContent = loadedChar.getSaveData();

}

if(loadedChar != null)
    render(loadedChar.root);
        