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
const xzScale = 8;

async function getHeightMap(pixelCoords, bboxSize) {
    console.log("=== Getting Height Map ===");

    if (typeof image === 'undefined') {
        tiff = await GeoTIFF.fromUrl("uniTiff/SD45ne_DTM_2m.tif");
        image = await tiff.getImage();
        console.log("Getting tif hopefully once");
    }

    //console.log(tiff);
    //console.log(image);

    // const bbox = image.getBoundingBox();
    // console.log("bbox = ", bbox);
    // const bboxWidth = bbox[ 2 ] - bbox[ 0 ];
    // const bboxHeight = bbox[ 3 ] - bbox[ 1 ];

    // let latLongUTM = convertLatLongToUTM(latitude, longitude);
    // const widthPct = ( latLongUTM.x - bbox[ 0 ] ) / bboxWidth;
    // const heightPct = ( latLongUTM.y - bbox[ 1 ] ) / bboxHeight;

    // xPixel = Math.floor( image.getWidth() * widthPct );
    // yPixel = Math.floor( image.getHeight() * heightPct );

    // tiffWindow = [ xPixel-offset, yPixel-offset, xPixel+offset, yPixel+offset ];
    // console.log("tiffWindow =", tiffWindow);

    offset = (bboxSize/(2*twfData[0])); // Converts bbox size into an offset
    // let centreUTM = convertLatLongToUTM(latitude, longitude);
    // let centrePixelCoords = convertUTMToPixelCoords(centreUTM.x, centreUTM.y);
    // centrePixelCoords = { x: Math.round(centrePixelCoords.x), y: Math.round(centrePixelCoords.y) };
    //console.log("centrePixelCoords = ", centrePixelCoords);

    xPixel = pixelCoords.x;
    yPixel = pixelCoords.y;

    tiffWindow = [ xPixel-offset, yPixel-offset, xPixel+offset, yPixel+offset ];
    //console.log("tiffWindow =", tiffWindow);
    var window = tiffWindow;

    windowedOneDHeightMapArray = await image.readRasters( { window } );
    console.log(windowedOneDHeightMapArray);

    oneDHeightMapArray = await image.readRasters( );

    console.log(oneDHeightMapArray);


    height = oneDHeightMapArray.height;
    width = oneDHeightMapArray.width;
    //console.log("windowed: ", oneDHeightMapArray);

    // latLongUTM = convertLatLongToUTM(latitude, longitude);
    // console.log("centre pixel coords = ", convertUTMToPixelCoords(latLongUTM.x, latLongUTM.y));

    windowedTwoDHeightMapArray = convert1DArrayTo2DArray(windowedOneDHeightMapArray);
    twoDHeightMapArray = convert1DArrayTo2DArray(oneDHeightMapArray);

    //console.log(windowedTwoDHeightMapArray);
    //console.log(twoDHeightMapArray);

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