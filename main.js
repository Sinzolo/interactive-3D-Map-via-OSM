
var overpassURL = "https://overpass-api.de/api/interpreter?data=";


function loadMap() {
    /*
        Hides the welcome screen and shows the map
    */
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";

    console.log("Loading Map...");

    loadBuildings();
}

function loadMenu() {
    /*
        Hides the map and shows the welcome screen
    */
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "none";
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "block";

    console.log("Tried showing...");
}


function loadBuildings() {
    //(way(around:50, 51.1788435,-1.826204);>;);out body;
    var overpassQuery = overpassURL +
    encodeURIComponent(
        "[out:json];(way[building](54.002150,-2.798493,54.014962,-2.776263);" +
        "rel[building](54.002150,-2.798493,54.014962,-2.776263););" +
        "convert item ::=::,::geom=geom(),_osm_type=type();" +
        "out geom;>;out skel qt;"
    );
    console.log(overpassQuery);

    fetch(overpassQuery).then((response) => {
        if(!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        return response.text();
    })
    .then((response) => {
        //var parser = new DOMParser();
        //var itemData = parser.parseFromString(response, "application/xml");
        console.log(response);
        var itemJSON = osmtogeojson(response);
        console.log(itemJSON);
    });
}