class Grid2 extends Rect2 {
    /** 
     * @param {Vector2} pos
     * @param {Vector2} size
     * @param {Vector2} gridSize 
     */
    constructor(pos,size,gridSize ) {
        super(pos,size);
        this.gridSize  = gridSize ;
    }



    GetGridSize(){return this.gridSize;}
    /** @param {Vector2} size */
    SetGridSize(size){this.gridSize = size;}
    /** @param {Vector2} size */
    SetGridSizeSnap(size){this.gridSize = size.Ceil();}


    
    /** @param {Vector2} pos */
    GetClosestCoord(pos){
        let ratioPos = Vector2.Div(Vector2.Dif(pos, this.pos), this.GetSize()); // Turns pos into ratios (0,0) top left, (1,1) bottom right
        let boundRatioPos = Vector2.Max(Vector2.Min(ratioPos,1),0); // Keeps pos within (0,0) and (1,1)
        let coord = Vector2.Prod(boundRatioPos,this.gridSize).Floor()
        return coord;
    }
}   