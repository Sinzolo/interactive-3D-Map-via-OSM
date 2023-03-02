'use strict';

const yScale = 1;
const xzScale = 12;      // Smaller number = more triangles that make up the terrain = worse performance
const groundColour = "#367d3f";
var tiffWindow;
var triangleParent = document.createElement('a-entity');
triangleParent.setAttribute("id", "terrainParent");
triangleParent.setAttribute("class", "terrain");
document.querySelector('a-scene').appendChild(triangleParent);


/**
 * It takes the pixel coordinates of the center of the bounding box and the size of the bounding box,
 * and returns a promise of a 2D array of the height map data within the bounding box
 * @param pixelCoords - The pixel coordinates of the center of the bounding box
 * @param bboxSize - The size of the bounding box in meters.
 * @returns An Promise object with two properties: windowedTwoDHeightMapArray and twoDHeightMapArray.
 */
async function getHeightMap(pixelCoords, bboxSize) {
    debugLog("=== Getting Height Map ===");
    let xPixel = pixelCoords.roundedX;
    let yPixel = pixelCoords.roundedY;
    let offset = Math.round(bboxSize / (2 * twfData[0])); // Converts bbox size into an offset
    tiffWindow = [xPixel - offset, yPixel - offset, xPixel + offset, yPixel + offset];

    if (lowQuality) {
        return new Promise(reject => {
            reject("Low quality mode is on.");
        });
    }
    return currentRaster.then((raster) => {
        let twoDHeightMapArray = convert1DArrayTo2DArray(raster);
        let windowedTwoDHeightMapArray = getAreaOf2DArray(twoDHeightMapArray, tiffWindow[0], tiffWindow[1], tiffWindow[2], tiffWindow[3]);
        return { windowedTwoDHeightMapArray: windowedTwoDHeightMapArray, twoDHeightMapArray: twoDHeightMapArray }
    });
}

/**
 * Get the area of the given 2D array and return it as a 2D array.
 * @param twoDArray - the 2D array to get the area from
 * @param minX - the minimum x value of the area
 * @param minY - the minimum y value of the area
 * @param maxX - the maximum x value of the area
 * @param maxY - the maximum y value of the area
 * @returns A 2D array of the values in the original array between the min and max values.
 */
function getAreaOf2DArray(twoDArray, minX, minY, maxX, maxY) {
    let windowedTwoDArray = [];
    for (let x = 0; x < maxX - minX; x++) {
        windowedTwoDArray[x] = [];
        for (let y = 0; y < maxY - minY; y++) {
            windowedTwoDArray[x].push(twoDArray[x + minX][y + minY]);
        }
    }
    twoDArray = null;
    return windowedTwoDArray;
}

/**
 * It draws a flat terrain while waiting for the height map, then draws a height map accurate terrain
 * when the height map is loaded.
 * @returns void
 */
function loadTerrain() {
    return new Promise((resolve, reject) => {
        debugLog("=== Loading Terrain ===");
        removeCurrentTerrain();
        drawTriangles(createTrianglesForTerrain(xzScale, true));    // Draws a flat terrain while waiting for the height map
        resolve("Flat Terrain Drawn");
        if (lowQuality) return;
        heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
            Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([heightMap, _unused]) => {  // Waits for both height maps to succeed
                removeCurrentTerrain();
                drawTriangles(createTrianglesForTerrain(xzScale, false, heightMap));    // Draws a height map accurate terrain
                resolve("Height-Based Terrain Drawn");
            }).catch((err) => {
                debugLog(err);
            });
        }).catch((err) => {
            debugLog(err);
        });
    });
}

/**
 * It takes an array of triangles and adds them to the scene.
 * @param triangles - an array of triangle entities
 */
function drawTriangles(triangles) {
    triangles.forEach(triangle => {
        triangleParent.appendChild(triangle);
    });
}

/**
 * It takes a resolution, a boolean for whether the terrain should be flat, and a height map, and
 * returns an array of A-Frame triangle entities that represent the terrain.
 * @param resolution - the size of the triangles to be created. (Bigger number = bigger but less triangles)
 * @param flat - if true, the terrain will be flat.
 * @param heightMap - a 2D array of heights
 * @returns An array of triangle entities.
 */
function createTrianglesForTerrain(resolution, flat, heightMap) {
    let newTriangle;
    let triangles = [];
    if (flat) resolution = bboxSize / 2 - 1;
    for (let z = 0; z < bboxSize / 2 - resolution; z += resolution) {
        for (let x = 0; x < bboxSize / 2 - resolution; x += resolution) {
            newTriangle = document.createElement('a-entity');
            newTriangle.setAttribute("geometry", {
                primitive: "triangle",
                vertexA: (x + tiffWindow[0]) + " " + ((flat) ? 0 : heightMap[x][z] * yScale) + " " + (z + tiffWindow[1]),
                vertexB: (x + tiffWindow[0]) + " " + ((flat) ? 0 : heightMap[x][z + xzScale] * yScale) + " " + (z + tiffWindow[1] + resolution),
                vertexC: (x + tiffWindow[0] + resolution) + " " + ((flat) ? 0 : heightMap[x + xzScale][z] * yScale) + " " + (z + tiffWindow[1])
            });
            newTriangle.setAttribute("material", { roughness: "0.7", color: groundColour });
            triangles.push(newTriangle);

            newTriangle = document.createElement('a-entity');
            newTriangle.setAttribute("geometry", {
                primitive: "triangle",
                vertexA: (x + tiffWindow[0]) + " " + ((flat) ? 0 : heightMap[x][z + xzScale] * yScale) + " " + (z + tiffWindow[1] + resolution),
                vertexB: (x + tiffWindow[0] + resolution) + " " + ((flat) ? 0 : heightMap[x + xzScale][z + xzScale] * yScale) + " " + (z + tiffWindow[1] + resolution),
                vertexC: (x + tiffWindow[0] + resolution) + " " + ((flat) ? 0 : heightMap[x + xzScale][z] * yScale) + " " + (z + tiffWindow[1])
            });
            newTriangle.setAttribute("material", { roughness: "0.7", color: groundColour });
            triangles.push(newTriangle);
        }
    }
    return triangles;
}

/**
 * Removes the terrain from the scene
 */
function removeCurrentTerrain() {
    removeAllChildren(triangleParent);
}