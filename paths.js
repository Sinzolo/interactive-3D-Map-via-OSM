'use strict';
const pathFetchWorker = new Worker('fetchWorker.js');
const defaultPathWidth = 0.7;       // Path width in metres
const roadWidth = 1.5;              // Road width in metres
const defaultPathHeightAboveGround = 0.16; // How far it should stick above ground
const pathHeightUnderGround = 30;   // How far it should stick below ground
const pathSegmentationLength = 5;   // The length of each segment of a path (bigger number = less segments per path so better performance)
const pathScale = 4.8;              // Scaling the paths (bigger number = bigger path in the x and z)
const defaultPathColour = "#979797";
const pathLookAhead = 2500;         // How much bigger the bbox is for the paths to see ahead for navigation
const pathParent = document.createElement('a-entity');
pathParent.setAttribute("id", "pathParent");
pathParent.setAttribute("class", "path");
document.querySelector('a-scene').appendChild(pathParent);
const highwayStyles = {
    motorway: { color: "#404040", pathWidth: 1.6, pathHeightAboveGround: defaultPathHeightAboveGround + 0.012 },    // Varrying heights to try and discourage z-fighting
    trunk: { color: "#505050", pathWidth: 1.45, pathHeightAboveGround: defaultPathHeightAboveGround + 0.0095 },
    primary: { color: "#606060", pathWidth: 1.3, pathHeightAboveGround: defaultPathHeightAboveGround + 0.0073 },
    secondary: { color: "#707070", pathWidth: 1.2, pathHeightAboveGround: defaultPathHeightAboveGround + 0.0051 },
    tertiary: { color: "#808080", pathWidth: 1.05, pathHeightAboveGround: defaultPathHeightAboveGround + 0.004 },
    residential: { color: "#909090", pathWidth: 1, pathHeightAboveGround: defaultPathHeightAboveGround + 0.0028 },
    unclassified: { color: "#9B9B9B", pathWidth: 1, pathHeightAboveGround: defaultPathHeightAboveGround + 0.002 },
    service: { color: "#b3a994", pathWidth: 0.8, pathHeightAboveGround: defaultPathHeightAboveGround + 0.0012 },
    pedestrian: { color: "#ABABAB", pathWidth: 0.7, pathHeightAboveGround: defaultPathHeightAboveGround + 0.016 },
    footway: { color: "#C6C6C6", pathWidth: 0.3, pathHeightAboveGround: defaultPathHeightAboveGround + 0.017 },
    path: { color: "#C6C6C6", pathWidth: 0.3, pathHeightAboveGround: defaultPathHeightAboveGround + 0.018 },
    steps: { color: "#FFFFFF", pathWidth: 0.3, pathHeightAboveGround: defaultPathHeightAboveGround + 0.014 },
};

var numberOfPaths;
var paths;              // E.g., [[0,1,2,3], [4,1,5,6,7,8], [9,10,11,3], ...]    Each index is a path and each number is a node that makes up that path
var rectangles;         // E.g., [[rectangle1, rectangle2], [rectangle3], ...]   Each index is a path and each rectangle makes up that path
var dijkstrasAlgorithm;
var pathPromise;

