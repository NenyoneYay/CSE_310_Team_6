export function sanatizeKey(key) {
    if (key in Object.prototype) return '~'+key;
    return key;
}

function getWrappedIdx (idx,arr) {
    return arr.at(idx);
}

export function orderedObjectSerializer (obj, spaces = undefined, depth = 0) {
    const [spaceInsertA,spaceInsertB] = typeof(spaces) === "number" 
        ? ["\n" + " ".repeat(spaces*(depth)),"\n" + " ".repeat(spaces*(depth+1))] 
        : ["",""];

    if(Array.isArray(obj)) {
        const processedArr = obj.map((val) => orderedObjectSerializer(val,spaces,depth+1));
        return `[${spaceInsertB}${processedArr.join("," + spaceInsertB)}${spaceInsertA}]`;
    } else if (obj instanceof Object) {
        let keys = obj[Symbol.for("okeys")];
        if (keys == undefined) {
            keys = Object.keys(obj);
        }
        const processedKeys = keys.map((key) => `"${key}": ${orderedObjectSerializer(obj[key],spaces,depth+1)}`);
        return `{${spaceInsertB}${processedKeys.join(","+spaceInsertB)}${spaceInsertA}}`
    }
    return JSON.stringify(obj,undefined,spaces);
}

export function deepCopy (obj, filterFunc = null) {
    if(filterFunc == null) filterFunc = ((k,v) => "continue");

    const recursor = (obj) => {
        let rval = undefined;
        if(Array.isArray(obj)) {
            if(Object.hasOwn(obj,Symbol.for("deepCopy_visited")))
                return obj[Symbol.for("deepCopy_visited")];
            rval = [];
            obj[Symbol.for("deepCopy_visited")] = rval;
            for(const [idx,item] of obj.entries()) {
                switch(filterFunc(idx,item)) {
                    case "collect":
                        rval.push(item);
                        break;
                    case "skip":
                    case false:
                        break;
                    case "continue":
                    case true:
                    default:
                        rval.push(recursor(item));
                        break;
                }
            }
        } else if(obj instanceof Object) {
            if(Object.hasOwn(obj,Symbol.for("deepCopy_visited")))
                return obj[Symbol.for("deepCopy_visited")];
            rval = {};
            obj[Symbol.for("deepCopy_visited")] = rval;
            for(const key of Object.keys(obj)) {
                switch(filterFunc(key,obj[key])) {
                    case "collect":
                        rval[key] = obj[key];
                        break;
                    case "skip":
                    case false:
                        break;
                    case "continue":
                    case true:
                    default:
                        rval[key] = recursor(obj[key]);
                        break;
                }
            }
        } else {
            return obj;
        }
        for(const sym of Object.getOwnPropertySymbols(obj)) {
            if(sym === Symbol.for("deepCopy_visited")) continue;
            switch(filterFunc(sym,obj[sym])) {
                case "collect":
                    rval[sym] = obj[sym];
                    break;
                case "skip":
                case false:
                    break;
                case "continue":
                case true:
                default:
                    rval[sym] = recursor(obj[sym]);
                    break;
            }
        }
        delete obj[Symbol.for("deepCopy_visited")];
        return rval;
    }

    return recursor(obj);
}

export function compareObj(obj1, obj2, keyWhitelist = []) {
    if(!(obj1 instanceof Object) || !(obj2 instanceof Object)) {
        if(!(obj1 instanceof Object) && !(obj2 instanceof Object)) {
            return obj1 === obj2;
        }
        return false;
    }
    
    if(obj1?.[Symbol.for("compareObj_visited")] != undefined || obj2?.[Symbol.for("compareObj_visited")] != undefined) {
        const rval = obj1?.[Symbol.for("compareObj_visited")] != undefined && obj2?.[Symbol.for("compareObj_visited")] != undefined;
        delete obj1[Symbol.for("compareObj_visited")];
        delete obj2[Symbol.for("compareObj_visited")];
        return rval;
    }

    if(obj1 === obj2) {
        return true;
    }

    let rval = true;
    obj1[Symbol.for("compareObj_visited")] = true;
    obj2[Symbol.for("compareObj_visited")] = true;
    for(const key of Object.keys({...obj1,...obj2})) {
        if(keyWhitelist.includes(key)) continue;

        if(obj1?.[key] !== undefined && obj2?.[key] !== undefined) {
            if(!compareObj(obj1[key], obj2[key])) {
                rval = false;
                break;
            }
        } else if (!(obj1?.[key] === undefined && obj2?.[key] === undefined)){
            rval = false;
            break;
        }
    }
    delete obj1[Symbol.for("compareObj_visited")];
    delete obj2[Symbol.for("compareObj_visited")];
    return rval;
}