const idRegistry = new Set();

function genId() {

    let id;

    do {
        id = "id_" + Math.random().toString(36).slice(2, 9); 
    }
    while (idRegistry.has(id));

    idRegistry.add(id);
    return id;

}
function registerIds(sheet) {

    idRegistry.clear();
    const seen = new Set();
    for (const sec of sheet.content) {

        if (seen.has(sec.id)) 
            sec.id = genId();
        else {
            seen.add(sec.id); 
            idRegistry.add(sec.id); 
        }

        for (const field of sec.content) {

            if (seen.has(field.id)) 
                field.id = genId();
            else {
                seen.add(field.id); idRegistry.add(field.id); 
            }
    
        }

    }

}

function releaseId(id) {
    idRegistry.delete(id); 
}

let sheet = {

    meta: {
        name: "My Character", 
        system: "Custom", 
        version: "1" 
    },
    content: [
        {
            id: null, 
            type: "section",
            label: "Basics", 
            content: [
                {
                    id: null, 
                    label: "Name",  
                    type: "text",   
                    value: "" 
                },
                {
                    id: null, 
                    label: "Class", 
                    type: "text",   
                    value: "" 
                },
                {
                    id: null, 
                    label: "Level", 
                    type: "number", 
                    value: "1" 
                }
            ]
        },
        {
            id: null, 
            label: "Ability scores", 
            content: [
                {
                    id: null, 
                    label: "Strength",     
                    type: "number", 
                    value: "10" 
                },
                {
                    id: null, 
                    label: "Dexterity",    
                    type: "number", 
                    value: "10" 
                },
                {
                    id: null, 
                    label: "Constitution", 
                    type: "number", 
                    value: "10" 
                },
                {
                    id: null, 
                    label: "Intelligence", 
                    type: "number", 
                    value: "10" 
                },
                {
                    id: null, 
                    label: "Wisdom",       
                    type: "number", 
                    value: "10" 
                },
                {
                    id: null, 
                    label: "Charisma",     
                    type: "number", 
                    value: "10" 
                }
            ]
        },
        {
            id: null, 
            label: "Combat", 
            type: "section",
            content: [
                {
                    id: null, 
                    label: "HP",    
                    type: "number", 
                    value: "" 
                },
                {
                    id: null, 
                    label: "AC",    
                    type: "number", 
                    value: "" 
                },
                {
                    id: null, 
                    label: "Speed", 
                    type: "text",   
                    value: "30ft" 
                }
            ]
        }
    ]

};

for (const sec of sheet.content) {

    sec.id = genId();
    for (const field of sec.content) 
        field.id = genId();

}

let dragSrc = null, dragType = null, dragSrcParent = null;
let dragSrcElem = null, dragSrcSepElem = null;

function makeEmptyMessage(container) {
    const em = document.createElement("div");
    em.className = "empty-msg";
    em.textContent = "No content yet — add one below.";
    container.appendChild(em);
    return em;
}

