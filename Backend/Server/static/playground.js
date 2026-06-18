
let sheet = {

    meta: {
        name: "My Character", 
        system: "Custom", 
        version: "1" 
    },
    content: [
        {
            type: "section",
            label: "Basics", 
            content: [
                {
                    label: "Name",  
                    type: "text",   
                    value: "" 
                },
                {
                    label: "Class", 
                    type: "text",   
                    value: "" 
                },
                {
                    label: "Level", 
                    type: "number", 
                    value: "1" 
                }
            ]
        },
        {
            label: "Ability scores", 
            content: [
                {
                    label: "Strength",
                    expanded: false,
                    type: "section", 
                    content: [
                        {
                            label:"score",
                            type:"number",
                            value:"10"
                        },
                        {
                            label:"mod",
                            type:"number",
                            value:"0"
                        },
                        {
                            label:"save",
                            type:"number",
                            value:"0"
                        }
                    ] 
                },
                {
                    label: "Dexterity",
                    expanded: false,
                    type: "section", 
                    content: [
                        {
                            label:"score",
                            type:"number",
                            value:"10"
                        },
                        {
                            label:"mod",
                            type:"number",
                            value:"0"
                        },
                        {
                            label:"save",
                            type:"number",
                            value:"0"
                        }
                    ] 
                },
                {
                    label: "Constitution",
                    expanded: false,
                    type: "section", 
                    content: [
                        {
                            label:"score",
                            type:"number",
                            value:"10"
                        },
                        {
                            label:"mod",
                            type:"number",
                            value:"0"
                        },
                        {
                            label:"save",
                            type:"number",
                            value:"0"
                        }
                    ] 
                },
                {
                    label: "Intelligence",
                    expanded: false,
                    type: "section", 
                    content: [
                        {
                            label:"score",
                            type:"number",
                            value:"10"
                        },
                        {
                            label:"mod",
                            type:"number",
                            value:"0"
                        },
                        {
                            label:"save",
                            type:"number",
                            value:"0"
                        }
                    ] 
                },
                {
                    label: "Wisdom",
                    expanded: false,
                    type: "section", 
                    content: [
                        {
                            label:"score",
                            type:"number",
                            value:"10"
                        },
                        {
                            label:"mod",
                            type:"number",
                            value:"0"
                        },
                        {
                            label:"save",
                            type:"number",
                            value:"0"
                        }
                    ] 
                },
                {
                    label: "Charisma",
                    expanded: false,
                    type: "section", 
                    content: [
                        {
                            label:"score",
                            type:"number",
                            value:"10"
                        },
                        {
                            label:"mod",
                            type:"number",
                            value:"0"
                        },
                        {
                            label:"save",
                            type:"number",
                            value:"0"
                        }
                    ] 
                }
            ]
        },
        {
            label: "Combat", 
            type: "section",
            content: [
                {
                    label: "HP",    
                    type: "number", 
                    value: "" 
                },
                {
                    label: "AC",    
                    type: "number", 
                    value: "" 
                },
                {
                    label: "Speed", 
                    type: "text",   
                    value: "30ft" 
                }
            ]
        }
    ]

};

/** @type {Object} */
let dragSrc = null;
/** @type {{type:string,label:string,content:Array}} */
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

/**
 * @param {string|Object} data Container label or object loaded from file
 * @param {string} type 
 * @param {{label:string,type:string,content:Array}} parent 
 * @param {HTMLDivElement} container 
 * @returns {HTMLDivElement}
 */
function makeContainer(data, type, parent, parentEl) {
    if(type === "section") {
        makeSection(data,parent,parentEl);
    } else {
        makeField(data,type,parent,parentEl);
    }
}

/**
 * @param {string|{label:string,type:string,value:string|number|boolean}} fieldData Field label or field object loaded from file
 * @param {string} type 
 * @param {{label:string,type:string,content:Array}} parent 
 * @param {HTMLDivElement} container 
 * @returns {HTMLDivElement}
 */
