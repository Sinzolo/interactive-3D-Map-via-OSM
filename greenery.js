'use strict';
const naturalFeaturesFetchWorker = new Worker('fetchWorker.js');

const defaultGrassAreaColour = "#4A9342";
const defaultWaterColour = "#0E87CC";
const areaScale = 4.8;              // Scaling the pedestrian areas (bigger number = bigger path in the x and z)
const defaultAreaHeightAboveGround = 0.14 + 0.0007; // How far it should stick above ground
const areaParent = document.createElement('a-entity');
areaParent.setAttribute("id", "areaParent");
areaParent.setAttribute("class", "areas");
document.querySelector('a-scene').appendChild(areaParent);

const defaultTreeHeightUnderGround = 10;     // How far it should stick under ground
const treeParent = document.createElement('a-entity');
treeParent.setAttribute("id", "treeParent");
treeParent.setAttribute("class", "trees");
document.querySelector('a-scene').appendChild(treeParent);

const trunkInstance = document.createElement('a-cylinder');
trunkInstance.setAttribute("id", "trunkInstance");
trunkInstance.setAttribute("height", "1");
trunkInstance.setAttribute("radius", "1");
trunkInstance.setAttribute("color", "#b27f36");

const sphericalLeavesInstance = document.createElement('a-sphere');
sphericalLeavesInstance.setAttribute("id", "sphericalLeavesInstance");
sphericalLeavesInstance.setAttribute("radius", 1);
sphericalLeavesInstance.setAttribute("segments-width", 7);
sphericalLeavesInstance.setAttribute("segments-height", 6);
sphericalLeavesInstance.setAttribute("roughness", 1);
sphericalLeavesInstance.setAttribute("color", "#60DF60");

const coneLeavesInstance = document.createElement('a-cone');
coneLeavesInstance.setAttribute("id", "coneLeavesInstance");
coneLeavesInstance.setAttribute("height", 1);
coneLeavesInstance.setAttribute("radius-bottom", 1);
coneLeavesInstance.setAttribute("radius-top", 0);
coneLeavesInstance.setAttribute("segments-radial", 5);
coneLeavesInstance.setAttribute("segments-height", 1);
coneLeavesInstance.setAttribute("roughness", 1);
coneLeavesInstance.setAttribute("color", "#50D453");

var instanceMeshesSetUp = false;
var numbOfTrees = 0;

/**
 * It takes a coordinate and a bounding box size, and then it queries the Overpass API for all the
 * grass and water features in that bounding box. It then converts the response to GeoJSON, and then
 * adds all the grass and water features to the scene.
 * @param coordinate - The coordinate of the center of the map
 * @param bboxSize - The size of the bounding box to load
 * @returns A promise that resolves when the natural features have been loaded
 */
