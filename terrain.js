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
    return tiffImage.then(async (image) => {
        windowedTwoDHeightMapArray = image.readRasters({window: tiffWindow})
        .then((oneDArray) => {
            return convert1DArrayTo2DArray(oneDArray);
        });

        twoDHeightMapArray = image.readRasters()
        .then((oneDArray) => {
            return convert1DArrayTo2DArray(oneDArray);
        });
        //await sleep(15);
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

    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([heightMap, _unused]) => {
            for (let z = 0; z < heightMap.length-xzScale; z+=xzScale) {
                for (let x = 0; x < heightMap[z].length-xzScale; x+=xzScale) {
                    newTriangle = document.createElement('a-triangle');
                    newTriangle.setAttribute("color", "#4c9141");
                    newTriangle.setAttribute("vertex-a", (x+tiffWindow[0])+" "+heightMap[x][z]*yScale+" "+(z+tiffWindow[1]));
                    newTriangle.setAttribute("vertex-b", (x+tiffWindow[0])+" "+heightMap[x][z+xzScale]*yScale+" "+(z+tiffWindow[1]+xzScale));
                    newTriangle.setAttribute("vertex-c", (x+tiffWindow[0]+xzScale)+" "+heightMap[x+xzScale][z]*yScale+" "+(z+tiffWindow[1]));
                    triangleParent.appendChild(newTriangle);
        
                    newTriangle = document.createElement('a-triangle');
                    newTriangle.setAttribute("color", "#4c9141");
                    newTriangle.setAttribute("vertex-a", (x+tiffWindow[0])+" "+heightMap[x][z+xzScale]*yScale+" "+(z+tiffWindow[1]+xzScale));
                    newTriangle.setAttribute("vertex-b", (x+tiffWindow[0]+xzScale)+" "+heightMap[x+xzScale][z+xzScale]*yScale+" "+(z+tiffWindow[1]+xzScale));
                    newTriangle.setAttribute("vertex-c", (x+tiffWindow[0]+xzScale)+" "+heightMap[x+xzScale][z]*yScale+" "+(z+tiffWindow[1]));
                    triangleParent.appendChild(newTriangle);
                }
            }
        }).catch(() => {
            drawFlatTerrain(triangleParent);
        });
    }).catch(() => {
        drawFlatTerrain(triangleParent);
    });
}

function drawFlatTerrain(triangleParent) {
    for (let z = 0; z < bboxSize/2-xzScale; z+=xzScale) {
        for (let x = 0; x < bboxSize/2-xzScale; x+=xzScale) {
            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-a", (x+tiffWindow[0])+" 0 "+(z+tiffWindow[1]));
            newTriangle.setAttribute("vertex-b", (x+tiffWindow[0])+" 0 "+(z+tiffWindow[1]+xzScale));
            newTriangle.setAttribute("vertex-c", (x+tiffWindow[0]+xzScale)+" 0 "+(z+tiffWindow[1]));
            triangleParent.appendChild(newTriangle);

            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-a", (x+tiffWindow[0])+" 0 "+(z+tiffWindow[1]+xzScale));
            newTriangle.setAttribute("vertex-b", (x+tiffWindow[0]+xzScale)+" 0 "+(z+tiffWindow[1]+xzScale));
            newTriangle.setAttribute("vertex-c", (x+tiffWindow[0]+xzScale)+" 0 "+(z+tiffWindow[1]));
            triangleParent.appendChild(newTriangle);
        }
    }
}