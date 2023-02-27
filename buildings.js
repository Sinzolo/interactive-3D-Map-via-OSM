'use strict';

const mainBuildingFetchWorker = new Worker('fetchWorker.js');
const secondaryBuildingFetchWorker = new Worker('fetchWorker.js');

const buildingScale = 10;                                // Scaling the buildings (bigger number = bigger buildings in the x and z)
const buildingHeightScale = 2.1;                          // Scale for the buildings height (bigger number = bigger buildings in y axis)
const buildingHeight = 3;                                 // Building height if height is unknown
const buildingHeightUnderGround = 10;                    // How far to extend the buildings under the ground
const defaultBuildingColour = "#7AA4C1";
const metresPerBuildingFloor = 4.3;                      // How many metres per floor (used for calculating the height of the building)

var buildingParent = document.createElement('a-entity');
buildingParent.setAttribute("id", "buildingParent");
buildingParent.setAttribute("class", "building");
document.querySelector('a-scene').appendChild(buildingParent);


async function loadBuildings(tempBboxPixelCoords, bboxSize) {
    debugLog("=== Loading Buildings ===");
    let bboxLatLongCoords = convertPixelCoordsToLatLong(tempBboxPixelCoords);
    var bbox = getBoundingBox(bboxLatLongCoords.lat, bboxLatLongCoords.long, bboxSize);
    var stringBBox = convertBBoxToString(bbox);
    var overpassQuery = overpassURL + encodeURIComponent(
        "(way[building](" + stringBBox + ");" +
        "rel[building](" + stringBBox + "););" +
        "out geom qt;>;"
    );

    const message = { overpassQuery };
    if ('caches' in window) message.osmCacheName = osmCacheName;
    mainBuildingFetchWorker.postMessage(message);

    return new Promise(resolve => {
        mainBuildingFetchWorker.onmessage = async function (e) {
            const features = convertOSMResponseToGeoJSON(e.data).features;
            features.forEach(feature => {
                if (feature.geometry.type == "Polygon") addBuilding(feature, buildingParent);
            });
            // loadFourEdgeChunks(structuredClone(tempBboxPixelCoords), bboxSize);
            // removeChunksFromCache();
            // priorChunks = currentChunks;
            // currentChunks = [];
            resolve("Finished Adding Buildings");
        }
    });
}

async function addBuilding(feature, parentElement) {
    return new Promise((resolve, reject) => {
        let tags = feature.properties;
        let height = getBuildingHeight(tags);
        let colour = getBuildingColour(tags);
        let coordinates = getBuildingCoordinates(feature.geometry.coordinates);
        let newBuilding = document.createElement('a-entity');
        newBuilding.setAttribute("geometry", { primitive: "building", outerPoints: coordinates.outerPoints, innerPoints: coordinates.innerPoints, height: height });
        newBuilding.setAttribute("material", { roughness: "0.8", color: colour });
        newBuilding.object3D.scale.set(buildingScale, buildingHeightScale, buildingScale);

        let pixelCoords = convertLatLongToPixelCoords({ lat: coordinates.avgLat, long: coordinates.avgLong })
        newBuilding.object3D.position.set((pixelCoords.x * buildingCoordsScale), 0, (pixelCoords.y * buildingCoordsScale));
        parentElement.appendChild(newBuilding);

        if (lowQuality) return;
        heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
            Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
                try {
                    newBuilding.object3D.position.set((pixelCoords.x * buildingCoordsScale), (heightMap[pixelCoords.roundedX][pixelCoords.roundedY]), (pixelCoords.y * buildingCoordsScale));
                } catch {
                    throw new Error("Specfic location on height map not found! (My own error)");
                }
            });
        });
        resolve();
    });
}

/**
 * Returns the height of the building
 * @param buildingsTags - The tags of the building
 * @returns The height of the building
 */
function getBuildingHeight(buildingsTags) {
    let height;
    if (buildingsTags.height) height = buildingsTags.height/metresPerBuildingFloor;
    else if (buildingsTags["building:levels"]) height = buildingsTags["building:levels"];
    else if (buildingsTags.amenity === "shelter") height = 1;
    else height = buildingHeight;
    return parseInt(height);
}

