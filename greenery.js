'use strict';
const naturalFeaturesFetchWorker = new Worker('fetchWorker.js');

const defaultGrassAreaColour = "#4A9342";
const defaultWaterColour = "#0E87CC";
const areaScale = 60;              // Scaling the pedestrian areas (bigger number = bigger path in the x and z)
const defaultAreaHeightAboveGround = 0.08 + 0.0007; // How far it should stick above ground
const multiSphereTreeScale = 0.5;              // Scaling the trees (bigger number = bigger tree)
const pointyTreeScale = 0.7;              // Scaling the trees (bigger number = bigger tree)
const scene = document.querySelector("a-scene");

const areaParent = document.createElement('a-entity');
areaParent.setAttribute("id", "areaParent");
areaParent.setAttribute("class", "areas");
document.querySelector('a-scene').appendChild(areaParent);

const defaultTreeHeightUnderGround = 10;     // How far it should stick under ground
const treeParent = document.createElement('a-entity');
treeParent.setAttribute("id", "treeParent");
treeParent.setAttribute("class", "trees");
document.querySelector('a-scene').appendChild(treeParent);

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
async function loadNaturalFeatures(bboxPixelCoords, bboxSize) {
    debugLog("=== Loading Natural Features ===");

    let bboxLatLongCoords = convertPixelCoordsToLatLong(bboxPixelCoords);
    var stringBBox = convertBBoxToString(getBoundingBox(bboxLatLongCoords.lat, bboxLatLongCoords.long, bboxSize));
    var overpassQuery = overpassURL + encodeURIComponent(
        "[timeout:40];" +
        "(way[landuse=grass](" + stringBBox + ");" +
        "relation[landuse=grass](" + stringBBox + ");" +
        "way[natural=water](" + stringBBox + ");" +
        "node[natural=tree]" + "(" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );

    const message = { overpassQuery };
    naturalFeaturesFetchWorker.postMessage(message);

    return new Promise(async (resolve) => {
        naturalFeaturesFetchWorker.onmessage = async function (e) {
            let treesToAdd = [];
            numbOfTrees = 0;
            const features = convertOSMResponseToGeoJSON(e.data).features;
            instanceMeshesSetUp ||= (setMeshesVisible(), true);
            // '||=' is an operator that only sets the variable if it is false. If false, call setMeshesVisible() and set instanceMeshesSetUp to true.
            // Very weird but cool.
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                if (feature.geometry.type === "Polygon") addArea(feature, areaParent);
                else if (feature.geometry.type === "Point") {
                    treesToAdd.push(feature);
                    numbOfTrees++;
                }
            }

            setUpInstanceMeshes(numbOfTrees);

            for (let i = 0; i < treesToAdd.length; i++) {
                addTree(treesToAdd[i], treeParent);
            }
            resolve("Finished Adding Greenery");
        }
    });
}

/**
 * It removes the old tree meshes from the scene
 */
function removeOldInstanceMeshes() {
    let trunkInstance = document.getElementById("trunkInstance")
    if (trunkInstance) trunkInstance.remove();
    let sphericalLeavesInstance = document.getElementById("sphericalLeavesInstance")
    if (sphericalLeavesInstance) sphericalLeavesInstance.remove();
    let multiSphereTreeInstance = document.getElementById("multiSphereTreeMesh")
    if (multiSphereTreeInstance) multiSphereTreeInstance.remove();
    let pointyTreeInstance = document.getElementById("pointyTreeMesh")
    if (pointyTreeInstance) pointyTreeInstance.remove();
}

/**
 * It creates a new instance mesh for each tree type, and adds it to the scene.
 * @param capacity - The capacity of the instance meshes
 */
