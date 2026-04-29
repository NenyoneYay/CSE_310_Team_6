var newCharacterButton = document.getElementById("new_character_button");
var characterOptionsModal = document.getElementById("options_modal");
var span = document.getElementsByClassName("close")[0];


newCharacterButton.addEventListener("click", openNewCharacterOptions());


function openNewCharacterOptions() {
    characterOptionsModal.style.display = "block";
    return;
}
span.onclick = function() {
  modal.style.display = "none";
}

window.onclick = function(event) {
  if (event.target == modal) {
    characterOptionsModal.style.display = "none";
  }
}