function makeField(fieldData, type, parent, container) {
    const data = (() => {
        let fd = null;
        if (fieldData instanceof Object) {
            fd = fieldData;
        } else if (typeof(fieldData) === "string") {
            fd = {
                label: fieldData,
                type,
                value:""
            }
            parent.content.push(fd);
        }
        return fd;
    })();
    if (data == null) return;

    const sepEl = document.createElement("div");
    sepEl.classList.add("seperator");

    const fEl = document.createElement("div");
    fEl.className = "field"; fEl.dataset.fid = data.id;

    if(!previewMode) {
        const handle = document.createElement("i");
        handle.draggable = !previewMode;
        handle.className = "ti ti-grip-vertical drag-handle";
        handle.setAttribute("aria-hidden","true");

        fEl.appendChild(handle);
    }

    const inner = document.createElement("div");
    inner.className = "field-inner";
    if(data.type === "textarea") inner.style.flexDirection="column";

    const lbl = document.createElement("span");
    lbl.className = "field-label";
    lbl.textContent = data.label;

    const inputEl = makeFieldInput(data);

    inner.appendChild(lbl);
    inner.appendChild(inputEl);

    const badge = document.createElement("span");
    badge.className = "field-type-badge";
    badge.textContent = data.type;

    fEl.appendChild(inner);
    fEl.appendChild(badge);
    if(!previewMode) {
        const delF = document.createElement("button");
        delF.className = "delete-btn";
        delF.title = "Remove field";
        delF.innerHTML = `<i class="ti ti-x"></i>`;
        delF.addEventListener("click", e => {

            e.stopPropagation();
            const fIdx = parent.content.indexOf(data);
            parent.content.splice(fIdx, 1);
            
            // Update HTML
            fEl.remove();
            sepEl.remove();
            updatePreview();

            if(parent.content.length <= 0) {
                makeEmptyMessage(container);
            }
            
        });
        fEl.appendChild(delF);

        fEl.addEventListener("dragstart", e => {

            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") 
                return;

            dragSrc = data; dragSrcParent = parent;
            dragSrcElem = fEl; dragSrcSepElem = sepEl;
            
            setTimeout(() => fEl.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
            e.stopPropagation();
            
        });
        fEl.addEventListener("dragend", () => {
            fEl.classList.remove("dragging"); 
        });
        fEl.addEventListener("dragover", e => {

            if (dragSrcParent === parent && dragSrc !== data) {

                e.preventDefault(); 
                e.stopPropagation(); 
                e.dataTransfer.dropEffect = "move";

                fEl.classList.add("drop-indicator");
            }
            
        });
        fEl.addEventListener("dragleave", () => fEl.classList.remove("drop-indicator"));
        fEl.addEventListener("drop", e => {

            e.preventDefault(); 
            e.stopPropagation();

            if (dragSrcParent === parent && dragSrc !== data) {
                const fromIdx = dragSrcParent.content.indexOf(dragSrc);
                const toIdx = dragSrcParent.content.indexOf(data);
                const [moved] = dragSrcParent.content.splice(fromIdx, 1);
                parent.content.splice(toIdx, 0, moved);
                
                // Update HTML
                if(fromIdx < toIdx) {
                    sepEl.insertAdjacentElement('afterend',dragSrcElem);
                } else {
                    fEl.insertAdjacentElement('beforebegin',dragSrcElem);
                }
                dragSrcElem.insertAdjacentElement('afterend', dragSrcSepElem);
                updatePreview();
            }
            dragSrcElem = null;
            dragSrcSepElem = null;
            dragSrcParent = null;
            dragSrc = null;
            fEl.classList.remove("drop-indicator");
        });
    }

    container.appendChild(fEl);
    container.appendChild(sepEl);
    return fEl;
}

/**
 * @param {string|{label:string,type:string,content:Array}} secData Section label or section object loaded from file
 * @param {{label:string,type:string,content:Array}} parent 
 * @param {HTMLDivElement} container 
 * @returns @returns {HTMLDivElement}
 */
function makeSection(secData, parent, container) {
    const data = (() => {
        let sd = null;
        if (secData instanceof Object) {
            sd = secData;
        } else if (typeof(secData) === "string") {
            sd = {
                label: secData,
                type:"section",
                content:[]
            }
            parent.content.push(sd);
        }
        return sd;
    })();
    if (data == null) return;

    const sepEl = document.createElement("div");
    sepEl.classList.add("seperator");

    const secEl = document.createElement("div");
    secEl.className = "section";
    secEl.dataset.sid = data.id;

    const hdr = document.createElement("div");
    hdr.className = "section-header";

    if(!previewMode) {
        const handle = document.createElement("i");
        handle.draggable = !previewMode;
        handle.className = "ti ti-grip-vertical drag-handle";
        handle.setAttribute("aria-hidden","true");

        hdr.appendChild(handle);
    }

    const expander = document.createElement("i");
    if(data.expanded ?? true) {
        expander.className = "ti ti-caret-up section-expander";
    } else {
        expander.className = "ti ti-caret-down section-expander";
    }
    expander.addEventListener("click", ev => {
        data.expanded = !(data.expanded ?? true);

        if(data.expanded) {
            expander.className = "ti ti-caret-up section-expander";
            fieldList.classList.remove("hidden");
            addRow?.classList?.remove("hidden");
        } else {
            expander.className = "ti ti-caret-down section-expander";
            fieldList.classList.add("hidden");
            addRow?.classList?.add("hidden");
        }
    });
    hdr.append(expander);

    const titleInp = document.createElement("input");
    titleInp.className = "section-title";
    titleInp.value = data.label;
    titleInp.disabled = previewMode;
    titleInp.addEventListener("input", e => {
        data.label = e.target.value; 
        updatePreview(); 
    });
    hdr.appendChild(titleInp);

    if(!previewMode) {
        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.title = "Remove section";
        delBtn.innerHTML = `<i class="ti ti-x"></i>`;
        // delBtn.style.display = editMode ? "none" : "";
        delBtn.addEventListener("click", () => {
            const secIdx = parent.content.indexOf(data);
            parent.content.splice(secIdx, 1);
            // Update HTML
            secEl.remove();
            sepEl.remove();
            updatePreview();

            if(parent.content.length <= 0) {
                makeEmptyMessage(container);
            }
        });
        hdr.appendChild(delBtn);

        hdr.addEventListener("dragstart", e => {

            dragSrc = data; dragSrcParent = parent;
            dragSrcElem = secEl; dragSrcSepElem = sepEl;
            setTimeout(() => secEl.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
                
        });
        hdr.addEventListener("dragend", () => {
            
            secEl.classList.remove("dragging"); 
        });
        hdr.addEventListener("dragover", e => {

            if (dragSrcParent === parent && dragSrc !== data) {
                e.preventDefault(); 
                e.dataTransfer.dropEffect = "move";

                hdr.classList.add("drop-indicator");
            }
                
        });
        hdr.addEventListener("dragleave", () => hdr.classList.remove("drop-indicator"));
        hdr.addEventListener("drop", e => {

            e.preventDefault();
            if (dragSrcParent === parent && dragSrc !== data) {
                const fromIdx = dragSrcParent.content.indexOf(dragSrc);
                const toIdx = dragSrcParent.content.indexOf(data);
                const [moved] = dragSrcParent.content.splice(fromIdx, 1);
                parent.content.splice(toIdx, 0, moved);
                
                // Update HTML
                if(fromIdx < toIdx) {
                    sepEl.insertAdjacentElement('afterend',dragSrcElem);
                } else {
                    secEl.insertAdjacentElement('beforebegin',dragSrcElem);
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

    const fieldList = document.createElement("div");
    fieldList.className = "field-list";
    fieldList.style.flexDirection = data.direction ?? "row";
    if(!(data.expanded ?? true)) {
        fieldList.classList.add("hidden")
    }

    if (data.content.length === 0) {
        makeEmptyMessage(fieldList);
    }

    data.content.forEach((field, fi) => {
        makeContainer(field,field.type ?? "section",data,fieldList);
    });

    secEl.appendChild(hdr);
    secEl.appendChild(fieldList);

    let addRow = null
    if(!previewMode) {
        addRow = document.createElement("div");
        addRow.className = "add-field-row";
        if(!(data.expanded ?? true)) {
            addRow.classList.add("hidden");
        }

        const labelInp = document.createElement("input");
        labelInp.placeholder = "Field label…";

        const typeSelect = document.createElement("select");
        ["text","textarea","number","checkbox","section"].forEach(t => {

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
            const em = secEl.querySelector(":scope > .field-list > .empty-msg");
            if (em != null) {
                em.remove();
            }

            if(typeSelect.value !== "section") {
                // Update HTML
                makeField(label,typeSelect.value,data,fieldList);
            } else {
                // Update HTML
                makeSection(label,data,fieldList);
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

        secEl.appendChild(addRow);
    }
    
    container.appendChild(secEl);
    container.appendChild(sepEl);
    return secEl;
}

function render() {

    const list = document.getElementById("section-list");
    list.innerHTML = "";

    sheet.content.forEach((sec, si) => {
        makeContainer(sec,sec.type ?? "section",sheet,list)
    });

    updatePreview();

}

const sectionLabelInp = document.getElementById("new-section-name");
const sectionList = document.getElementById("section-list");
const sectionAddBtn = document.getElementById("btn-add-section");
sectionAddBtn.addEventListener("click", () => {
    if(sectionLabelInp == null || sectionList == null) return;

    const label = sectionLabelInp.value.trim() || "New section";

    // Update HTML
    makeSection(label,sheet,sectionList);

    sectionLabelInp.value = ""; 

});

document.getElementById("new-section-name").addEventListener("keydown", e => {

    if (e.key === "Enter") 
        document.getElementById("btn-add-section").click();

});

document.getElementById("btn-save").addEventListener("click", () => {

    const blob = new Blob([JSON.stringify(sheet, null, 2)], {
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

            const parsed = JSON.parse(ev.target.result);
            if (!parsed.content) {
                alert("Invalid character sheet JSON."); return; 
            }
            render();
            
        } catch {
            alert("Could not parse JSON file."); 
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
    render();
});
if(previewMode) {
    sectionLabelInp.classList.add("hidden");
    sectionAddBtn.classList.add("hidden");
}

function updatePreview() {

    if (!previewVisible) return;
        document.getElementById("json-preview").textContent = JSON.stringify(sheet, null, 2);

}

render();
        