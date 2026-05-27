class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    Length() {
        return Math.sqrt(Math.pow(this.x,2)+Math.pow(this.y,2));
    }

    Normalize() {
        let length = this.length();
        this.x = this.x / length;
        this.y = this.y / length;
    }

    Sum(addend) {
        if (typeof(addend) === "number") {
            return new Vector2(this.x + addend, this.y + addend);
        } else if (addend instanceof Vector2) {
            return new Vector2(this.x + addend.x, this.y + addend.y);
        }
    }

    Dif(subtrahend) {
        if (typeof(subtrahend) === "number") {
            return new Vector2(this.x - subtrahend, this.y - subtrahend);
        } else if (subtrahend instanceof Vector2) {
            return new Vector2(this.x - subtrahend.x, this.y - subtrahend.y);
        }
    }

    Prod(factor) {
        if (typeof(factor) === "number") {
            return new Vector2(this.x * factor, this.y * factor);
        } else if (factor instanceof Vector2) {
            return new Vector2(this.x * factor.x, this.y * factor.y);
        }
    }

    Div(divisor) {
        if (typeof(divisor) === "number") {
            return new Vector2(this.x / divisor, this.y / divisor);
        } else if (divisor instanceof Vector2) {
            return new Vector2(this.x / divisor.x, this.y / divisor.y);
        }
    }

    Mod(divisor) {
        if (typeof(divisor) === "number") {
            return new Vector2(this.x % divisor, this.y % divisor);
        } else if (divisor instanceof Vector2) {
            return new Vector2(this.x % divisor.x, this.y % divisor.y);
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