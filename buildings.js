'use strict';

const buildingScale = 10;                                // Scaling the buildings (bigger number = bigger buildings in the x and z)
const buildingHeightScale = 2;                          // Scale for the buildings height (bigger number = bigger buildings in y axis)
const buildingHeight = 3;                                 // Building height if height is unknown
const buildingHeightUnderGround = 30;                    // How far to extend the buildings under the ground
const defaultBuildingColour = "#7AA4C1";
var numberOfBuildings = 0;

async function loadBuildings(coordinate, bboxSize) {
    console.log("=== Loading Buildings ===");

    //(way(around:50, 51.1788435,-1.826204);>;);out body;
    //var uniBoundingBox = "54.002150,-2.798493,54.014962,-2.776263"

    //console.log(bbox);
    // TODO Put this (below) into the REST DTM 2m 2020 website and it works!
    // 348391,457481,348747,456988 (just saving this for later (put this into the website))
    // https://stackoverflow.com/questions/41478249/aframe-extend-component-and-override
    // https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
    //helpful but not for this problem
    //console.log([convertLatLongToUTM(bbox.minLat, bbox.minLng), convertLatLongToUTM(bbox.maxLat, bbox.maxLng)]);

    bboxSize *= 0.9;
    var bbox = getBoundingBox(coordinate.lat, coordinate.long, bboxSize);
    var stringBBox = convertBBoxToString(bbox);
    //console.log(stringBBox);
    var overpassQuery = overpassURL + encodeURIComponent(
        "(way[building](" + stringBBox + ");" +
        "rel[building](" + stringBBox + "););" +
        "out geom;>;out skel qt;"
    );

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
        .then((response) => { return response.text(); })
        .then((response) => {
            let parser = new DOMParser();
            let itemData = parser.parseFromString(response, "application/xml");
            let itemJSON = osmtogeojson(itemData);
            return itemJSON
        });

    let sceneElement = document.querySelector('a-scene');
    let buildingParent = document.createElement('a-entity');
    buildingParent.setAttribute("id", "buildingParent");
    buildingParent.setAttribute("class", "building");
    sceneElement.appendChild(buildingParent);

    numberOfBuildings = 0;
    geoJSON.features.forEach(feature => {
        if (feature.geometry.type == "Polygon") {
            addBuilding(feature, buildingParent);
            numberOfBuildings += 1;
        } else {
        }
    });

    console.log("Number of buidlings: ", numberOfBuildings);
}


async function addBuilding(feature, parentElement) {
    let tags = feature.properties;
    let height = tags.height ? tags.height : tags["building:levels"];
    if (tags.amenity == "shelter" && !height) height = 1;
    else if (!height) height = buildingHeight;
    height = parseInt(height)

    let colour = defaultBuildingColour;
    if (tags["building:colour"]) {
        colour = tags["building:colour"];
    }

    let outerPoints = [];
    let innerPoints = [];
    let sumOfLatCoords = 0;
    let sumOfLongCoords = 0;
    let count = 0;
    /* Loops through every coordinate of the building.
    The first set of coordinates are for the outside points of the building,
    the rest are for the inner part of the building that is missing */
    feature.geometry.coordinates.forEach(points => {
        let currentPoints = [];
        points.forEach(point => {
            sumOfLatCoords += point[1];
            sumOfLongCoords += point[0];
            count++;
            let pixelCoords = convertLatLongToPixelCoords({ lat: point[1], long: point[0] })
            currentPoints.push(new THREE.Vector2(pixelCoords.x * buildingCoordsScale, pixelCoords.y * buildingCoordsScale));
        });
        if (!outerPoints.length) {
            outerPoints = currentPoints;
        }
        else {
            innerPoints.push(currentPoints);
        }
    });


    let newBuilding = document.createElement('a-entity');
    newBuilding.setAttribute("geometry", { primitive: "building", outerPoints: outerPoints, innerPoints: innerPoints, height: height });
    newBuilding.setAttribute("material", { roughness: "0.8", color: colour });
    newBuilding.setAttribute("scale", buildingScale + " " + buildingHeightScale + " " + buildingScale);

    let pixelCoords = convertLatLongToPixelCoords({ lat: sumOfLatCoords / count, long: sumOfLongCoords / count })
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
}


/**
 * Removes all the buildings from the scene
 */
function removeCurrentBuildings() {
    console.log("=== Deleting Buildings ===");
    while (removeElement("buildingParent")) { }
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