function setUpInstanceMeshes(capacity) {
    removeOldInstanceMeshes();

    const trunkInstance = document.createElement('a-cone');
    trunkInstance.setAttribute("id", "trunkInstance");
    trunkInstance.setAttribute("height", 1);
    trunkInstance.setAttribute("radius-bottom", 3.4);
    trunkInstance.setAttribute("radius-top", 1);
    trunkInstance.setAttribute("segments-radial", 4);
    trunkInstance.setAttribute("segments-height", 1);
    trunkInstance.setAttribute("roughness", 1);
    trunkInstance.setAttribute("color", "#b27f36");
    trunkInstance.setAttribute("instanced-mesh", "capacity:" + capacity);
    scene.appendChild(trunkInstance);

    const sphericalLeavesInstance = document.createElement('a-sphere');
    sphericalLeavesInstance.setAttribute("id", "sphericalLeavesInstance");
    sphericalLeavesInstance.setAttribute("radius", 1);
    sphericalLeavesInstance.setAttribute("segments-width", 5);
    sphericalLeavesInstance.setAttribute("segments-height", 4);
    sphericalLeavesInstance.setAttribute("roughness", 1);
    sphericalLeavesInstance.setAttribute("color", "#59C401");
    sphericalLeavesInstance.setAttribute("instanced-mesh", "capacity:" + capacity);
    scene.appendChild(sphericalLeavesInstance);

    const multiSphereTreeInstance = document.createElement('a-entity');
    multiSphereTreeInstance.setAttribute("id", "multiSphereTreeMesh");
    multiSphereTreeInstance.setAttribute("gltf-model", "#multiSphereTreeModel");
    multiSphereTreeInstance.object3D.scale.set(multiSphereTreeScale, multiSphereTreeScale, multiSphereTreeScale);
    multiSphereTreeInstance.object3D.position.set(0, -1 * multiSphereTreeScale, 0);
    multiSphereTreeInstance.setAttribute("instanced-mesh", "capacity:" + capacity);
    scene.appendChild(multiSphereTreeInstance);

    const pointyTreeInstance = document.createElement('a-entity');
    pointyTreeInstance.setAttribute("id", "pointyTreeMesh");
    pointyTreeInstance.setAttribute("gltf-model", "#pointyTreeModel");
    pointyTreeInstance.object3D.scale.set(pointyTreeScale, pointyTreeScale, pointyTreeScale);
    pointyTreeInstance.object3D.position.set(0, -1 * pointyTreeScale, 0);
    pointyTreeInstance.setAttribute("instanced-mesh", "capacity:" + capacity);
    scene.appendChild(pointyTreeInstance);
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
        for (let i = 0; i < feature.geometry.coordinates.length; i++) {
            const points = feature.geometry.coordinates[i];
            let currentPoints = [];
            for (let j = 0; j < points.length; j++) {
                const point = points[j];
                sumOfLatCoords += point[1];
                sumOfLongCoords += point[0];
                count++;
                let pixelCoords = convertLatLongToPixelCoords({ lat: point[1], long: point[0] });
                currentPoints.push(new THREE.Vector2(pixelCoords.x * areaCoordsScale, pixelCoords.y * areaCoordsScale));
            }
            if (!outerPoints.length) outerPoints = currentPoints;
            else innerPoints.push(currentPoints);
        }

        let pixelCoords = convertLatLongToPixelCoords({ lat: sumOfLatCoords / count, long: sumOfLongCoords / count })
        let newGrassArea = document.createElement('a-entity');
        newGrassArea.setAttribute("geometry", { primitive: "area", outerPoints: outerPoints, innerPoints: innerPoints, height: defaultAreaHeightAboveGround });
        newGrassArea.setAttribute("material", { roughness: "0.6", color: colour });
        // newGrassArea.setAttribute("material", { src: "#grassTexture", repeat: "15 15", roughness: "1" });
        newGrassArea.object3D.scale.set(areaScale, 1, areaScale);
        newGrassArea.object3D.position.set((pixelCoords.x * areaCoordsScale), 0, (pixelCoords.y * areaCoordsScale));
        parentElement.appendChild(newGrassArea);
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
        let height = Math.random() * 0.3 + 3.9;
        let trunkRadius = (Math.random() * 0.4 + 0.8) / 2 / Math.PI * 2.2;
        let leavesRadius = (Math.random() + 2.5) / 2 * 0.87;
        let trunkHeight = height - leavesRadius;
        var leavesHeight = trunkHeight * 0.95;
        let pixelCoords = convertLatLongToPixelCoords({ lat: feature.geometry.coordinates[1], long: feature.geometry.coordinates[0] });

        let random = Math.random();
        if (random > 0.8) { // Spherical Tree
            var trunk = document.createElement("a-entity");
            trunk.setAttribute("id", "trunk" + numbOfTrees);
            trunk.setAttribute("instanced-mesh-member", "mesh:#trunkInstance;");
            trunk.object3D.scale.set(trunkRadius, (trunkHeight + defaultTreeHeightUnderGround), trunkRadius);
            trunk.object3D.position.set(pixelCoords.x, (trunkHeight - defaultTreeHeightUnderGround) / 2, pixelCoords.y);
            parentElement.appendChild(trunk);

            var leaves = document.createElement("a-entity");
            leaves.setAttribute("id", "sphereLeaves" + numbOfTrees);
            leaves.setAttribute("instanced-mesh-member", "mesh:#sphericalLeavesInstance;");
            leaves.object3D.scale.set(leavesRadius, leavesRadius, leavesRadius);
            leaves.object3D.position.set(pixelCoords.x, leavesHeight, pixelCoords.y);
            parentElement.appendChild(leaves);
        }
        else {
            let tree = document.createElement("a-entity");
            if (tags["leaf_type"] == "needleleaved" || random < 0.1) { // Pointy Tree
                tree.setAttribute("id", "pointyTree" + numbOfTrees);
                tree.setAttribute("instanced-mesh-member", "mesh:#pointyTreeMesh;");
                tree.setAttribute("rotation", "0 " + Math.floor(Math.random() * 360) + " 0");
                tree.object3D.position.set(pixelCoords.x * (1 / pointyTreeScale), 0, pixelCoords.y * 1 / pointyTreeScale);
            }
            else { // Multi Spherical Tree
                tree.setAttribute("id", "multiSphereTree" + numbOfTrees);
                tree.setAttribute("instanced-mesh-member", "mesh:#multiSphereTreeMesh;");
                tree.setAttribute("rotation", Math.floor(Math.random() * 13) + 22 + " " + Math.floor(Math.random() * 360) + " 0");
                tree.object3D.position.set(pixelCoords.x * (1 / multiSphereTreeScale), 0, pixelCoords.y * 1 / multiSphereTreeScale);
            }
            let randomScale = Math.random() * 0.4 + 0.9;
            tree.object3D.scale.set(randomScale, randomScale+0.13, randomScale);
            parentElement.appendChild(tree);
        }

        resolve();
    });
}

/**
 * Makes all the instanced meshes visible.
 */
function setMeshesVisible() {
    let meshes = document.querySelectorAll("[instanced-mesh]");
    for (let i = 0; i < meshes.length; i++) meshes[i].setAttribute("visible", true);
}

/**
 * It removes all the trees from the scene
 */
function removeCurrentTrees() {
    removeAllChildren(treeParent);
}