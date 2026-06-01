let draggableItems = document.querySelectorAll(".draggable_item");
let containers = document.querySelectorAll(".grid_container");

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
        const gridCoord = getCoord(container,draggedItem,mousePos);
        
        container.appendChild(draggedItem);
        draggedItem.style.gridColumn = `${gridCoord.x + 1} / ${gridCoord.x + 2}`;
        draggedItem.style.gridRow = `${gridCoord.y + 1} / ${gridCoord.y + 2}`;
        
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