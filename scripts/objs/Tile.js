class Tile {
    constructor(pos,size) {
        this.pos = pos;
        this.size = size;
    }

    // Please for the love of everything holy, use the accessors not attributes
    GetPos(){return this.pos}
    SetPos(pos){this.pos = pos}
    SetPosSnap(pos){this.pos = pos.Floor()}

    GetSize(){return this.size}
    SetSize(size){this.size = size}
    SetSizeSnap(size){this.size = size.Ceil()}

    GetTopLeft(){return this.pos}
    GetBottomRight(){return this.pos.Sum(this.size)}

    SetCenter(pos){this.pos = pos.Dif(this.size.Div(2))}
    SetCenterSnap(pos){this.pos = pos.Dif(this.size.Div(2)).Floor()}
    GetCenter(){return this.pos.Sum(this.size.Div(2))}
}   