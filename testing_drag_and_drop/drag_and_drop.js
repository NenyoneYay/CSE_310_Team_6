let draggableItems = document.querySelectorAll(".draggable_item");
let containers = document.querySelectorAll(".container");

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
        const draggedItem = document.querySelector(".dragging");
        const afterElement = getDragAfterElement(container,draggedItem,e.clientY)
        if (afterElement != null){
            container.insertBefore(draggedItem, afterElement)
        }   else{
            container.appendChild(draggedItem);
        }
    })
})

function getDragAfterElement(container, draggedItem, y) {
    const containerDraggableItems = container.querySelectorAll(".draggable_item")
    const draggableElements = []
    for (item of containerDraggableItems) if (item != draggedItem) draggableElements.push(item);
    
    return draggableElements.reduce((closest, child) => {
        const boundingBox = child.getBoundingClientRect();
        const offset = y - boundingBox.top - boundingBox.height / 2;
        if (offset < 0 && offset > closest.offset){
            return { offset: offset, element: child}
        }
        else {
            return closest
        }
        
    }, { offset: Number.NEGATIVE_INFINITY }).element

}