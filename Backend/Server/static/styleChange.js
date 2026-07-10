// Plans are to create an override css sheet on the super. Changes will be made to this file, so the revert button can then just clear out the override
//Colors
const bg_color_field = document.getElementById("primary_bg_color_field"); 
const header_color_field = document.getElementById("header_bg_color_field");
const word_color_field = document.getElementById("primary_font_color_field");
// Fonts
const header_font_field = document.getElementById("header_font_field");
const text_font_field = document.getElementById("text_font_field");
//Scale
const text_scale = document.getElementById("font_scale_field");
document.getElementById("commit_button").addEventListener("click", () =>{
    var bg_color = bg_color_field.value;
    var word_color = word_color_field.value;
    var hbg_color = header_color_field.value;
    var hfont = header_font_field.value;
    var tfont = text_font_field.value;
    var scale = text_scale.value;
    
    event.preventDefault();
    if (color != ""){
        if(color.startsWith("#")){
            document.documentElement.style.setProperty('--primary-color', bg_color);
            document.documentElement.style.setProperty('--parchment-color', word_color);
        }
        else{
            document.documentElement.style.setProperty('--primary-color', '#' + bg_color);
            document.documentElement.style.setProperty('--parchment-color', '#' + word_color);
        }

    }
});

document.getElementById("revert_button").addEventListener("click", () =>{
    event.preventDefault();
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--parchment-color');

});

document.getElementById("clear_button").addEventListener("click", ()=>{
    event.preventDefault();
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--parchment-color');
    bg_color_field.value = '';
    word_color_field.value = '';
});