async function loadPaths(coordinate, bboxSize) {
    console.log("=== Loading Paths ===");

    var pathBboxConstraint = getBoundingBox(coordinate.lat, coordinate.long, bboxSize);
    var stringBBox = convertBBoxToString(getBoundingBox(coordinate.lat, coordinate.long, (bboxSize + pathLookAhead)));
    var overpassQuery = overpassURL + encodeURIComponent(
        "[timeout:40];" +
        "(way[highway=path](" + stringBBox + ");" +
        "way[highway=pedestrian](" + stringBBox + ");" +
        "way[highway=footway](" + stringBBox + ");" +
        "way[highway=steps](" + stringBBox + ");" +
        "way[highway=motorway](" + stringBBox + ");" +
        "way[highway=trunk](" + stringBBox + ");" +
        "way[highway=primary](" + stringBBox + ");" +
        "way[highway=secondary](" + stringBBox + ");" +
        "way[highway=tertiary](" + stringBBox + ");" +
        "way[highway=residential](" + stringBBox + ");" +
        "way[highway=unclassified](" + stringBBox + ");" +
        "way[highway=service](" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );

    if ('caches' in window) {
        pathFetchWorker.postMessage({ overpassQuery, osmCacheName });
    }
    else {
        pathFetchWorker.postMessage({ overpassQuery });
    }

    return new Promise(async (resolve) => {
        pathFetchWorker.onmessage = async function (e) {
            numberOfPaths = 0;
            paths = [];
            rectangles = [];
            dijkstrasAlgorithm = new DijkstrasAlgo();
            const features = convertOSMResponseToGeoJSON(e.data).features;
            features.forEach((feature) => {
                if (feature.geometry.type == "Polygon") {   // Pedestrian Area
                }
                else if (feature.geometry.type == "LineString") {   // Path
                    addPath(feature, pathParent, pathBboxConstraint);
                    numberOfPaths++;
                }
            });
            console.log("paths", paths);
            console.log("rectangles", rectangles);
            console.log("Number of paths: ", numberOfPaths);
            resolve("Finished Adding Paths");
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


async function addPath(feature, parentElement, pathBboxConstraint) {
    let tags = feature.properties;
    let { color, pathWidth, pathHeightAboveGround } = highwayStyles[tags.highway] || { color: defaultPathColour, pathWidth: defaultPathWidth, pathHeightAboveGround: defaultPathHeightAboveGround };
    if (tags.service == "alley") { color = "#967A72"; pathWidth = 0.2; pathHeightAboveGround = defaultPathHeightAboveGround + 0.0155; }

    paths[numberOfPaths] = [];
    rectangles[numberOfPaths] = [];

    for (let i = 1; i < feature.geometry.coordinates.length; i++) {
        let point1 = feature.geometry.coordinates[i - 1];
        let point2 = feature.geometry.coordinates[i];
        if (tags.highway != 'motorway') dijkstrasAlgorithm.addPair(point1, point2);  // Doesn't add motorways to the navigation graph

        let outsideWindow1 = point1[0] < pathBboxConstraint.minLng || point1[1] < pathBboxConstraint.minLat || point1[0] > pathBboxConstraint.maxLng || point1[1] > pathBboxConstraint.maxLat;
        let outsideWindow2 = point2[0] < pathBboxConstraint.minLng || point2[1] < pathBboxConstraint.minLat || point2[0] > pathBboxConstraint.maxLng || point2[1] > pathBboxConstraint.maxLat;

        /* Checks if the path is off the edge of the map */
        if (outsideWindow1 || outsideWindow2) {
            rectangles[numberOfPaths].push(null);
            // newPath.setAttribute("visible", false);     // Sets it invisible
            continue;
        }

        let pixelCoords1 = convertLatLongToPixelCoords({ lat: point1[1], long: point1[0] });
        let pixelCoords2 = convertLatLongToPixelCoords({ lat: point2[1], long: point2[0] });

        let pathProperties = { primitive: "path", fourCorners: getRectangleCorners({ x: pixelCoords1.x * pathCoordsScale, y: pixelCoords1.y * pathCoordsScale }, { x: pixelCoords2.x * pathCoordsScale, y: pixelCoords2.y * pathCoordsScale }, pathWidth), height: pathHeightAboveGround };
        let newPath = document.createElement('a-entity');
        newPath.setAttribute("geometry", pathProperties);
        newPath.setAttribute("material", { roughness: "0.6", color: color });
        newPath.setAttribute("scale", pathScale + " 1 " + pathScale);

        if (tags.highway != 'motorway') rectangles[numberOfPaths].push(newPath);    // Stores rectangle entity for later use
        else rectangles[numberOfPaths].push(null);

        let pixelCoords = { x: (pixelCoords1.x + pixelCoords2.x) / 2, y: (pixelCoords1.y + pixelCoords2.y) / 2, roundedX: Math.round((pixelCoords1.x + pixelCoords2.x) / 2), roundedY: Math.round((pixelCoords1.y + pixelCoords2.y) / 2) };

        /* Place every path at ground level in case height map takes a while */
        newPath.object3D.position.set((pixelCoords.x * pathCoordsScale), 0, (pixelCoords.y * pathCoordsScale));
        parentElement.appendChild(newPath);

        /* Waiting for the height map */
        if (lowQuality) continue;
        heightMaps.then(({ windowedTwoDHeightMapArray, twoDHeightMapArray }) => {
            Promise.all([windowedTwoDHeightMapArray, twoDHeightMapArray]).then(([_unused, heightMap]) => {
                try {
                    newPath.object3D.position.set((pixelCoords.x * pathCoordsScale), (heightMap[pixelCoords.roundedX][pixelCoords.roundedY]), (pixelCoords.y * pathCoordsScale));
                } catch {
                    throw new Error("Specfic location on height map not found! (My own error)");
                }
            });
        });
    }
}

function segmentPath({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    // TODO
}

function findAngleBetweenTwoCoords({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    // TODO
}

/**
 * Returns the four corners of a rectangle that is around the line between the two points.
 * @param width - The width of the rectangle
 * @returns An array of four THREE.Vector2 objects.
 */
function getRectangleCorners({ x: x1, y: y1 }, { x: x2, y: y2 }, width) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const length = Math.hypot((x1 - x2), (y1 - y2));    // Distance between the two points
    const angle = Math.atan2(y2 - y1, x2 - x1);         // The angle of the line between the two points
    const halfWidth = width / 2;                        // Half the width
    const halfLength = length * 0.63;                   // A little bit more than half to ensure overlapping

    // Calculating the four corners of the rectnagle
    const topLeft = {
        x: centerX + halfWidth * Math.cos(angle + Math.PI / 2) - halfLength * Math.sin(angle + Math.PI / 2),
        y: centerY + halfWidth * Math.sin(angle + Math.PI / 2) + halfLength * Math.cos(angle + Math.PI / 2)
    };
    const topRight = {
        x: centerX + halfWidth * Math.cos(angle - Math.PI / 2) - halfLength * Math.sin(angle - Math.PI / 2),
        y: centerY + halfWidth * Math.sin(angle - Math.PI / 2) + halfLength * Math.cos(angle - Math.PI / 2)
    };
    const bottomLeft = {
        x: centerX - halfWidth * Math.cos(angle + Math.PI / 2) - halfLength * Math.sin(angle + Math.PI / 2),
        y: centerY - halfWidth * Math.sin(angle + Math.PI / 2) + halfLength * Math.cos(angle + Math.PI / 2)
    };
    const bottomRight = {
        x: centerX - halfWidth * Math.cos(angle - Math.PI / 2) - halfLength * Math.sin(angle - Math.PI / 2),
        y: centerY - halfWidth * Math.sin(angle - Math.PI / 2) + halfLength * Math.cos(angle - Math.PI / 2)
    };

    return [new THREE.Vector2(bottomLeft.x, bottomLeft.y), new THREE.Vector2(topRight.x, topRight.y), new THREE.Vector2(bottomRight.x, bottomRight.y), new THREE.Vector2(topLeft.x, topLeft.y)];
}


/**
 * Removes all the paths from the scene
 */
function removeCurrentPaths() {
    console.log("=== Deleting Paths ===");
    removeAllChildren(pathParent);
}


AFRAME.registerGeometry('path', {
    schema: {
        fourCorners: {
            default: [new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)],
        },
        height: { type: 'number', default: defaultPathHeightAboveGround },
    },
    init: function (data) {
        var shape = new THREE.Shape(data.fourCorners);
        var geometry = new THREE.ExtrudeGeometry(shape, { depth: data.height + pathHeightUnderGround, bevelEnabled: false });
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