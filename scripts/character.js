var newCharacterButton = document.getElementById("new_character_button");
var sheetSelectButton_character = document.getElementById("sheet_select_button_character");
var sheetSelectButton_information = document.getElementById("sheet_select_button_information");
var sheetSelectButton_spells = document.getElementById("sheet_select_button_spells");
var sheet_character = document.getElementById("sheet_character");
var sheet_information = document.getElementById("sheet_information");
var sheet_spells = document.getElementById("sheet_spells");

var spellList = document.getElementsByClassName("spell");
var cantripContainer = document.getElementById("cantrip-container");
var spell1Container = document.getElementById("spell-container-level1");

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
  if(nextElem !== afterSelected) {
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
  if(nextElem !== afterSelected) {
    cantripContainer.insertBefore(selected,nextElem);
  }
})

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

sheetSelectButton_character.addEventListener('click', sheetSelectCharacter);
function sheetSelectCharacter() {
  console.log("I been clicked!");
  sheet_character.classList.remove("hidden");
  sheet_information.classList.add("hidden");
  sheet_spells.classList.add("hidden");
}

sheetSelectButton_information.addEventListener('click', sheetSelectInformation);
function sheetSelectInformation() {
  console.log("Info sheet been clicked");
  sheet_character.classList.add("hidden");
  sheet_information.classList.remove("hidden");
  sheet_spells.classList.add("hidden");
}

sheetSelectButton_spells.addEventListener('click', sheetSelectSpells)
function sheetSelectSpells() {
  console.log("Spell button be clickered");
  sheet_character.classList.add("hidden");
  sheet_information.classList.add("hidden");
  sheet_spells.classList.remove("hidden");
}


newCharacterButton.addEventListener("click", openNewCharacterOptions());

