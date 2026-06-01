class Vector2 {

    /** 
     * @param {Number} x 
     * @param {Number} y*/
    constructor(x, y) {
        /** @type {Number} */
        this.x = x;
        /** @type {Number} */
        this.y = y;
    }

    Length() {
        return Math.sqrt(Math.pow(this.x,2)+Math.pow(this.y,2));
    }

    Normalize() {
        /** @type {Number} */
        let length = this.Length();
        this.x = this.x / length;
        this.y = this.y / length;
    }

    
    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    static Sum(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(a.x + b, a.y + b);
        } else if (b instanceof Vector2) {
            return new Vector2(a.x + b.x, a.y + b.y);
        }
    }

    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    static Dif(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(a.x - b, a.y - b);
        } else if (b instanceof Vector2) {
            return new Vector2(a.x - b.x, a.y - b.y);
        }
    }

    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    static Prod(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(a.x * b, a.y * b);
        } else if (b instanceof Vector2) {
            return new Vector2(a.x * b.x, a.y * b.y);
        }
    }

    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    static Div(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(a.x / b, a.y / b);
        } else if (b instanceof Vector2) {
            return new Vector2(a.x / b.x, a.y / b.y);
        }
    }

    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    Mod(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(a.x % b, a.y % b);
        } else if (b instanceof Vector2) {
            return new Vector2(a.x % b.x, a.y % b.y);
        }
    }

    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    static Max(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(Math.max(a.x, b), Math.max(a.y, b));
        } else if (b instanceof Vector2) {
            return new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y));
        }
    }

    /** 
     * @param {(Vector2)} a
     * @param {(Vector2|Number)} b */
    static Min(a,b) {
        if (typeof(b) === "number") {
            return new Vector2(Math.min(a.x, b), Math.min(a.y, b));
        } else if (b instanceof Vector2) {
            return new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y));
        }
    }

    Round() {
        return new Vector2(Math.round(this.x), Math.round(this.y));
    }

    Floor() {
        return new Vector2(Math.floor(this.x), Math.floor(this.y));
    }

    Ceil() {
        return new Vector2(Math.ceil(this.x), Math.ceil(this.y));
    }

}