async function loadNaturalFeatures(coordinate, bboxSize) {
    debugLog("=== Loading Natural Features ===");

    var stringBBox = convertBBoxToString(getBoundingBox(coordinate.lat, coordinate.long, bboxSize));
    var overpassQuery = overpassURL + encodeURIComponent(
        "[timeout:40];" +
        "(way[landuse=grass](" + stringBBox + ");" +
        "relation[landuse=grass](" + stringBBox + ");" +
        "way[natural=water](" + stringBBox + ");" +
        "node[natural=tree]" + "(" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );

    const message = { overpassQuery };
    if ('caches' in window) message.osmCacheName = osmCacheName;
    naturalFeaturesFetchWorker.postMessage(message);

    if (!instanceMeshesSetUp) {
        trunkInstance.setAttribute("instanced-mesh", "capacity:1000");
        sphericalLeavesInstance.setAttribute("instanced-mesh", "capacity:1000");
        coneLeavesInstance.setAttribute("instanced-mesh", "capacity:1000");
        scene.appendChild(trunkInstance);
        scene.appendChild(sphericalLeavesInstance);
        scene.appendChild(coneLeavesInstance);
        instanceMeshesSetUp = true;
    }

    return new Promise(async (resolve) => {
        naturalFeaturesFetchWorker.onmessage = async function (e) {
            numbOfTrees = 0;
            const features = convertOSMResponseToGeoJSON(e.data).features;
            features.forEach((feature) => {
                if (feature.geometry.type == "Polygon") addArea(feature, areaParent);
                else if (feature.geometry.type == "Point") {
                    addTree(feature, treeParent);
                    numbOfTrees++;
                }
            });
            resolve("Finished Adding Greenery");
        }
    });
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
        newGrassArea.object3D.scale.set(areaScale, 1, areaScale);
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

/**
 * It removes all the natural areas from the scene
 */
function removeCurrentNaturalAreas() {
    removeAllChildren(areaParent);
}

/**
 * It creates a tree with a trunk and leaves, and then positions it on the map
 * @param feature - The tree GeoJSON object
 * @param parentElement - The parent element to add the new tree to
 * @returns A promise that resolves when the tree has been added to the scene
 */
function addTree(feature, parentElement) {
    return new Promise((resolve, reject) => {
        let tags = feature.properties;
        let height = tags.height ? tags.height : 4.2;
        let trunkRadius = ((tags.circumference ? tags.circumference : 1) / 2 / Math.PI) * 2.2;
        let leavesRadius = ((tags.diameter_crown ? tags.diameter_crown : 3) / 2) * 0.87;
        let pixelCoords = convertLatLongToPixelCoords({ lat: feature.geometry.coordinates[1], long: feature.geometry.coordinates[0] });
        let trunkHeight = height - leavesRadius;
        var leavesHeight = trunkHeight * 0.95;
        let trunk = document.createElement("a-entity");
        trunk.setAttribute("id", "trunk" + numbOfTrees);
        trunk.setAttribute("instanced-mesh-member", "mesh:#trunkInstance;");

        let leaves = document.createElement("a-entity");
        if (tags["leaf_type"] == "needleleaved" || Math.floor(Math.random() * 2) === 0) { // Conical leaves
            leaves.setAttribute("id", "coneLeaves" + numbOfTrees);
            leaves.setAttribute("instanced-mesh-member", "mesh:#coneLeavesInstance;");
            leaves.object3D.scale.set(leavesRadius, height * 0.75, leavesRadius);
        }
        else { // Spherical leaves
            leaves.setAttribute("id", "sphereLeaves" + numbOfTrees);
            leaves.setAttribute("instanced-mesh-member", "mesh:#sphericalLeavesInstance;");
            leaves.object3D.scale.set(leavesRadius, leavesRadius, leavesRadius);
        }
        leaves.object3D.position.set((pixelCoords.x), (leavesHeight), (pixelCoords.y));
        trunk.object3D.scale.set(trunkRadius, (trunkHeight + defaultTreeHeightUnderGround), trunkRadius);
        trunk.object3D.position.set((pixelCoords.x), (trunkHeight - defaultTreeHeightUnderGround) / 2 , (pixelCoords.y));
        parentElement.appendChild(leaves);
        parentElement.appendChild(trunk);

        if (lowQuality) return;
        heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
            Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
                try {
                    trunk.object3D.position.set((pixelCoords.x), (trunkHeight - defaultTreeHeightUnderGround) / 2 + (heightMap[pixelCoords.roundedX][pixelCoords.roundedY]), (pixelCoords.y));
                    leaves.object3D.position.set((pixelCoords.x), (yComponent) + (heightMap[pixelCoords.roundedX][pixelCoords.roundedY]), (pixelCoords.y));
                } catch(e) {
                    throw new Error("Specfic location on height map not found! (My own error)");
                }
            });
        });
        resolve();
    });
}

/**
 * It removes all the trees from the scene
 */
function removeCurrentTrees() {
    removeAllChildren(treeParent);
}