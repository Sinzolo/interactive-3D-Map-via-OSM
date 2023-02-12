'use strict';
const naturalFeaturesFetchWorker = new Worker('fetchWorker.js');

const defaultGrassAreaColour = "#4A9342";
const defaultWaterColour = "#0E87CC";
const areaScale = 4.8;              // Scaling the pedestrian areas (bigger number = bigger path in the x and z)
const defaultAreaHeightAboveGround = 0.14 + 0.0007; // How far it should stick above ground
const areaParent = document.createElement('a-entity');
areaParent.setAttribute("id", "areaParent");
areaParent.setAttribute("class", "area");
document.querySelector('a-scene').appendChild(areaParent);

/**
 * It takes a coordinate and a bounding box size, and then it queries the Overpass API for all the
 * grass and water features in that bounding box. It then converts the response to GeoJSON, and then
 * adds all the grass and water features to the scene.
 * @param coordinate - The coordinate of the center of the map
 * @param bboxSize - The size of the bounding box to load
 * @returns A promise that resolves when the natural features have been loaded
 */
async function loadNaturalFeatures(coordinate, bboxSize) {
    console.log("=== Loading Natural Features ===");

    var stringBBox = convertBBoxToString(getBoundingBox(coordinate.lat, coordinate.long, bboxSize));
    var overpassQuery = overpassURL + encodeURIComponent(
        "[timeout:40];" +
        "(way[landuse=grass](" + stringBBox + ");" +
        "relation[landuse=grass](" + stringBBox + ");" +
        "way[natural=water](" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );

    const message = { overpassQuery };
    if ('caches' in window) message.osmCacheName = osmCacheName;
    naturalFeaturesFetchWorker.postMessage(message);

    return new Promise(async (resolve) => {
        naturalFeaturesFetchWorker.onmessage = async function (e) {
            numberOfPaths = 0;
            paths = [];
            rectangles = [];
            dijkstrasAlgorithm = new DijkstrasAlgo();
            const features = convertOSMResponseToGeoJSON(e.data).features;
            features.forEach((feature) => {
                if (feature.geometry.type == "Polygon") {   // Area
                    addArea(feature, areaParent);
                }
            });
            resolve("Finished Adding Greenery");
        }
    });
}

/**
 * It removes all the natural areas from the scene
 */
function removeCurrentNaturalAreas() {
    console.log("=== Deleting Natural Area ===");
    removeAllChildren(areaParent);
}

function addArea(feature, parentElement) {
    return new Promise((resolve, reject) => {
        let colour = defaultWaterColour;
        if (feature.properties.landuse == "grass") colour = defaultGrassAreaColour;

        let outerPoints = [];
        let innerPoints = [];
        let sumOfLatCoords = 0;
        let sumOfLongCoords = 0;
        let count = 0;
        /* Loops through every coordinate of the area.
        The first set of coordinates are for the outside points of the area,
        the rest are for the inner part of the area that is missing */
        feature.geometry.coordinates.forEach(points => {
            let currentPoints = [];
            points.forEach(point => {
                sumOfLatCoords += point[1];
                sumOfLongCoords += point[0];
                count++;
                let pixelCoords = convertLatLongToPixelCoords({ lat: point[1], long: point[0] })
                currentPoints.push(new THREE.Vector2(pixelCoords.x * grassAreaCoordsScale, pixelCoords.y * grassAreaCoordsScale));
            });
            if (!outerPoints.length) {
                outerPoints = currentPoints;
            }
            else {
                innerPoints.push(currentPoints);
            }
        });

        let pixelCoords = convertLatLongToPixelCoords({ lat: sumOfLatCoords / count, long: sumOfLongCoords / count })
        let newGrassArea = document.createElement('a-entity');
        newGrassArea.setAttribute("geometry", { primitive: "area", outerPoints: outerPoints, innerPoints: innerPoints, height: defaultAreaHeightAboveGround });
        newGrassArea.setAttribute("material", { roughness: "0.6", color: colour });
        newGrassArea.setAttribute("scale", areaScale + " " + 1 + " " + areaScale);
        newGrassArea.object3D.position.set((pixelCoords.x * grassAreaCoordsScale), 0, (pixelCoords.y * grassAreaCoordsScale));
        parentElement.appendChild(newGrassArea);

        if (lowQuality) return;
        heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
            Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
                try {
                    newGrassArea.object3D.position.set((pixelCoords.x * grassAreaCoordsScale), (heightMap[pixelCoords.roundedX][pixelCoords.roundedY]), (pixelCoords.y * grassAreaCoordsScale));
                } catch {
                    throw new Error("Specfic location on height map not found! (My own error)");
                }
            });
        });
        resolve();
    });
}