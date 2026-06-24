

let sheet = {
    [Symbol.for("okeys")]:["Combat","Ability Scores"],
    "Combat":{
        "HP":30
    },
    "Ability Scores": {
        [Symbol.for("okeys")]:["Strength","Constitution","Charisma"],
        "Strength":{
            "score":10,
            [Symbol.for("okeys")]:["score"],
        },
        "Constitution":{
            "score":15,
            [Symbol.for("okeys")]:["score"],
        },
        "Charisma":{
            "score":18,
            [Symbol.for("okeys")]:["score"],
        }
    }
}

function getItemWithOkey(obj, index){
    return obj[obj[Symbol.for("okeys")][index]];
}

function getItemNameWithOkey(obj, index){
    return obj[Symbol.for("okeys")][index];
}

function getOkeyWithItemName(obj, name){
    return obj[Symbol.for("okeys")].indexOf(name);
}

function moveItemWithOkeys(obj, oldIndex, newIndex){
    const movingItem = obj[Symbol.for("okeys")].splice(oldIndex,1)[0];
    obj[Symbol.for("okeys")].splice(newIndex,0,movingItem);
    return movingItem;
}

function moveItemWithItemNames(obj, fromItemName, toItemName){
    moveItemWithOkeys(
        obj,
        getOkeyWithItemName(obj,fromItemName),
        getOkeyWithItemName(obj,toItemName),
    )
}

function moveItemToOkey(obj, itemName, newIndex){
    moveItemWithOkeys(
        obj,
        getOkeyWithItemName(obj,fromItemName),
        newIndex,
    )
}

function okeyObjToList(obj){
    let list = [];
    for (const okey of obj[Symbol.for("okeys")]){
        list.push(obj[okey]);
    }
    return list;
}



moveItemWithOkeys(sheet, 0, 1);
moveItemWithItemNames(sheet["Ability Scores"], "Strength","Charisma");
console.log(okeyObjToList(sheet));
console.log(okeyObjToList(sheet["Ability Scores"]));
