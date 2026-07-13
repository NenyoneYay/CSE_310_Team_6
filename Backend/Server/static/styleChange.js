// Plans are to create an override css sheet on the super. Changes will be made to this file, so the revert button can then just clear out the override
//Colors
const bg_color_field = document.getElementById("primary_bg_color_field"); 
const header_color_field = document.getElementById("header_bg_color_field");
const word_color_field = document.getElementById("primary_font_color_field");
// Fonts
const header_font_field = document.getElementById("header_font_field");
// const text_font_field = document.getElementById("text_font_field");
//Scale
const text_scale = document.getElementById("font_scale_field");

document.getElementById("commit_button").addEventListener("click", () =>{
    event.preventDefault();
    // var bg_color = bg_color_field.value;
    // var word_color = word_color_field.value;
    // var hbg_color = header_color_field.value;
    // var hfont = header_font_field.value;
    // var tfont = text_font_field.value;
    // var scale = text_scale.value;
    
    const color_changes = [bg_color_field, header_color_field, word_color_field];
    const font_changes = [ header_font_field];


    for(const item of color_changes){
        if (item.value != ""){ 
            console.log(item);
            if(item.value.startsWith("#")){
                if(item == bg_color_field){
                    document.documentElement.style.setProperty('--primary-color', item.value);
                }
                else if(item == header_color_field){
                    document.documentElement.style.setProperty('--ivy', item.value);
                }
                else if(item == word_color_field){
                    document.documentElement.style.setProperty('--parchment-color', item.value);
                }
                // document.documentElement.style.setProperty('--parchment-color', word_color);
            }
            else{
                if(item == bg_color_field){
                    document.documentElement.style.setProperty('--primary-color', '#' + item.value);
                }
                else if(item == header_color_field){
                    document.documentElement.style.setProperty('--ivy','#' +  item.value);
                }
                else if(item == word_color_field){
                    document.documentElement.style.setProperty('--parchment-color','#' +  item.value);
                }
                // document.documentElement.style.setProperty('--parchment-color', '#' + word_color);
            }
    
        }
        
        else{
            continue; 
        }

    }
    
    for (const item of font_changes){
        if (item.value != ''){
            document.documentElement.style.setProperty('--heading-font', item.value);
        }
    }
});

document.getElementById("revert_button").addEventListener("click", () =>{
    event.preventDefault();
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--parchment-color');
    document.documentElement.style.removeProperty('--ivy');
    document.documentElement.style.removeProperty('--heading-font');

});

document.getElementById("clear_button").addEventListener("click", ()=>{
    event.preventDefault();
    document.documentElement.style.removeProperty('--primary-color');
    document.documentElement.style.removeProperty('--parchment-color');
    document.documentElement.style.removeProperty('--ivy');
    document.documentElement.style.removeProperty('--heading-font');
    
    bg_color_field.value = '';
    header_color_field.value = '';
    word_color_field.value = '';
    header_font_field.value = '';
    // text_font_field.value = '';
    text_scale.value = '';
});