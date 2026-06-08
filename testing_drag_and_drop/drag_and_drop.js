

const zotePrecepts = [
    "Precept One: 'Always Win Your Battles'.",
    "Precept Two: 'Never Let Them Laugh at You'.",
    "Precept Three: 'Always Be Rested'.",
    "Precept Four: 'Forget Your Past'."
]

let draggableItems = [];
let draggableRects = [];
let containers = document.querySelectorAll(".grid_container");

/**
 * 
 * @param {Rect2} rect2 
 * @param {String} preceptStr
 * @param {HTMLElement} container
 */
function createZotePreceptDraggable(rect2, preceptStr, container){

    const domParser = new DOMParser();
    const parsedHTML = domParser.parseFromString(`<div class="draggable_item" draggable="true" style="grid-column: ${rect2.pos.x + 1} / ${rect2.pos.x + 1 + rect2.size.x}; grid-row: ${rect2.pos.y + 1} / ${rect2.pos.y + 1 + rect2.size.y}"><img src="Zote.png" alt="Zote" draggable="false"> <p>${preceptStr}</p></div>`, "text/html");
    let element = parsedHTML.body.firstElementChild;

    draggableItems.push(element);
    draggableRects.push(rect2);

    container.appendChild(element)
}

createZotePreceptDraggable(new Rect2(new Vector2(0,0), new Vector2(1,1)), zotePrecepts[0], containers[0]);
createZotePreceptDraggable(new Rect2(new Vector2(1,0), new Vector2(1,1)), zotePrecepts[1], containers[0]);
createZotePreceptDraggable(new Rect2(new Vector2(0,1), new Vector2(2,2)), zotePrecepts[2], containers[0]);
createZotePreceptDraggable(new Rect2(new Vector2(0,0), new Vector2(2,1)), zotePrecepts[3], containers[1]);

draggableItems.forEach(draggableItem => {
    draggableItem.addEventListener("dragstart",() => {
        draggableItem.classList.add("dragging");
    })
    
    draggableItem.addEventListener("dragend",() => {
        draggableItem.classList.remove("dragging");
    })
})

containers.forEach(container => {
    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        const mousePos = new Vector2(e.clientX,e.clientY);
        const draggedItem = document.querySelector(".dragging");

        const rect = draggableRects[draggableItems.indexOf(draggedItem)]
        rect.pos = getCoord(container,draggedItem,mousePos);
        
        container.appendChild(draggedItem);
        draggedItem.style.gridColumn = `${rect.pos.x + 1} / ${rect.pos.x + 1 + rect.size.x}`;
        draggedItem.style.gridRow = `${rect.pos.y + 1} / ${rect.pos.y + 1 + rect.size.y}`;
        
    })
})

/**
 * 
 * @param {HTMLElement} container 
 * @param {HTMLElement} draggedItem 
 * @param {Vector2} mousePos 
 * @returns 
 */
function getCoord(container, draggedItem, mousePos) {
    const containerBox = container.getBoundingClientRect();
    const containerPos = new Vector2(containerBox.left, containerBox.top);
    const containerSize = new Vector2(containerBox.width, containerBox.height);

    const grid = new Grid2(containerPos, containerSize, new Vector2(2,3))

    return grid.GetClosestCoord(mousePos);

}