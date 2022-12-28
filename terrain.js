var oneDHeightMapArray;
var twoDHeightMapArray;
var reversedHeightMap;
var height;
var width;

var xPixel;
var yPixel;
var tiffWindow;

const yScale = 1;
const xzScale = 64;

async function getHeightMap() {
    const tiff = await GeoTIFF.fromUrl("uniTiff/SD45ne_DTM_2m.tif");
    const image = await tiff.getImage();

    const bbox = image.getBoundingBox();
    const pixelWidth = image.getWidth();
    const pixelHeight = image.getHeight();
    const bboxWidth = bbox[ 2 ] - bbox[ 0 ];
    const bboxHeight = bbox[ 3 ] - bbox[ 1 ];
    var latLongUTM = convertLatLongToUTM(centreLat, centreLong);
    const centreLongInUTM = latLongUTM.x;
    const centreLatInUTM = latLongUTM.y;
    const widthPct = ( centreLongInUTM - bbox[ 0 ] ) / bboxWidth;
    const heightPct = ( centreLatInUTM - bbox[ 1 ] ) / bboxHeight;
    xPixel = Math.floor( pixelWidth * widthPct );
    yPixel = Math.floor( pixelHeight * heightPct );
    tiffWindow = [ xPixel-150, yPixel-80, xPixel+200, yPixel + 600 ];
    //console.log(tiffWindow);
    const window = tiffWindow;
    oneDHeightMapArray = await image.readRasters(  );
    oneDHeightMapArrayForBuildings = await image.readRasters(  );
    console.log("windowed: ", oneDHeightMapArray);
    console.log("full tiff: ", oneDHeightMapArrayForBuildings);
    height = oneDHeightMapArray.height;
    width = oneDHeightMapArray.width;

    var tempReversedHeightMap = [];
    tempReversedHeightMap = [new Float32Array(oneDHeightMapArrayForBuildings[0])]
    // tempReversedHeightMap = [new Float32Array(oneDHeightMapArrayForBuildings[0])] // doing this for some reason seems to make it better even tho it shouldnt
    tempReversedHeightMap.width = width;
    tempReversedHeightMap.height = height;
    //tempReversedHeightMap[0].reverse();


    /*
    Converts 1D data array into 2D array:
    */
    
    var length = height;
    var start = 0;
    var end = width;
    var count = 0;
    twoDHeightMapArray = new Array(height);

    for (var i = 0; i < twoDHeightMapArray.length; i++) {
        twoDHeightMapArray[i] = new Array(width);
    }
    while(length > 0) {
        oneDHeightMapArray[0].slice(start,end).forEach((element, index) => {
            twoDHeightMapArray[index][count] = element;
        });
        //twoDHeightMapArray.push(oneDHeightMapArray[0].slice(start,end));
        length -= 1;
        start += width;
        end += width;
        count++;
    }
    //console.log(twoDHeightMapArray);

    var length = oneDHeightMapArrayForBuildings.height;
    var start = 0;
    var end = oneDHeightMapArrayForBuildings.width;
    reversedHeightMap = [];
    while(length > 0) {
        reversedHeightMap.push(tempReversedHeightMap[0].slice(start,end));
        length -= 1;
        start += oneDHeightMapArrayForBuildings.width;
        end += width;
    }
    //console.log(reversedHeightMap);
}



async function loadTerrain() {
    /*
        Draws triangles for the floor
     */
    // const xRelative = oneDHeightMapArray.height/2;
    // const zRelative = oneDHeightMapArray.width/2;
    //const xRelative = 0;
    //const zRelative = 0;
    //var sceneElement = document.querySelector('a-scene');
    var sceneElement = document.querySelector("a-scene");
    for (let z = 0; z < twoDHeightMapArray.length-xzScale; z+=xzScale) {
        for (let x = 0; x < twoDHeightMapArray[z].length-xzScale; x+=xzScale) {
            var newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("class", "terrain");
            newTriangle.setAttribute("color", "#4c9141");
            //+tiffWindow[1]
            //+tiffWindow[0]
            newTriangle.setAttribute("vertex-a", (x)+" "+twoDHeightMapArray[x][z]*yScale+" "+(z));
            newTriangle.setAttribute("vertex-b", (x)+" "+twoDHeightMapArray[x][z+xzScale]*yScale+" "+(z+xzScale));
            newTriangle.setAttribute("vertex-c", (x+xzScale)+" "+twoDHeightMapArray[x+xzScale][z]*yScale+" "+(z));
            //console.log({x: x, z: z});
            //newTriangle.setAttribute("side", "back");
            //newTriangle.setAttribute("rotation", "0 90 180");
            //newTriangle.setAttribute("scale", "1 1 1");
            //newTriangle.setAttribute("wireframe", "true");
            sceneElement.appendChild(newTriangle);

            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("class", "terrain");
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-a", (x)+" "+twoDHeightMapArray[x][z+xzScale]*yScale+" "+(z+xzScale));
            newTriangle.setAttribute("vertex-b", (x+xzScale)+" "+twoDHeightMapArray[x+xzScale][z+xzScale]*yScale+" "+(z+xzScale));
            newTriangle.setAttribute("vertex-c", (x+xzScale)+" "+twoDHeightMapArray[x+xzScale][z]*yScale+" "+(z));
            //console.log({x: x, z: z+xzScale});
            //newTriangle.setAttribute("side", "back");
            //newTriangle.setAttribute("rotation", "0 90 180");
            //newTriangle.setAttribute("scale", "1 1 1");
            //newTriangle.setAttribute("wireframe", "true");
            sceneElement.appendChild(newTriangle);
        }
    }
}