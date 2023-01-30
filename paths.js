'use strict';

const defaultPathWidth = 0.7;       // Path width in metres
const roadWidth = 1.5;              // Road width in metres
const pathHeightAboveGround = 0.16; // How far it should stick above ground
const pathHeightUnderGround = 30;  // How far it should stick below ground
const pathSegmentationLength = 5;   // The length of each segment of a path (bigger number = less segments per path so better performance)
const pathScale = 4.8;                                // Scaling the paths (bigger number = bigger path in the x and z)
const defaultPathColour = "#979797";
const highwayStyles = {
    motorway: { color: "#404040", pathWidth: 1.6 },
    trunk: { color: "#505050", pathWidth: 1.45 },
    primary: { color: "#606060", pathWidth: 1.3 },
    secondary: { color: "#707070", pathWidth: 1.2 },
    tertiary: { color: "#808080", pathWidth: 1.05 },
    residential: { color: "#909090", pathWidth: 1 },
    unclassified: { color: "#9B9B9B", pathWidth: 1 },
    service: { color: "#b3a994", pathWidth: 0.8 },
    pedestrian: { color: "#ABABAB", pathWidth: 0.7 },
    footway: { color: "#C6C6C6", pathWidth: 0.3 },
    path: { color: "#C6C6C6", pathWidth: 0.3 },
    steps: { color: "#FFFFFF", pathWidth: 0.3 },
};
var numberOfPaths;
var nodes;              // E.g., [[long,lat], [long,lat], ...]   Each node only once.
var connectedNodes;     // E.g., [[], [0,2,3,8], [45,12,0], ...]  Each index of the outer array is the node and each number in the inner array is what that node is connected to
var paths;              // E.g., [[0,1,2,3], [4,1,5,6,7,8], [9,10,11,3], ...]    Each index is a path and each number is a node that makes up that path
var rectangles;         // E.g., [[rectangle1, rectangle2], [rectangle3], ...]   Each index is a path and each rectangle makes up that path
var dijkstrasAlgorithm;
var pathPromise;

