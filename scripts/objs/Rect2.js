class Rect2 {
    /** 
     * @param {Vector2} pos
     * @param {Vector2} size
     */
    constructor(pos,size) {
        
        /** @type {Vector2} */
        this.pos = pos;
        /** @type {Vector2} */
        this.size = size;
    }

    // Please for the love of everything holy, use the accessors not attributes
    /** @param {Vector2} pos */
    GetPos(){return this.pos}
    /** @param {Vector2} pos */
    SetPos(pos){this.pos = pos}
    /** @param {Vector2} pos */
    SetPosSnap(pos){this.pos = pos.Floor()}



    /** @param {Vector2} size */
    GetSize(){return this.size}
    /** @param {Vector2} size */
    SetSize(size){this.size = size}
    /** @param {Vector2} size */
    SetSizeSnap(size){this.size = size.Ceil()}

    GetTopLeft(){return this.pos}
    GetBottomRight(){return Vector2.Sum(this.pos,this.size)}



    /** @param {Vector2} pos */
    SetCenter(pos){this.pos = Vector2.Dif(pos, Vector2.Div(this.size,2))}
    /** @param {Vector2} pos */
    SetCenterSnap(pos){this.pos = Vector2.Dif(pos, Vector2.Div(this.size,2)).Floor()}
    GetCenter(){return Vector2.Sum(this.pos,Vector2.Div(this.size,2))}
}   