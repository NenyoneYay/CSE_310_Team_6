// Plans are to create an override css sheet on the super. Changes will be made to this file, so the revert button can then just clear out the override
const bg_color_field = document.getElementById("primary_bg_color_field"); 

document.getElementById("commit_button").addEventListener("click", () =>{
    var color = bg_color_field.value;
    event.preventDefault();
    if (color != ""){
        if(color.startsWith("#")){
            document.documentElement.style.setProperty('--primary-color', color);
        }
        else{
            document.documentElement.style.setProperty('--primary-color', '#' + color);
        }

    }
});

document.getElementById("revert_button").addEventListener("click", () =>{
    event.preventDefault();
    document.documentElement.style.removeProperty('--primary-color');
    bg_color_field.value = '';

});