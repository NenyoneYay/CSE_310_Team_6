//Buttons
var newCharacterButton = document.getElementById("new_character_button");
var sheetSelectButton_character = document.getElementById("sheet_select_button_character");
var sheetSelectButton_information = document.getElementById("sheet_select_button_information");
var sheetSelectButton_spells = document.getElementById("sheet_select_button_spells");
//Divs
var sheet_character = document.getElementById("sheet_character");
var sheet_information = document.getElementById("sheet_information");
var sheet_spells = document.getElementById("sheet_spells");
var cantripContainer = document.getElementById("cantrip-container");
var spell1Container = document.getElementById("spell-container-level1");
var spellList = document.getElementsByClassName("spell");


var addCantripButton = document.getElementById("button_spell_addcantrip");

addCantripButton.addEventListener('click', addCantrip);
function addCantrip() {
  var spellText = prompt("I've been clicked!");
  if (spellText != null && spellText != ""){
    cantripContainer.innerHTML += `
    <div class="spell" draggable="true">
      <p>${spellText}</p>
    </div>
    `
    console.log(spellText);
  }
  console.log("All done!");
  addListenersToButtons();

}


function getClosestSpell(list,mouseY) {
  let closest = {dist:-1, elem:null};
  for (const spell of list) {
    const box = spell.getBoundingClientRect();
    const pos = (box.top + box.height / 2);
    const dist = pos - mouseY;
    if(dist > 0 && (closest.dist < 0 || dist < closest.dist)) {
      closest = {dist:dist,elem:spell};
    }
  }
  return closest.elem;
}

spell1Container.addEventListener("dragover", function(e){
  e.preventDefault();
  const selected = document.querySelector("#sheet_spells .dragging");
  if(selected == null) return;
  const afterSelected = selected.nextElementSibling;
  const otherSpells = spell1Container.querySelectorAll(".spell:not(.dragging)");
  const nextElem = getClosestSpell(otherSpells,e.clientY);
  if(nextElem !== afterSelected || selected.parentElement != spell1Container) {
    spell1Container.insertBefore(selected,nextElem);
  }
})
cantripContainer.addEventListener("dragover", function(e){
  e.preventDefault();
  const selected = document.querySelector("#sheet_spells .dragging");
  if(selected == null) return;
  const afterSelected = selected.nextElementSibling;
  const otherSpells = cantripContainer.querySelectorAll(".spell:not(.dragging)");
  const nextElem = getClosestSpell(otherSpells,e.clientY);
  if(nextElem !== afterSelected || selected.parentElement != cantripContainer) {
    cantripContainer.insertBefore(selected,nextElem);
  }
})

function addListenersToButtons() {
  for (spell of spellList) {
    spell.addEventListener("dragstart", function(e){
      e.target.classList.add("dragging");
      console.log(`Started dragging ${e.target.textContent.trim()}`)
    })
    spell.addEventListener("dragend", function(e){
      e.target.classList.remove("dragging");
      console.log(`Stopped dragging ${e.target.textContent.trim()}`)
    })
  }
}

addListenersToButtons()

sheetSelectButton_character.addEventListener('click', sheetSelectCharacter);
function sheetSelectCharacter() {
  // console.log("I been clicked!");
  sheet_character.classList.remove("hidden");
  sheet_information.classList.add("hidden");
  sheet_spells.classList.add("hidden");
}

sheetSelectButton_information.addEventListener('click', sheetSelectInformation);
function sheetSelectInformation() {
  // console.log("Info sheet been clicked");
  sheet_character.classList.add("hidden");
  sheet_information.classList.remove("hidden");
  sheet_spells.classList.add("hidden");
}

sheetSelectButton_spells.addEventListener('click', sheetSelectSpells)
function sheetSelectSpells() {
  // console.log("Spell button be clickered");
  sheet_character.classList.add("hidden");
  sheet_information.classList.add("hidden");
  sheet_spells.classList.remove("hidden");
}


newCharacterButton.addEventListener("click", openNewCharacterOptions());