function makeFieldInput(fieldData) {

    if (fieldData.type === "textarea") {

        const ta = document.createElement("textarea");
        ta.className = "field-textarea";
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
    inp.placeholder = fieldData.type === "number" ? "0" : "—";
    inp.addEventListener("input", e => {
        fieldData.value = e.target.value; updatePreview(); 
    });
    // prevent drag from firing when clicking into the input
    inp.addEventListener("mousedown", e => e.stopPropagation());
    return inp;
}

function makeContainer(label, type, parent, parentEl) {
    if(type === "section") {
        makeSection(label,parent,parentEl);
    } else {
        makeField(label,type,parent,parentEl);
    }
}

function makeField(label, type, parent, container) {
    const data = (() => {
        let fd = null;
        if (label instanceof Object) {
            fd = label;
        } else if (typeof(label) === "string") {
            fd = {
                id: genId(),
                label,
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

    if(!editMode) {
        const handle = document.createElement("i");
        handle.draggable = !editMode;
        handle.className = "ti ti-grip-vertical drag-handle";
        handle.setAttribute("aria-hidden","true");

        fEl.appendChild(handle);
    }

    const inner = document.createElement("div");
    inner.className = "field-inner";

    const lbl = document.createElement("span");
    lbl.className = "field-label";
    lbl.textContent = data.label;

    const inputEl = makeFieldInput(data);

    inner.appendChild(lbl);
    inner.appendChild(inputEl);

    const badge = document.createElement("span");
    badge.className = "field-type-badge";
    badge.textContent = data.type;

    const delF = document.createElement("button");
    delF.className = "delete-btn";
    delF.title = "Remove field";
    delF.innerHTML = `<i class="ti ti-x"></i>`;
    if(editMode) {
        delF.classList.add("hidden")
    } else {
        delF.classList.remove("hidden")
    }
    // delF.style.display = editMode ? "none" : "";
    delF.addEventListener("click", e => {

        e.stopPropagation();
        const fIdx = parent.content.findIndex(f => f.id === data.id);
        releaseId(data.id);
        parent.content.splice(fIdx, 1);
        fEl.remove();

        if(parent.content.length <= 0) {
            makeEmptyMessage(container);
        }

        updatePreview();
        
    });

    
    fEl.appendChild(inner);
    fEl.appendChild(badge);
    fEl.appendChild(delF);
    if(!editMode) {
        fEl.addEventListener("dragstart", e => {

            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") 
                return;

            dragType = "field"; dragSrc = data; dragSrcParent = parent;
            dragSrcElem = fEl; dragSrcSepElem = sepEl;
            
            setTimeout(() => fEl.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
            e.stopPropagation();
            
        });
        fEl.addEventListener("dragend", () => {
            fEl.classList.remove("dragging"); 
        });
        fEl.addEventListener("dragover", e => {

            if (dragSrcParent === parent && dragSrc !== data.id) {

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

            if (dragSrcParent === parent && dragSrc !== data.id) {
                const fromIdx = dragSrcParent.content.findIndex(f => f.id === dragSrc.id);
                const toIdx = dragSrcParent.content.findIndex(f => f.id === data.id );
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
            dragType = null;
            dragSrc = null;
            fEl.classList.remove("drop-indicator");
        });
    }

    container.appendChild(fEl);
    container.appendChild(sepEl);
    return fEl;
}

function makeSection(label, parent, container) {
    const data = (() => {
        let sd = null;
        if (label instanceof Object) {
            sd = label;
        } else if (typeof(label) === "string") {
            sd = {
                id: genId(),
                label,
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

    if(!editMode) {
        const handle = document.createElement("i");
        handle.draggable = !editMode;
        handle.className = "ti ti-grip-vertical drag-handle";
        handle.setAttribute("aria-hidden","true");

        hdr.appendChild(handle);
    }

    const titleInp = document.createElement("input");
    titleInp.className = "section-title";
    titleInp.value = data.label;
    titleInp.addEventListener("mousedown", e => e.stopPropagation());
    titleInp.addEventListener("input", e => {
        data.label = e.target.value; 
        updatePreview(); 
    });
    hdr.appendChild(titleInp);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.title = "Remove section";
    delBtn.innerHTML = `<i class="ti ti-x"></i>`;
    if(editMode) {
        delBtn.classList.add("hidden")
    } else {
        delBtn.classList.remove("hidden")
    }
    // delBtn.style.display = editMode ? "none" : "";
    delBtn.addEventListener("click", () => {
        data.content.forEach(f => releaseId(f.id));
        const secIdx = parent.content.findIndex(s => s.id === data.id);
        parent.content.splice(secIdx, 1);
        releaseId(data.id);
        // Update HTML
        secEl.remove();
        updatePreview();
    });
    hdr.appendChild(delBtn);

    if(!editMode) {
        hdr.addEventListener("dragstart", e => {

            dragType = "section"; dragSrc = data; dragSrcParent = parent;
            dragSrcElem = secEl; dragSrcSepElem = sepEl;
            setTimeout(() => secEl.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
                
        });
        hdr.addEventListener("dragend", () => {
            
            secEl.classList.remove("dragging"); 
        });
        hdr.addEventListener("dragover", e => {

            if (dragSrcParent === parent && dragSrc !== data.id) {
                e.preventDefault(); 
                e.dataTransfer.dropEffect = "move";

                hdr.classList.add("drop-indicator");
            }
                
        });
        hdr.addEventListener("dragleave", () => hdr.classList.remove("drop-indicator"));
        hdr.addEventListener("drop", e => {

            e.preventDefault();
            if (dragSrcParent === parent && dragSrc !== data.id) {
                const fromIdx = dragSrcParent.content.findIndex(s => s.id === dragSrc.id);
                const toIdx = dragSrcParent.content.findIndex(s => s.id === data.id );
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
            dragType = null;
            dragSrc = null;
            hdr.classList.remove("drop-indicator");
        });
    }

    const fieldList = document.createElement("div");
    fieldList.className = "field-list";
    fieldList.style.flexDirection = data.direction ?? "row";

    if (data.content.length === 0) {
        makeEmptyMessage(fieldList);
    }

    data.content.forEach((field, fi) => {
        makeContainer(field,field.type ?? "section",data,fieldList);
    });

    secEl.appendChild(hdr);
    secEl.appendChild(fieldList);

    if(!editMode) {
        const addRow = document.createElement("div");
        addRow.className = "add-field-row";

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
            registerIds(parsed); sheet = parsed; 
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
let editMode = false;
const modeBtn = document.getElementById("btn-mode");
modeBtn.addEventListener("click", () => {
    editMode = !editMode;
    modeBtn.innerHTML = editMode
        ? `<i class="ti ti-pencil-off"></i> Edit mode`
        : `<i class="ti ti-pencil"></i> Edit mode`;
    
    if(editMode) {
        sectionLabelInp.classList.add("hidden");
        sectionAddBtn.classList.add("hidden");
    } else {
        sectionLabelInp.classList.remove("hidden");
        sectionAddBtn.classList.remove("hidden");
    }
    
    // Re-rendering is probably fine here
    render();
});

function updatePreview() {

    if (!previewVisible) return;
        document.getElementById("json-preview").textContent = JSON.stringify(sheet, null, 2);

}

render();
        