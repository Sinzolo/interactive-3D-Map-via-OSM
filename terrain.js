var oneDHeightMapArray;
var twoDHeightMapArray;

var xPixel;
var yPixel;

const yScale = -1;
const xzScale = 16;

async function getHeightMap() {
    twfFile = fetch("uniTiff/SD45ne_DTM_2m.tfw").then(response => {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response.text();
    })
    .then(async (twfData) => {
        const tiff = await GeoTIFF.fromUrl("uniTiff/SD45ne_DTM_2m.tif");
        const image = await tiff.getImage();

        const bbox = image.getBoundingBox();
        const pixelWidth = image.getWidth();
        const pixelHeight = image.getHeight();
        const bboxWidth = bbox[ 2 ] - bbox[ 0 ];
        const bboxHeight = bbox[ 3 ] - bbox[ 1 ];
        var latLongUTM = convertLatLongToUTM(twfData, centreLat, centreLong);
        const centreLongInUTM = latLongUTM.x;
        const centreLatInUTM = latLongUTM.y;
        const widthPct = ( centreLongInUTM - bbox[ 0 ] ) / bboxWidth;
        const heightPct = ( centreLatInUTM - bbox[ 1 ] ) / bboxHeight;
        xPixel = Math.floor( pixelWidth * widthPct );
        yPixel = Math.floor( pixelHeight * heightPct );
        const window = [ xPixel-260, yPixel-80, xPixel+400, yPixel + 1200 ];
        oneDHeightMapArray = await image.readRasters( {window} );

        const width = image.getWidth();
        const height = image.getHeight();
        const tileWidth = image.getTileWidth();
        const tileHeight = image.getTileHeight();
        const origin = image.getOrigin();

        /*
        Converts 1D data array into 2D array:
        */
        var length = oneDHeightMapArray.height;
        var start = 0;
        var end = oneDHeightMapArray.width;
        twoDHeightMapArray = [];
        while(length > 0) {
            twoDHeightMapArray.push(oneDHeightMapArray[0].slice(start,end));
            length -= 1;
            start += oneDHeightMapArray.width;
            end += oneDHeightMapArray.width;
        }
        console.log(twoDHeightMapArray);
    }).catch((err) => {console.error(err)});;
}



async function loadTerrain() {
    /*
        Draws triangles for the floor
     */
    const xRelative = oneDHeightMapArray.height/2;
    const zRelative = oneDHeightMapArray.width/2;
    var sceneElement = document.querySelector('a-scene');
    for (let x = 0; x < twoDHeightMapArray.length-xzScale; x+=xzScale) {
        for (let z = 0; z < twoDHeightMapArray[x].length-xzScale; z+=xzScale) {
            var newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("class", "terrain");
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-c", (x-xRelative)+" "+twoDHeightMapArray[x][z]*yScale+" "+(z-zRelative));
            newTriangle.setAttribute("vertex-b", (x-xRelative)+" "+twoDHeightMapArray[x][z+xzScale]*yScale+" "+(z+xzScale-zRelative));
            newTriangle.setAttribute("vertex-a", (x+xzScale-xRelative)+" "+twoDHeightMapArray[x+xzScale][z]*yScale+" "+(z-zRelative));
            newTriangle.setAttribute("rotation", "0 0 180");
            //newTriangle.setAttribute("scale", "2 1 2");
            //newTriangle.setAttribute("wireframe", "true");
            sceneElement.appendChild(newTriangle);

            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("class", "terrain");
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-c", (x-xRelative)+" "+twoDHeightMapArray[x][z+xzScale]*yScale+" "+(z+xzScale-zRelative));
            newTriangle.setAttribute("vertex-b", (x+xzScale-xRelative)+" "+twoDHeightMapArray[x+xzScale][z+xzScale]*yScale+" "+(z+xzScale-zRelative));
            newTriangle.setAttribute("vertex-a", (x+xzScale-xRelative)+" "+twoDHeightMapArray[x+xzScale][z]*yScale+" "+(z-zRelative));
            newTriangle.setAttribute("rotation", "0 0 180");
            //newTriangle.setAttribute("scale", "2 1 2");
            //newTriangle.setAttribute("wireframe", "true");
            sceneElement.appendChild(newTriangle);
        }
    }
}