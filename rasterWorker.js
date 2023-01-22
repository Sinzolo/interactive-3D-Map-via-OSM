importScripts("https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js");

self.onmessage = async function(e) {
    const [uniRaster, cityRaster] = await Promise.all([
        raster(GeoTIFF, e.data.uniURL),
        raster(GeoTIFF, e.data.cityURL)
    ]);
    self.postMessage({uniRaster, cityRaster});
}

function raster(GeoTIFF, url) {
    return GeoTIFF.fromUrl(url).then((tiff) => {
        return tiff.getImage();
    }).then((image) => {
        return image.readRasters({pool: new GeoTIFF.Pool()});
    });
}