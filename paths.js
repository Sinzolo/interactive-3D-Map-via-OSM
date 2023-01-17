var numberOfPaths = 0;
const pathWidth = 0.7;  // Path width in metres
const roadWidth = 1.5;  // Road width in metres
const pathHeight = 0.16;  // How far it should stick above ground
const pathHeightUnderGround = 100;  // How far it should stick below ground
const pathSegmentationLength = 5;  // The length of each segment of a path (bigger number = less segments per path so better performance)

async function loadPaths(coordinate, bboxSize) {
    console.log("=== Loading Paths ===");

    bboxSize -= 30;
    var bbox = getBoundingBox(coordinate.lat, coordinate.long, bboxSize);
    var stringBBox = convertBBoxToString(bbox);
    var overpassQuery = overpassURL + encodeURIComponent(
        "[timeout:40];"+
        "(way[highway=path]("+stringBBox+");" +
        "way[highway=pedestrian]("+stringBBox+");" +
        "way[highway=footway]("+stringBBox+");" +
        "way[highway=motorway]("+stringBBox+");" +
        "way[highway=trunk]("+stringBBox+");" +
        "way[highway=primary]("+stringBBox+");" +
        "way[highway=secondary]("+stringBBox+");" +
        "way[highway=tertiary]("+stringBBox+");" +
        "way[highway=residential]("+stringBBox+");" +
        "way[highway=unclassified]("+stringBBox+"););" +
        "out geom;>;out skel qt;"
    );

    //let response = fetch("paths.xml");

    if ('caches' in window) {
        var response = caches.match(overpassQuery)
        .then((response) => {
            if (response) {     // If found in cache return response
                console.log("Found it in cache");
                return response;
            }
            console.log("NOT found in cache... Fetching URL");
            return fetchWithRetry(overpassQuery).then((response) => {    // If not found in cache fetch resource
                osmCache.then((cache) => {
                    cache.put(overpassQuery, response);        //  Once fetched cache the response
                    console.log("Storing in cache");
                });
                return response.clone();        // Return fetched resource
            });
        });
    }
    else {
        var response = fetchWithRetry(overpassQuery);        // Fetches the OSM data needed for the specific bbox
        //let response = await fetch("interpreter.xml");     // Uses the preloaded uni area of buildings
        //let response = await fetch("squareUni.xml");       // Uses the preloaded square area of the uni buildings
    }

    /* Converting the response from the overpass API into a JSON object. */
    let geoJSON = await response
    .then((response) => {return response.text();})
    .then((response) => {
        let parser = new DOMParser();
        let itemData = parser.parseFromString(response, "application/xml");
        let itemJSON = osmtogeojson(itemData);
        return itemJSON
    });

    // currently working on this^ 11th jan 1:49pm

    console.log(geoJSON);


    let sceneElement = document.querySelector('a-scene');
    let pathParent = document.createElement('a-entity');
    pathParent.setAttribute("id", "pathParent");
    pathParent.setAttribute("class", "path");
    sceneElement.appendChild(pathParent);

    getRectangleCorners({x:0, y:0}, {x:3, y:3});

    numberOfPaths = 0;
    geoJSON.features.forEach(feature => {
        if (feature.geometry.type == "Polygon") {   // Pedestrian Area
        }
        else if (feature.geometry.type == "LineString") {
            numberOfPaths += 1;
            addPath(feature, pathParent);
        }
    });

    console.log("Number of paths: ", numberOfPaths);
}


