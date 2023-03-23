'use strict';

const mainBuildingFetchWorker = new Worker('fetchWorker.js');
const secondaryBuildingFetchWorker = new Worker('fetchWorker.js');

const buildingScale = 60;                                // Scaling the buildings (bigger number = bigger buildings in the x and z)
const buildingHeightScale = 2.1;                          // Scale for the buildings height (bigger number = bigger buildings in y axis)
const buildingHeight = 3;                                 // Building height if height is unknown
const buildingHeightUnderGround = 10;                    // How far to extend the buildings under the ground
const defaultBuildingColour = "#7AA4C1";
const metresPerBuildingFloor = 4.3;                      // How many metres per floor (used for calculating the height of the building)

var buildingParent = document.createElement('a-entity');
buildingParent.setAttribute("id", "buildingParent");
buildingParent.setAttribute("class", "building");
document.querySelector('a-scene').appendChild(buildingParent);


/**
 * Sends an Overpass query to the Overpass API to get all the buildings in the given bounding box.
 * It then converts the response to GeoJSON, and adds the buildings to the scene.
 * @param bboxPixelCoords - The pixel coordinates of the bounding box.
 * @param bboxSize - The size of the bounding box in metres.
 * @returns A promise that resolves when the buildings have been added to the scene.
 */
async function loadBuildings(bboxPixelCoords, bboxSize) {
    debugLog("=== Loading Buildings ===");
    const message = { overpassQuery: constructBuildingOverpassQuery(bboxPixelCoords, bboxSize) };
    if ('caches' in window) message.osmCacheName = osmCacheName;
    mainBuildingFetchWorker.postMessage(message);

    return new Promise(resolve => {
        mainBuildingFetchWorker.onmessage = async function (e) {
            const features = convertOSMResponseToGeoJSON(e.data).features;
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                if (feature.geometry.type == "Polygon") addBuilding(feature, buildingParent);
            }
            resolve("Finished Adding Buildings");
        }
    });
}

/**
 * Creates a string that is the building URL for the Overpass API query.
 * @param bboxPixelCoords - The pixel coordinates of the bounding box.
 * @param bboxSize - The size of the bounding box in metres.
 * @returns A string that is the URL for the Overpass API query.
 */
function constructBuildingOverpassQuery(bboxPixelCoords, bboxSize) {
    let bboxLatLongCoords = convertPixelCoordsToLatLong(bboxPixelCoords);
    var bbox = getBoundingBox(bboxLatLongCoords.lat, bboxLatLongCoords.long, bboxSize);
    var stringBBox = convertBBoxToString(bbox);
    return overpassURL + encodeURIComponent(
        "(way[building](" + stringBBox + ");" +
        "rel[building](" + stringBBox + "););" +
        "out geom qt;>;"
    );
}

/**
 * It takes a building feature from the OSM data and then creates
 * an A-Frame entity with the appropriate geometry and material.
 * @param feature - The building feature object from the GeoJSON file.
 * @param parentElement - The parent element to append the building to.
 * @returns A promise that resolves when the building has been added to the scene.
 */
async function addBuilding(feature, parentElement) {
    return new Promise(resolve => {
        let tags = feature.properties;
        let height = getBuildingHeight(tags);
        let colour = getBuildingColour(tags);
        let coordinates = getBuildingCoordinates(feature.geometry.coordinates);
        let pixelCoords = convertLatLongToPixelCoords({ lat: coordinates.avgLat, long: coordinates.avgLong })
        let newBuilding = document.createElement('a-entity');
        newBuilding.setAttribute("geometry", {
            primitive: "building",
            outerPoints: coordinates.outerPoints,
            innerPoints: coordinates.innerPoints,
            height: height
        });
        newBuilding.setAttribute("material", { roughness: "0.8", color: colour });
        newBuilding.object3D.scale.set(buildingScale, buildingHeightScale, buildingScale);
        newBuilding.object3D.position.set((pixelCoords.x * buildingCoordsScale), 0, (pixelCoords.y * buildingCoordsScale));
        parentElement.appendChild(newBuilding);
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
 * Queries the Overpass API for buildings in the bounding box and stores the response in cache.
 * @param tempBboxPixelCoords - The pixel coordinates of the bounding box to be fetched.
 * @param bboxSize - The size of the bounding box in metres.
 */
function preloadBuildingChunk(tempBboxPixelCoords, bboxSize) {
    secondaryBuildingFetchWorker.postMessage({ overpassQuery: constructBuildingOverpassQuery(tempBboxPixelCoords, bboxSize), osmCacheName });
}

/* Creating a custom geometry for buildings. */
AFRAME.registerGeometry('building', {
    schema: {
        outerPoints: {
            default: [
                new THREE.Vector2(0, 0), new THREE.Vector2(0, 1),
                new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)
            ],
        },
        innerPoints: { default: [] },
        height: { type: 'number', default: buildingHeight },
    },
    init: function (data) {
        var shape = new THREE.Shape(data.outerPoints);
        // Adding the holes to the shape.
        for (let point of data.innerPoints) shape.holes.push(new THREE.Path(point));
        var geometry = new THREE.ExtrudeGeometry(shape, {
            depth: data.height + buildingHeightUnderGround,
            bevelEnabled: false
        });
        // Rotate the geometry so that it is facing the right way.
        geometry.rotateX(-Math.PI / 2);
        geometry.rotateY(Math.PI);
        geometry.rotateZ(Math.PI);
        // Move the geometry up so that the shape is at the correct height.
        geometry.translate(0, data.height, 0);
        this.geometry = geometry;
    }
});