/**
 * Returns the colour of the building
 * @param buildingsTags - The tags of the building
 * @returns The colour of the building
 */
function getBuildingColour(buildingsTags) {
    return buildingsTags.colour || buildingsTags["building:colour"] || defaultBuildingColour;
}

/**
 * It takes in the set of coordinates of a building, and returns
 * the outer coords, inner coords, and centre coords of the building.
 * @param coordinatesOfBuilding - The coordinates of the building in the form of an array of arrays
 * @returns An object with the outer points of the building, the inner points of the building, and the
 * average latitude and longitude of the building.
 */
function getBuildingCoordinates(coordinatesOfBuilding) {
    let outerPoints = [];
    let innerPoints = [];
    let sumOfLatCoords = 0;
    let sumOfLongCoords = 0;
    let count = coordinatesOfBuilding[0].length;
    /* Loops through every coordinate of the building.
    The first set of coordinates are for the outside points of the building,
    the rest are for the inner part of the building that is missing */
    for (let index = 0; index < coordinatesOfBuilding.length; index++) {
        let coords = coordinatesOfBuilding[index];
        let currentPoints = [];
        for (let i = 0; i < coords.length; i++) {
            let coord = coords[i];
            if (index === 0) {
                sumOfLatCoords += coord[1];
                sumOfLongCoords += coord[0];
            }
            let { x, y } = convertLatLongToPixelCoords({ lat: coord[1], long: coord[0] });
            currentPoints.push(new THREE.Vector2(x * buildingCoordsScale, y * buildingCoordsScale));
        }
        if (index === 0) outerPoints = currentPoints;
        else innerPoints.push(currentPoints);
    }
    return { outerPoints, innerPoints, avgLat: sumOfLatCoords / count, avgLong: sumOfLongCoords / count };
}


/**
 * Removes all the buildings from the scene
 */
function removeCurrentBuildings() {
    removeAllChildren(buildingParent);
}

/**
 * It takes a bounding box in pixel coordinates, converts it to latitude and longitude coordinates,
 * then converts it to a bounding box in latitude and longitude coordinates, then converts it to a
 * string, then makes an overpass query, then sends the query to the worker.
 * @param tempBboxPixelCoords - The pixel coordinates of the bounding box to be fetched.
 * @param bboxSize - The size of the bounding box in degrees.
 */
function preloadBuildingChunk(tempBboxPixelCoords, bboxSize) {
    let bboxLatLongCoords = convertPixelCoordsToLatLong(tempBboxPixelCoords);
    let bbox = getBoundingBox(bboxLatLongCoords.lat, bboxLatLongCoords.long, bboxSize);
    let stringBBox = convertBBoxToString(bbox);
    let overpassQuery = overpassURL + encodeURIComponent(
        "(way[building](" + stringBBox + ");" +
        "rel[building](" + stringBBox + "););" +
        "out geom qt;>;"
    );
    secondaryBuildingFetchWorker.postMessage({ overpassQuery, osmCacheName });
}

AFRAME.registerGeometry('building', {
    schema: {
        outerPoints: {
            default: [new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)],
        },
        innerPoints: {
            default: [],
        },
        height: { type: 'number', default: buildingHeight },
    },
    init: function (data) {
        var shape = new THREE.Shape(data.outerPoints);
        for (let point of data.innerPoints) shape.holes.push(new THREE.Path(point));
        var geometry = new THREE.ExtrudeGeometry(shape, { depth: data.height + buildingHeightUnderGround, bevelEnabled: false });
        // As Y is the coordinate going up, let's rotate by 90° to point Z up.
        geometry.rotateX(-Math.PI / 2);
        // Rotate around Y and Z as well to make it show up correctly.
        geometry.rotateY(Math.PI);
        geometry.rotateZ(Math.PI);
        // Now we would point under ground, move up the height, and any above-ground space as well.
        geometry.translate(0, data.height, 0);
        geometry.center;
        this.geometry = geometry;
    }
});