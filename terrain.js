var tiff;
var image;
var oneDHeightMapArray;
var twoDHeightMapArray;
var windowedOneDHeightMapArray;

var xPixel;
var yPixel;
var tiffWindow;
var offset;

const yScale = 1;
const xzScale = 4;

async function getHeightMap(pixelCoords, bboxSize) {
    console.log("=== Getting Height Map ===");

    if (typeof image === 'undefined') {
        tiff = await GeoTIFF.fromUrl(tiffURL);
        image = await tiff.getImage();
        console.log("Getting tif hopefully once");
    }

    xPixel = pixelCoords.x;
    yPixel = pixelCoords.y;
    offset = (bboxSize/(2*twfData[0])); // Converts bbox size into an offset
    tiffWindow = [ xPixel-offset, yPixel-offset, xPixel+offset, yPixel+offset ];

    windowedOneDHeightMapArray = await image.readRasters( {window: tiffWindow} );
    oneDHeightMapArray = await image.readRasters( );

    height = oneDHeightMapArray.height;
    width = oneDHeightMapArray.width;

    windowedTwoDHeightMapArray = convert1DArrayTo2DArray(windowedOneDHeightMapArray);
    twoDHeightMapArray = convert1DArrayTo2DArray(oneDHeightMapArray);
}



async function loadTerrain() {
    console.log("=== Loading Terrain ===");

    /*
        Draws triangles for the floor
     */
    let xOffset = tiffWindow[0];
    let zOffset = tiffWindow[1];

    let sceneElement = document.querySelector('a-scene');
    let triangleParent = document.createElement('a-entity');
    triangleParent.setAttribute("id", "terrainParent");
    triangleParent.setAttribute("class", "terrain");
    sceneElement.appendChild(triangleParent);
    let newTriangle;
    for (let z = 0; z < windowedTwoDHeightMapArray.length-xzScale; z+=xzScale) {
        for (let x = 0; x < windowedTwoDHeightMapArray[z].length-xzScale; x+=xzScale) {
            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-a", (x+xOffset)+" "+windowedTwoDHeightMapArray[x][z]*yScale+" "+(z+zOffset));
            newTriangle.setAttribute("vertex-b", (x+xOffset)+" "+windowedTwoDHeightMapArray[x][z+xzScale]*yScale+" "+(z+zOffset+xzScale));
            newTriangle.setAttribute("vertex-c", (x+xOffset+xzScale)+" "+windowedTwoDHeightMapArray[x+xzScale][z]*yScale+" "+(z+zOffset));
            triangleParent.appendChild(newTriangle);

            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-a", (x+xOffset)+" "+windowedTwoDHeightMapArray[x][z+xzScale]*yScale+" "+(z+zOffset+xzScale));
            newTriangle.setAttribute("vertex-b", (x+xOffset+xzScale)+" "+windowedTwoDHeightMapArray[x+xzScale][z+xzScale]*yScale+" "+(z+zOffset+xzScale));
            newTriangle.setAttribute("vertex-c", (x+xOffset+xzScale)+" "+windowedTwoDHeightMapArray[x+xzScale][z]*yScale+" "+(z+zOffset));
            triangleParent.appendChild(newTriangle);
        }
    }
}