var tiffWindow;

const xzScale = 6;      // Smaller number = more triangles that make up the terrain = worse performance
const groundColour = "#4A9342";


async function getHeightMap(pixelCoords, bboxSize) {
    console.log("=== Getting Height Map ===");
    let xPixel = pixelCoords.roundedX;
    let yPixel = pixelCoords.roundedY;
    let offset = (bboxSize / (2 * twfData[0])); // Converts bbox size into an offset
    tiffWindow = [xPixel - offset, yPixel - offset, xPixel + offset, yPixel + offset];

    // TODO Move the below code into a worker. This seems to be what is making the UI hang.

    // let test = tiffImage.then((image) => {
    //     const pool = new GeoTIFF.Pool();

    //     let windowedTwoDHeightMapArray = image.readRasters({pool, window: tiffWindow})
    //     .then((oneDArray) => {
    //         return convert1DArrayTo2DArray(oneDArray);
    //     });

    //     let twoDHeightMapArray = image.readRasters( {pool} )
    //     .then((oneDArray) => {
    //         return convert1DArrayTo2DArray(oneDArray);
    //     });
    //     return { windowedTwoDHeightMapArray, twoDHeightMapArray };
    // });
    let heightMaps = raster.then((raster) => {
        let twoDHeightMapArray = convert1DArrayTo2DArray(raster);
        let windowedTwoDHeightMapArray = getAreaOf2DArray(twoDHeightMapArray, tiffWindow[0], tiffWindow[1], tiffWindow[2], tiffWindow[3]);
        return { windowedTwoDHeightMapArray, twoDHeightMapArray }
    });
    return heightMaps;
}


function getAreaOf2DArray(twoDArray, minX, minY, maxX, maxY) {
    let windowedTwoDArray = [];
    for (let x = 0; x < maxX - minX; x++) {
        windowedTwoDArray[x] = [];
        for (let y = 0; y < maxY - minY; y++) {
            windowedTwoDArray[x].push(twoDArray[x + minX][y + minY]);
        }
    }
    return windowedTwoDArray;
}


async function loadTerrain() {
    console.log("=== Loading Terrain ===");

    drawTriangles(createTrianglesForTerrain(xzScale, true));    // Draws a flat terrain while waiting for the height map

    heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
        Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([heightMap, _unused]) => {  // Waits for both height maps to succeed
            changeElementID("terrainParent", "terrainToRemove");
            removeCurrentTerrain();
            drawTriangles(createTrianglesForTerrain(xzScale, false, heightMap));    // Draws a height map accurate terrain
        }).catch((err) => {
            console.log(err);
        });
    }).catch((err) => {
        console.log(err);
    });
}

function drawTriangles(triangles) {
    let sceneElement = document.querySelector('a-scene');
    let triangleParent = document.createElement('a-entity');
    triangleParent.setAttribute("id", "terrainParent");
    triangleParent.setAttribute("class", "terrain");
    sceneElement.appendChild(triangleParent);
    triangles.forEach(triangle => {
        triangleParent.appendChild(triangle);
    });
}

function createTrianglesForTerrain(resolution, flat, heightMap) {
    let newTriangle;
    let triangles = [];
    if (flat) resolution = bboxSize / 2 - 1;
    for (let z = 0; z < bboxSize / 2 - resolution; z += resolution) {
        for (let x = 0; x < bboxSize / 2 - resolution; x += resolution) {
            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("color", groundColour);
            newTriangle.setAttribute("vertex-a", (x + tiffWindow[0]) + " " + ((flat) ? 0 : heightMap[x][z]) + " " + (z + tiffWindow[1]));
            newTriangle.setAttribute("vertex-b", (x + tiffWindow[0]) + " " + ((flat) ? 0 : heightMap[x][z + xzScale]) + " " + (z + tiffWindow[1] + resolution));
            newTriangle.setAttribute("vertex-c", (x + tiffWindow[0] + resolution) + " " + ((flat) ? 0 : heightMap[x + xzScale][z]) + " " + (z + tiffWindow[1]));
            triangles.push(newTriangle);

            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("color", groundColour);
            newTriangle.setAttribute("vertex-a", (x + tiffWindow[0]) + " " + ((flat) ? 0 : heightMap[x][z + xzScale]) + " " + (z + tiffWindow[1] + resolution));
            newTriangle.setAttribute("vertex-b", (x + tiffWindow[0] + resolution) + " " + ((flat) ? 0 : heightMap[x + xzScale][z + xzScale]) + " " + (z + tiffWindow[1] + resolution));
            newTriangle.setAttribute("vertex-c", (x + tiffWindow[0] + resolution) + " " + ((flat) ? 0 : heightMap[x + xzScale][z]) + " " + (z + tiffWindow[1]));
            triangles.push(newTriangle);
        }
    }
    return triangles;
}