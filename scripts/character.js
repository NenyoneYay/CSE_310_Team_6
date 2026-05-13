var newCharacterButton = document.getElementById("new_character_button");
var sheetSelectButton_character = document.getElementById("sheet_select_button_character");
var sheetSelectButton_information = document.getElementById("sheet_select_button_information");
var sheetSelectButton_spells = document.getElementById("sheet_select_button_spells");
var sheet_character = document.getElementById("sheet_character");
var sheet_information = document.getElementById("sheet_information");
var sheet_spells = document.getElementById("sheet_spells");


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

