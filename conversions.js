


function getRelativePosition(lat, long) {
    return {x: lat-centreLat,
        y: 0,
        z: long-centreLong};
}