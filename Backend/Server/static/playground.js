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
    for (const sec of sheet.sections) {

        if (seen.has(sec.id)) 
            sec.id = genId();
        else {
            seen.add(sec.id); 
            idRegistry.add(sec.id); 
        }

        for (const field of sec.fields) {

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
    sections: [
        {
            id: null, 
            label: "Basics", 
            fields: [
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
            fields: [
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
            fields: [
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

for (const sec of sheet.sections) {

    sec.id = genId();
    for (const field of sec.fields) 
        field.id = genId();

}

let dragSrc = null, dragType = null, dragSrcSection = null;

function makeFieldInput(field) {

    if (field.type === "textarea") {

        const ta = document.createElement("textarea");
        ta.className = "field-textarea";
        ta.value = field.value || "";
        ta.rows = 2;
        ta.addEventListener("input", e => {
            field.value = e.target.value; 
            updatePreview(); 
        });
        ta.addEventListener("mousedown", e => e.stopPropagation());
        return ta;
        
    }
    else if (field.type === "checkbox") {

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "field-input";
        cb.checked = field.value === true || field.value === "true";
        cb.addEventListener("change", e => {
            field.value = e.target.checked; 
            updatePreview(); 
        });
        cb.addEventListener("mousedown", e => e.stopPropagation());
        return cb;
        
    }
    const inp = document.createElement("input");
    inp.type = field.type === "number" ? "number" : "text";
    inp.className = "field-input";
    inp.value = field.value || "";
    inp.placeholder = field.type === "number" ? "0" : "—";
    inp.addEventListener("input", e => {
        field.value = e.target.value; updatePreview(); 
    });
    // prevent drag from firing when clicking into the input
    inp.addEventListener("mousedown", e => e.stopPropagation());
    return inp;
}

function render() {

    const list = document.getElementById("section-list");
    list.innerHTML = "";

    sheet.sections.forEach((sec, si) => {

        const secEl = document.createElement("div");
        secEl.className = "section";
        secEl.dataset.sid = sec.id;

        const hdr = document.createElement("div");
        hdr.className = "section-header";
        hdr.innerHTML = `<i class="ti ti-grip-vertical drag-handle" aria-hidden="true" draggable="${!editMode}"></i>`;

        const titleInp = document.createElement("input");
        titleInp.className = "section-title";
        titleInp.value = sec.label;
        titleInp.addEventListener("mousedown", e => e.stopPropagation());
        titleInp.addEventListener("input", e => {
            sec.label = e.target.value; 
            updatePreview(); 
        });
        hdr.appendChild(titleInp);

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.title = "Remove section";
        delBtn.innerHTML = `<i class="ti ti-x"></i>`;
        delBtn.style.display = editMode ? "none" : "";
        delBtn.addEventListener("click", () => {
            releaseId(sec.id);
            sec.fields.forEach(f => releaseId(f.id));
            sheet.sections.splice(si, 1);
            render(); 
            updatePreview();
        });
        hdr.appendChild(delBtn);

        hdr.addEventListener("dragstart", e => {

            dragType = "section"; dragSrc = sec.id;
            setTimeout(() => secEl.classList.add("dragging"), 0);
            e.dataTransfer.effectAllowed = "move";
                
        });
        hdr.addEventListener("dragend", () => {
            
            secEl.classList.remove("dragging"); 
        });
        secEl.addEventListener("dragover", e => {

            if (dragType !== "section") 
                return;

            e.preventDefault(); 
            e.dataTransfer.dropEffect = "move";

            secEl.classList.add("drop-indicator");
                
        });
        secEl.addEventListener("dragleave", () => secEl.classList.remove("drop-indicator"));
        secEl.addEventListener("drop", e => {

            e.preventDefault();
            if (dragType !== "section" || dragSrc === sec.id) 
                return;

            const fromIdx = sheet.sections.findIndex(s => s.id === dragSrc);
            const [moved] = sheet.sections.splice(fromIdx, 1);
            sheet.sections.splice(si, 0, moved);
            
            // TODO: update HTML instead of re-render
            
            render(); updatePreview();
                
        });

        const fieldList = document.createElement("div");
        fieldList.className = "field-list";

        if (sec.fields.length === 0) {

            const em = document.createElement("div");
            em.className = "empty-msg";
            em.textContent = "No fields yet — add one below.";
            fieldList.appendChild(em);
                
        }

        sec.fields.forEach((field, fi) => {

            const fEl = document.createElement("div");
            fEl.className = "field"; fEl.dataset.fid = field.id;

            const handle = document.createElement("i");
            handle.draggable = !editMode;
            handle.className = "ti ti-grip-vertical drag-handle";
            handle.setAttribute("aria-hidden","true");

            const inner = document.createElement("div");
            inner.className = "field-inner";

            const lbl = document.createElement("span");
            lbl.className = "field-label";
            lbl.textContent = field.label;

            const inputEl = makeFieldInput(field);

            inner.appendChild(lbl);
            inner.appendChild(inputEl);

            const badge = document.createElement("span");
            badge.className = "field-type-badge";
            badge.textContent = field.type;

            const delF = document.createElement("button");
            delF.className = "delete-btn";
            delF.title = "Remove field";
            delF.innerHTML = `<i class="ti ti-x"></i>`;
            delF.style.display = editMode ? "none" : "";
            delF.addEventListener("click", e => {

                e.stopPropagation();
                releaseId(field.id);
                sec.fields.splice(fi, 1);
                render(); updatePreview();
                
            });

            fEl.appendChild(handle);
            fEl.appendChild(inner);
            fEl.appendChild(badge);
            fEl.appendChild(delF);

            fEl.addEventListener("dragstart", e => {

                if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") 
                    return;

                dragType = "field"; dragSrc = field.id; dragSrcSection = sec.id;
                setTimeout(() => fEl.classList.add("dragging"), 0);
                e.dataTransfer.effectAllowed = "move";
                e.stopPropagation();
                
            });
            fEl.addEventListener("dragend", () => {
                fEl.classList.remove("dragging"); 
            });
            fEl.addEventListener("dragover", e => {

                if (dragType !== "field") 
                    return;

                e.preventDefault(); 
                e.stopPropagation(); 
                e.dataTransfer.dropEffect = "move";

                fEl.classList.add("drop-indicator");
                
            });
            fEl.addEventListener("dragleave", () => fEl.classList.remove("drop-indicator"));
            fEl.addEventListener("drop", e => {

                e.preventDefault(); 
                e.stopPropagation();

                if (dragType !== "field" || dragSrc === field.id) 
                    return;

                const srcSec = sheet.sections.find(s => s.id === dragSrcSection);
                const fromIdx = srcSec.fields.findIndex(f => f.id === dragSrc);
                const [moved] = srcSec.fields.splice(fromIdx, 1);
                sec.fields.splice(fi, 0, moved);

                // TODO: Update HTML instead of re-render

                render(); 
                updatePreview();
                
            });

            fieldList.appendChild(fEl);
                
        });

        const addRow = document.createElement("div");
        addRow.className = "add-field-row";

        const labelInp = document.createElement("input");
        labelInp.placeholder = "Field label…";

        const typeSelect = document.createElement("select");
        ["text","number","textarea","checkbox"].forEach(t => {

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
            sec.fields.push({
                id: genId(), 
                label, 
                type: typeSelect.value, 
                value: "" 
            });
            labelInp.value = "";

            // TODO: Update HTML instead of re-render

            render(); updatePreview();
            
        });
        labelInp.addEventListener("keydown", e => {
            if (e.key === "Enter") addBtn.click(); 
        });

        addRow.appendChild(labelInp);
        addRow.appendChild(typeSelect);
        addRow.appendChild(addBtn);

        secEl.appendChild(hdr);
        secEl.appendChild(fieldList);
        secEl.appendChild(addRow);
        list.appendChild(secEl);
        
    });

    updatePreview();

}

document.getElementById("btn-add-section").addEventListener("click", () => {

    const inp = document.getElementById("new-section-name");
    const label = inp.value.trim() || "New section";
    sheet.sections.push({
        id: genId(), 
        label, 
        fields: [] 
    });

    inp.value = ""; 

    // TODO: update HTML instead of re-render
    render();

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
            if (!parsed.sections) {
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
    el.style.display = previewVisible ? "block" : "none";
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
    
    // Re-rendering is probably fine here
    render();
});

function updatePreview() {

    if (!previewVisible) return;
        document.getElementById("json-preview").textContent = JSON.stringify(sheet, null, 2);

}

render();
        