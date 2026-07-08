// Plans are to create an override css sheet on the super. Changes will be made to this file, so the revert button can then just clear out the override


document.getElementById("commit_button").addEventListener("click", () =>{
    event.preventDefault();
    var color = document.getElementById("primary_bg_color_field").value;
    console.log(color);
    if(color.startsWith("#")){
        document.body.style.backgroundColor = color;
    }
    else{
    document.body.style.backgroundColor = "#" + color;
    }
});