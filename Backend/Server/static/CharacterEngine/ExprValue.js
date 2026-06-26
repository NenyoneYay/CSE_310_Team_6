import {Path} from "./Path.js";
import {BaseNode} from "./Nodes.js";

export class ExprValue {
    static diceRegex = {
        diceroll: /(\d+)d(\d+)\s*/,
        rule_keep_drop: /(?:kh|kl|dh|dl)\d+/,
        rule_reroll: /(?:rr|ro)(?:\d+|\[\s*(?:\d+(?:\s*,\s*\d+)*|\d+:\d*|\d*:\d+)\s*\])/
    }

    static parser = new exprEval.Parser({
        operators: {
            assignment: false
        }
    })

    /**
     * 
     * @param {(string|number)} value 
     * @param {Object|Path} origin 
     */
    constructor(value, origin=null) {
        /** @type {Map<String,Path>} */
        this.precedentPaths = new Map()
        this.modify(value, origin)
    }

    /**
     * 
     * @param {string|number|boolean|null} newValue 
     * @param {Object|Path|null} origin 
     * @returns {string|number|boolean|null} The final value of this expression
     */
    modify(newValue, origin=null) {
        const oldPaths = new Map(this.precedentPaths);
        this.origin = origin ?? new Path("");
        this.value = newValue;
        if(typeof(newValue) === "string") {
            this.isExpr = newValue[0] === "=";
            if(!this.isExpr) this.precedentPaths.clear();
            this.expr = this.isExpr ? this.processExpr(newValue,origin) : undefined;
            if(newValue.startsWith("r="))
                this.value = newValue.slice(1);
        }
        return oldPaths;
    }

    /**
     * @param {string|number|boolean|null} newValue 
     * @returns {boolean} Whether or not the value actually changed
     */
    set(newValue) {
        if(!this.isExpr) {
            if (['number','boolean'].includes(typeof(newValue))) {
                this.value = newValue;
                return true;
            } else if (typeof(newValue) === "string") {
                if(newValue.startsWith("r=")) {
                    this.value = newValue.slice(1);
                    return true;
                }else if(newValue[0] != '=') {
                    this.value = newValue;
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 
     * @param {string} value 
     * @param {Object|Path|null} origin 
     * @returns 
     */
    processExpr(value, origin) {
        // Preprocess text
        
        // Empty strings are not expressions
        if (!this.isExpr || value.length < 1)
            return undefined;

        // Remove leading '=' if applicable
        /** @type {string} */
        if (value[0] === '=') value = value.slice(1); 


        // Empty data() calls cause problems add an empty string to them
        value = value.replace(/data\(\)/g,"data('')");


        // replace dice expressions with roll function calls
        {
            let diceExprRegex = new RegExp(`${ExprValue.diceRegex.diceroll.source}`+
                `((?:(?:${ExprValue.diceRegex.rule_keep_drop.source}|`+
                `${ExprValue.diceRegex.rule_reroll.source})\\s*)*)`,"g");

            value.replace(diceExprRegex,"roll($1,$2,'$3')")
        }

        // Parse text into expression object
        let expr = ExprValue.parser.parse(value);
        this.precedentPaths.clear()

        // preprocess the expression.
        // extract paths, replace paths with absolute path objects,
        // and add paths to dependencies list as they are found.
        let pathfound = false;
        for (let token of expr.tokens) {
            if (token.type == 'INUMBER' && pathfound) {
                let pathObj = new Path(token.value, origin);
                let existingPath = this.precedentPaths.get(token.value)
                if (existingPath == undefined) {
                    this.precedentPaths.set(token.value,pathObj);      // add path to dependencies
                    existingPath = pathObj;
                }
                token.value = existingPath;                                     // replace data() input with path object
                pathfound = false;
            }
            if (token.type == 'IVAR' && token.value == 'data') pathfound = true;
        }

        return expr
    }

    evaluate(root = null) {
        //Update path
        /** @param {Path} path */
        ExprValue.parser.functions.data = (path, fallback=NaN) => {
            const replaceVals = (val) => {
                if (val?.__type === "pathResult") {
                    return replaceVals(val.result);
                } else if (["string","boolean"].includes(typeof(val))) {
                    return val;
                } else if (typeof(val) === "number") {
                    return Number.isNaN(val) ? fallback : val;
                } else if(val instanceof BaseNode) {
                    return replaceVals(val.accessors.value);
                } else if (Array.isArray(val)) {
                    return val.map(replaceVals)
                } else {
                    return fallback;
                }
            }
            let result = path.resolve({root:root});

            if (result instanceof ExprValue) {
                throw EvalError("This isn't supposed to happen!!")
            } else {
                result = replaceVals(result);
            }
            return result;
        }

        if (this.isExpr)
            try {
                return this.expr.evaluate();
            } catch (err) {
                console.error(`Error evaluating expression at origin ${Path.pathTo(this.origin).str}: '${this.value}'\n${err.message}`);
            }
        return this.value;
    }

    getSaveData() {
        if(this.isExpr)
            return this.value;
        else if (typeof(this.value) === "string" && this.value[0] === '=')
            return "r"+this.value;
        else
            return this.value;
    }
}
ExprValue.parser.functions.roll = function (number, sides, rules='') {
    const rolls = []
    for (let i = 0;i < number;i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    // apply rules

    // sum values
    return rolls.reduce((pv,cv) => pv+cv);
}
ExprValue.parser.functions.sum = function (arr) {
    return arr.reduce((pv,cv) => pv + cv,0);
}
ExprValue.parser.functions.asum = function (arr1, arr2) {
    const rval = new Array(max(arr1.length,arr2.length));
    for(let i = 0;i < rval.length;i++) {
        if(i < arr1.length && i<arr2.length) rval[i] = arr1[i] + arr2[i];
        else if (i < arr1.length)            rval[i] = arr1[i];
        else if (i < arr2.length)            rval[i] = arr2[i];
        else rval[i] = 0;
    }
    return rval;
}
ExprValue.parser.functions.any = function (arr) {
    return arr.reduce((pv,cv) => {
        if(cv) return true;
        return pv;
    },false);
}
ExprValue.parser.functions.every = function (arr) {
    return arr.reduce((pv,cv) => {
        if(!cv) return false;
        return pv;
    },true);
}
ExprValue.parser.functions.prod = function (arr) {
    return arr.reduce((pv,cv) => pv * cv,0);
}
ExprValue.parser.functions.aprod = function (arr1, arr2) {
    const rval = new Array(Math.max(arr1.length,arr2.length));
    for(let i = 0;i < rval.length;i++) {
        if(i < arr1.length && i<arr2.length) rval[i] = arr1[i] * arr2[i];
        else if (i < arr1.length)            rval[i] = arr1[i];
        else if (i < arr2.length)            rval[i] = arr2[i];
        else rval[i] = 0;
    }
    return rval;
}
ExprValue.parser.functions.flatten = function (arr) {
    const reducer = (pv,cv) => {
        if(Array.isArray(cv)) {
            pv.push(...cv.reduce(reducer,[]));
        } else {
            pv.push(cv);
        }
        return pv;
    }
    return arr.reduce(reducer,[]);
}