import {Character} from "./CharacterEngine.js";
import {EventBus} from "./EventBus.js";
import {Path} from "./Path.js";

/** @type {(Character|null)} */
var loadedChar = null;
var saveFileName = null;

/**
 * 
 * @param {InputEvent} ev 
 * @returns 
 */
async function readSingleFile(ev) {
    const errElement = document.getElementById('error-content');
    errElement.textContent = '';

    /** @type {File} */
    const file = ev.target.files[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        let contents = e.target.result;
        displayContents(contents);
        saveFileName = file.name;
    };
    reader.readAsText(file);
}  

function clearFile(ev) {
    const errElement = document.getElementById('error-content');
    const fileElement = document.getElementById('file-input');
    const contentElement = document.getElementById('html-content')
    errElement.textContent = '';
    fileElement.value = '';
    loadedChar?.destroy();
    loadedChar = null;
    saveFileName = null;
    document.getElementById("save-button").classList.add("hidden");
    contentElement.innerHTML = '';
}

function displayContents(contents) {
    try {
        if(loadedChar == null)
            loadedChar = new Character(contents);
        else
            loadedChar.parseFile(contents);
        loadedChar.renderHTML(document.getElementById("html-content"));
        document.getElementById("save-button").classList.remove("hidden");
    } catch (err) {
        const element = document.getElementById('error-content');
        element.textContent = `Error: ${err.name}: ${err.message}`;
        document.getElementById('file-input').value = '';
        throw err
    }
}

function downloadSave() {

    const blob = new Blob([loadedChar.getSaveData()], {
        type: "application/json" 
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a"); 
    a.href = url; 
    a.download = saveFileName ?? "character-sheet.json"; 

    a.click();
    URL.revokeObjectURL(url);

};


const testEvBus = new EventBus();
testEvBus.addListener("change",new Path("Equipment.items[*].equipped"),() => {
    console.log("item equipped!")
});

testEvBus.addListener("change",new Path("Some Data.multiNode[-2]"),() => {
    console.log("node changed!")
});

testEvBus.addListener("change",new Path("Ability Scores.*.score"),() => {
    console.log("score changed!")
});



// test functions

let testFileData = `{
    "data":{
        "HP#data":{"value":30,"max":110},
        "Ability Scores":{
            "Strength":{
                "score":{"__type":"data","value":10,"max":20,"min":0}
            },
            "Dexterity":{
                "score":{"__type":"data","value":8,"max":20,"min":0}
            },
            "Constitution":{
                "score":{"__type":"data","value":13,"max":20,"min":0}
            },
            "Wisdom":{
                "score":{"__type":"data","value":15,"max":20,"min":0}
            },
            "Intelligence":{
                "score":{"__type":"data","value":12,"max":20,"min":0}
            },
            "Charisma":{
                "score":{"__type":"data","value":20,"max":20,"min":0}
            }
                
        },
        "Some Data":{
            "multiNode":[
                {"__type":"data","value":10},
                {"__type":"data","value":20},
                {"__type":"data","value":30},
                {"__type":"data","value":"=data('$Equipment.items[1].name')=='Shield'"}
            ],
            "sideNode":"=data('.multiNode[1]')"
        },
        "Equipment":{
            "capacity":"=data('$Ability Scores.Strength.score') * 15",
            "items":[
                {
                    "name":"Shortsword",
                    "desc":"blablabla",
                    "equipped":false
                },
                {
                    "name":"Shield",
                    "desc":"blablabla",
                    "equipped":false
                },
                {
                    "desc":"no name"
                }
            ]
        },
        "constructor":"malicious code",
        "reduce":"more malicious code"
    },
    "rules": {
        "Ability Scores.*": {
                "mod": "=floor(data('.score')/2)-5",
                "save": "=data('.mod')"
        },
        "Equipment.items[*]": {
            "__type": "requirement",
            "equipped":false
        }
    }
}`

let testChar = new Character(testFileData);
let testNode = new Path('Ability Scores.Strength.score',testChar.root).resolve();
if(testNode?.__type === "pathResult") testNode = testNode.result;

testEvBus.emit("change",testNode);
testEvBus.emit("change",testChar.root.Equipment.items[0].equipped);
testEvBus.emit("change",testChar.root["Some Data"].multiNode[2]);

let testPath1 = new Path("Ability Scores.Strength.score",testChar.root);
// console.log(testPath1.resolveStrs());

let testPath2 = new Path("Ability Scores.(Strength.(score,mod,save),Constitution.(score,mod),Charisma.(score,mod,save))#value,max,min",testChar.root);
// console.log(testPath2.resolveStrs());

let testPath3 = new Path("Ability Scores.Charisma.mod",testChar.root);
// console.log(testPath3.resolveStrs({relativeTo:testNode[Symbol.for("parent")][Symbol.for("parent")]}));

let testPath4 = new Path("Equipment.items[*].equipped",testChar.root);
// console.log(testPath4.resolveStrs());

let testPath5 = new Path(".name",testPath4);
// console.log(testPath5.resolveStrs());

let testPath6 = new Path(".mod",testNode);
// console.log(testPath6.resolveStrs());

let testPath7 = new Path(testPath1,testEvBus);