async function loadPaths(coordinate, bboxSize) {
    console.log("=== Loading Paths ===");

    bboxSize += 0;

    pathPromise = new Promise(async (resolve, reject) => {
        bboxSize *= 0.9;
        var bbox = getBoundingBox(coordinate.lat, coordinate.long, bboxSize);
        var stringBBox = convertBBoxToString(bbox);
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
            console.log("Caches");
            fetchWorker.postMessage({ overpassQuery, osmCacheName });
        }
        else {
            console.log("Yo better fucking not");
            fetchWorker.postMessage({ overpassQuery, osmCacheName: "IM GONNA KILL" });
        }

        let sceneElement = document.querySelector('a-scene');
        let pathParent = document.createElement('a-entity');
        pathParent.setAttribute("id", "pathParent");
        pathParent.setAttribute("class", "path");
        sceneElement.appendChild(pathParent);

        fetchWorker.onmessage = async function (e) {
            let response = e.data;

            let geoJSON = convertOSMResponseToGeoJSON(response);

            numberOfPaths = 0;
            paths = [];
            nodes = [];
            rectangles = [];
            connectedNodes = [];
            dijkstrasAlgorithm = new DijkstrasAlgo();
            geoJSON.features.forEach((feature) => {
                if (feature.geometry.type == "Polygon") {   // Pedestrian Area
                }
                else if (feature.geometry.type == "LineString") {   // Path
                    addPath(feature, pathParent);
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


function convertOSMResponseToGeoJSON(response) {
    let parser = new DOMParser();
    let itemData = parser.parseFromString(response, "application/xml");
    let itemJSON = osmtogeojson(itemData);
    return itemJSON;
}


async function addPath(feature, parentElement) {
    let tags = feature.properties;
    let { color, pathWidth } = highwayStyles[tags.highway] || { color: defaultPathColour, pathWidth: defaultPathWidth };
    if (tags.service == "alley") { color = "#967A72"; pathWidth = 0.2; }

    paths[numberOfPaths] = [];
    rectangles[numberOfPaths] = [];

    for (let i = 1; i < feature.geometry.coordinates.length; i++) {
        let point1 = feature.geometry.coordinates[i - 1];
        let point2 = feature.geometry.coordinates[i];
        if (tags.highway != 'motorway') dijkstrasAlgorithm.addPair(point1, point2);  // Doesn't add motorways to the navigation graph

        let pixelCoords1 = convertLatLongToPixelCoords({ lat: point1[1], long: point1[0] });
        let pixelCoords2 = convertLatLongToPixelCoords({ lat: point2[1], long: point2[0] });

        /* Checks if the path is off the edge of the map */
        let outsideWindow1 = (pixelCoords1.roundedX < tiffWindow[0] || pixelCoords1.roundedX > tiffWindow[2] ||
            pixelCoords1.roundedY < tiffWindow[1] || pixelCoords1.roundedY > tiffWindow[3]);
        let outsideWindow2 = (pixelCoords2.roundedX < tiffWindow[0] || pixelCoords2.roundedX > tiffWindow[2] ||
            pixelCoords2.roundedY < tiffWindow[1] || pixelCoords2.roundedY > tiffWindow[3]);
        if (outsideWindow1 || outsideWindow2) continue;

        let newPath = document.createElement('a-entity');
        let pathProperties = { primitive: "path", fourCorners: getRectangleCorners({ x: pixelCoords1.x * pathCoordsScale, y: pixelCoords1.y * pathCoordsScale }, { x: pixelCoords2.x * pathCoordsScale, y: pixelCoords2.y * pathCoordsScale }, pathWidth) };
        newPath.setAttribute("geometry", pathProperties);
        newPath.setAttribute("material", { roughness: "0.6", color: color });
        newPath.setAttribute("scale", pathScale + " 1 " + pathScale);

        let pixelCoords = { x: (pixelCoords1.x + pixelCoords2.x) / 2, y: (pixelCoords1.y + pixelCoords2.y) / 2, roundedX: Math.round((pixelCoords1.x + pixelCoords2.x) / 2), roundedY: Math.round((pixelCoords1.y + pixelCoords2.y) / 2) };

        /* Place every path at ground level in case height map takes a while */
        newPath.object3D.position.set((pixelCoords.x * pathCoordsScale), 0, (pixelCoords.y * pathCoordsScale));
        parentElement.appendChild(newPath);
        rectangles[numberOfPaths].push(newPath);

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


function addNodeToArrays(node) {

}


// function getRectangleCorners(coord1, coord2) {
//     let length = Math.hypot((coord1.x - coord2.x), (coord1.y - coord2.y));
//     console.log("lenght = ", length);
//     let midpoint = {x: (coord1.x + coord2.x)/2, y: (coord1.y + coord2.y)/2};

//     let corner1 = {x: midpoint.x+length/2+pathWidth/2, y: midpoint.y+length/2-pathWidth/2};
//     let corner2 = {x: midpoint.x+length/2-pathWidth/2, y: midpoint.y+length/2+pathWidth/2};
//     let corner3 = {x: midpoint.x-length/2-pathWidth/2, y: midpoint.y-length/2+pathWidth/2};
//     let corner4 = {x: midpoint.x-length/2+pathWidth/2, y: midpoint.y-length/2-pathWidth/2};

//     return [new THREE.Vector2(corner1.x, corner1.y), new THREE.Vector2(corner2.x, corner2.y), new THREE.Vector2(corner3.x, corner3.y), new THREE.Vector2(corner4.x, corner4.y)];
// }

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
    console.log("=== Deleting Buildings ===");
    while (removeElement("pathParent")) { }
}


AFRAME.registerGeometry('path', {
    schema: {
        fourCorners: {
            default: [new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)],
        },
        height: { type: 'number', default: pathHeightAboveGround },
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