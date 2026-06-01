class Grid2 extends Rect2 {
    /** 
     * @param {Vector2} pos
     * @param {Vector2} size
     * @param {Vector2} cellSize
     */
    constructor(pos,size,cellSize) {
        super(pos,size);
        this.cellSize = cellSize;
    }



    /** @param {Vector2} size */
    GetCellSize(){return this.cellSize}
    /** @param {Vector2} size */
    SetCellSize(size){this.cellSize = size}
    /** @param {Vector2} size */
    SetCellSizeSnap(size){this.cellSize = size.Ceil()}

    GetTotalSize(){return Vector2.Prod(this.size,this.cellSize)}

   

    GetBottomRight(){return Vector2.Sum(this.pos,this.GetTotalSize())}
    /** @param {Vector2} pos */
    SetCenter(pos){this.pos = Vector2.Dif(pos, Vector2.Div(this.GetTotalSize(),2))}
    /** @param {Vector2} pos */
    SetCenterSnap(pos){this.pos = Vector2.Dif(pos, Vector2.Div(this.GetTotalSize(),2)).Floor()}
    GetCenter(){return Vector2.Sum(this.pos,Vector2.Div(this.GetTotalSize(),2))}


    
    /** @param {Vector2} pos */
    GetClosestCoord(pos){
        pos = Vector2.Min(pos - this.pos,this.GetTotalSize());
        return coord = Vector2.Div(pos,this.cellSize).Floor()
    }
}   