async function addPath(feature, parentElement) {
    let tags = feature.properties;
    let color = "#979797";
    if (tags["surface"]) {  // TODO would be cool to change colour based on road surface.
      color = color;
    }

    for (let i = 1; i < feature.geometry.coordinates.length; i++) {
        let point1 = feature.geometry.coordinates[i-1];
        let point2 = feature.geometry.coordinates[i];
        let pixelCoords1 = convertLatLongToPixelCoords({lat: point1[1], long: point1[0]});
        let pixelCoords2 = convertLatLongToPixelCoords({lat: point2[1], long: point2[0]});

        let newPath = document.createElement('a-entity');
        let pathProperties = {primitive: "path", fourCorners: getRectangleCorners({x: pixelCoords1.x*coordsScale, y: pixelCoords1.y*coordsScale}, {x: pixelCoords2.x*coordsScale, y: pixelCoords2.y*coordsScale})};
        newPath.setAttribute("geometry", pathProperties);
        newPath.setAttribute("material", {color: color});
        newPath.setAttribute("scale", buildingScale+" "+buildingHeightScale+" "+buildingScale);

        let pixelCoords = {x: (pixelCoords1.x+pixelCoords2.x)/2, y: (pixelCoords1.y+pixelCoords2.y)/2};
        heightMaps.then(({ twoDHeightMapArray }) => {
            twoDHeightMapArray.then((heightMap) => {
                if ((heightMap[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]) == null) {
                    newPath.object3D.position.set((pixelCoords.x*coordsScale), 0, (pixelCoords.y*coordsScale));
                    throw new Error("Specfic location on height map not found! (My own error)");
                }
                else {
                    newPath.object3D.position.set((pixelCoords.x*coordsScale), (heightMap[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]), (pixelCoords.y*coordsScale));
                }
                parentElement.appendChild(newPath);
            });
        });
    }
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


function findThirdCoordinate(coordinateA, coordinateB, b) {
    let a = pathWidth;
    let Ax = coordinateA.x;
    let Ay = coordinateA.y;
    let Bx = coordinateB.x;
    let By = coordinateB.y;

    // Calculate side a (distance between A and B)
    let c = Math.hypot(a, b);
    console.log("c = ", c);

    // c^2 = a^2 + b^2 − 2abcos(C)
    // C = acos((a^2 + b^2 - c^2)/2ab)
    // Use Law of Cosines to find angle C
    var C = Math.acos((Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b));

    // Use angle C and distance AC to find coordinate C
    var Cx = Ax + lengthAC * Math.cos(C);
    var Cy = Ay + lengthAC * Math.sin(C);

    return [Cx, Cy];
}


function getRectangleCorners({x: x1, y: y1}, {x: x2, y: y2}) {
    // Find the center point between the two given points
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
  
    // Find the distance between the two given points
    const distanceX = Math.abs(x1 - x2);
    const distanceY = Math.abs(y1 - y2);
    let length = Math.hypot((x1 - x2), (y1 - y2));
  
    // Calculate the angle of the line between the two points
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    // Calculate the half-width of the rectangle
    const halfWidth = 0.3;
    
    // Calculate the half-height of the rectangle
    const halfLength = length*0.7;
  
    // calculate the four rectangle coordinates
    const topLeftX = centerX + halfWidth * Math.cos(angle + Math.PI / 2) - halfLength * Math.sin(angle + Math.PI / 2);
    const topLeftY = centerY + halfWidth * Math.sin(angle + Math.PI / 2) + halfLength * Math.cos(angle + Math.PI / 2);
    const topRightX = centerX + halfWidth * Math.cos(angle - Math.PI / 2) - halfLength * Math.sin(angle - Math.PI / 2);
    const topRightY = centerY + halfWidth * Math.sin(angle - Math.PI / 2) + halfLength * Math.cos(angle - Math.PI / 2);
    const bottomLeftX = centerX - halfWidth * Math.cos(angle + Math.PI / 2) - halfLength * Math.sin(angle + Math.PI / 2);
    const bottomLeftY = centerY - halfWidth * Math.sin(angle + Math.PI / 2) + halfLength * Math.cos(angle + Math.PI / 2);
    const bottomRightX = centerX - halfWidth * Math.cos(angle - Math.PI / 2) - halfLength * Math.sin(angle - Math.PI / 2);
    const bottomRightY = centerY - halfWidth * Math.sin(angle - Math.PI / 2) + halfLength * Math.cos(angle - Math.PI / 2);
  
    let rectangle = {
      bottomLeft: { x: topLeftX, y: topLeftY },
      topRight: { x: topRightX, y: topRightY },
      topLeft: { x: bottomLeftX, y: bottomLeftY },
      bottomRight: { x: bottomRightX, y: bottomRightY },
    };

    return [new THREE.Vector2(rectangle.topLeft.x, rectangle.topLeft.y), new THREE.Vector2(rectangle.topRight.x, rectangle.topRight.y), new THREE.Vector2(rectangle.bottomRight.x, rectangle.bottomRight.y), new THREE.Vector2(rectangle.bottomLeft.x, rectangle.bottomLeft.y)];
}
  
  







AFRAME.registerGeometry('path', {
    schema: {
        fourCorners: {
            default: [new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)],
        },
        height: { type: 'number', default: pathHeight },
    },
    init: function (data) {
        var shape = new THREE.Shape(data.fourCorners);
        var geometry = new THREE.ExtrudeGeometry(shape, {depth: data.height+pathHeightUnderGround, bevelEnabled: false});
        // As Y is the coordinate going up, let's rotate by 90° to point Z up.
        geometry.rotateX(-Math.PI / 2);
        // Rotate around Y and Z as well to make it show up correctly.
        geometry.rotateY(Math.PI);
        geometry.rotateZ(Math.PI);
        // Now we would point under ground, move up the height, and any above-ground space as well.
        geometry.translate (0, data.height, 0);
        geometry.center;
        this.geometry = geometry;
    }
});