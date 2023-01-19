var oneDHeightMapArray;
var twoDHeightMapArray;
var windowedOneDHeightMapArray;
var windowedTwoDHeightMapArray;

var tiffWindow;

const yScale = 1;
const xzScale = 4;

function getHeightMap(pixelCoords, bboxSize) {
    console.log("=== Getting Height Map ===");
    let xPixel = pixelCoords.roundedX;
    let yPixel = pixelCoords.roundedY;
    let offset = (bboxSize/(2*twfData[0])); // Converts bbox size into an offset
    tiffWindow = [ xPixel-offset, yPixel-offset, xPixel+offset, yPixel+offset ];
    return tiffImage.then((image) => {
        windowedTwoDHeightMapArray = image.readRasters({window: tiffWindow})
        .then((oneDArray) => {
            return convert1DArrayTo2DArray(oneDArray);
        })

        twoDHeightMapArray = image.readRasters()
        .then((oneDArray) => {
            return convert1DArrayTo2DArray(oneDArray);
        })
        return { windowedTwoDHeightMapArray, twoDHeightMapArray };
    });
}


function loadTerrain() {
    console.log("=== Loading Terrain ===");

    /*
        Draws triangles for the floor
     */
    let sceneElement = document.querySelector('a-scene');
    let triangleParent = document.createElement('a-entity');
    triangleParent.setAttribute("id", "terrainParent");
    triangleParent.setAttribute("class", "terrain");
    sceneElement.appendChild(triangleParent);
    let newTriangle;

    heightMaps.then(({ windowedTwoDHeightMapArray }) => {
        let xOffset = tiffWindow[0];
        let zOffset = tiffWindow[1];
        windowedTwoDHeightMapArray.then((heightMap) => {
            for (let z = 0; z < heightMap.length-xzScale; z+=xzScale) {
                for (let x = 0; x < heightMap[z].length-xzScale; x+=xzScale) {
                    newTriangle = document.createElement('a-triangle');
                    newTriangle.setAttribute("color", "#4c9141");
                    newTriangle.setAttribute("vertex-a", (x+xOffset)+" "+heightMap[x][z]*yScale+" "+(z+zOffset));
                    newTriangle.setAttribute("vertex-b", (x+xOffset)+" "+heightMap[x][z+xzScale]*yScale+" "+(z+zOffset+xzScale));
                    newTriangle.setAttribute("vertex-c", (x+xOffset+xzScale)+" "+heightMap[x+xzScale][z]*yScale+" "+(z+zOffset));
                    triangleParent.appendChild(newTriangle);
        
                    newTriangle = document.createElement('a-triangle');
                    newTriangle.setAttribute("color", "#4c9141");
                    newTriangle.setAttribute("vertex-a", (x+xOffset)+" "+heightMap[x][z+xzScale]*yScale+" "+(z+zOffset+xzScale));
                    newTriangle.setAttribute("vertex-b", (x+xOffset+xzScale)+" "+heightMap[x+xzScale][z+xzScale]*yScale+" "+(z+zOffset+xzScale));
                    newTriangle.setAttribute("vertex-c", (x+xOffset+xzScale)+" "+heightMap[x+xzScale][z]*yScale+" "+(z+zOffset));
                    triangleParent.appendChild(newTriangle);
                }
            }
        });
    });
}