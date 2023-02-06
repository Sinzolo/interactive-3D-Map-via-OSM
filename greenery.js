'use strict';
const greeneryFetchWorker = new Worker('fetchWorker.js');

const defaultGrassAreaColour = "#4A9342";
const grassAreaScale = 4.8;              // Scaling the pedestrian areas (bigger number = bigger path in the x and z)
const defaultGrassAreaHeightAboveGround = 0.16; // How far it should stick above ground
const grassAreaHeightUnderGround = 30;   // How far it should stick below ground
const grassAreaParent = document.createElement('a-entity');
grassAreaParent.setAttribute("id", "greeneryAreaParent");
grassAreaParent.setAttribute("class", "greeneryArea");
document.querySelector('a-scene').appendChild(grassAreaParent);

async function loadGreenery(coordinate, bboxSize) {
    console.log("=== Loading Paths ===");

    var stringBBox = convertBBoxToString(getBoundingBox(coordinate.lat, coordinate.long, bboxSize));
    var overpassQuery = overpassURL + encodeURIComponent(
        "[timeout:40];" +
        "(way[landuse=grass](" + stringBBox + ");" +
        "relation[landuse=grass](" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );

    if ('caches' in window) {
        greeneryFetchWorker.postMessage({ overpassQuery, osmCacheName });
    }
    else {
        greeneryFetchWorker.postMessage({ overpassQuery });
    }

    return new Promise(async (resolve) => {
        greeneryFetchWorker.onmessage = async function (e) {
            numberOfPaths = 0;
            paths = [];
            rectangles = [];
            dijkstrasAlgorithm = new DijkstrasAlgo();
            const features = convertOSMResponseToGeoJSON(e.data).features;
            features.forEach((feature) => {
                if (feature.geometry.type == "Polygon") {   // Grassy Area
                    addGrassArea(feature, grassAreaParent);
                }
            });
            resolve("Finished Adding Greenery");
        }
    });
}

/**
 * Takes an XML response from the OSM API and converts it to GeoJSON
 * @param response - The response from the OSM API.
 * @returns A GeoJSON object.
 */
function convertOSMResponseToGeoJSON(response) {
    return osmtogeojson(new DOMParser().parseFromString(response, "application/xml"));
}

/**
 * Removes all the paths from the scene
 */
function removeCurrentGreenery() {
    console.log("=== Deleting Greenery Area ===");
    removeAllChildren(grassAreaParent);
}

function addGrassArea(feature, parentElement) {
    return new Promise((resolve, reject) => {
        let colour = defaultGrassAreaColour;

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
        newGrassArea.setAttribute("geometry", { primitive: "area", outerPoints: outerPoints, innerPoints: innerPoints, height: defaultGrassAreaHeightAboveGround });
        newGrassArea.setAttribute("material", { roughness: "0.6", color: colour });
        newGrassArea.setAttribute("scale", grassAreaScale + " " + 1 + " " + grassAreaScale);
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