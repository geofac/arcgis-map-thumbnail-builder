/**
 * UPDATES:
 * 20150811 Blaine Adams GeoFac Systens: 	Added support for SVG in addition to canvas. This update required the dojoConfig.gfxRenderer with a setting of "canvas" or "svg"
 * 							                Added new parameter graphicsLayers as an array of graphics layers to add to the output. Default is all.
 * 20150810 Blaine Adams GeoFac Systems:    Added parameters for including graphics and sending custom width and height
 */
/*global define*/
define(["dojo/Deferred", "dojo/promise/all"], function (Deferred, all) {

	/**
	 * Creates a query string.
	 * @param {Object} obj
	 * @returns {string}
	 */
	function objToQuery(obj) {
		var output = [];
		for (var propName in obj) {
			if (obj.hasOwnProperty) {
				output.push([propName, encodeURIComponent(obj[propName])].join("="));
			}
		}
		return output.join("&");
	}

	/**
	 * Creates a canvas element that displays the contents of a map.
	 * @param {esri/Map} map
	 * @param {HTMLCanvasElement} incanvas
	 * @param {Optional}{bool} baseOnly include basemap only or additional layers
	 * @param {Optional}{bool} includeGraphics draw graphics or not
	 * @param {Optional}(int} customWidth
	 * @param {Optional}{int} customHeight
	 * @param {Optional}{array str} graphicsLayers array of the graphics layers to pass in. Required if dojoConfig.gfxRenderer is svg.
	 * @returns {dojo/promise/Promise}
	 */
	function mapToCanvas(map, canvas, baseOnly, includeGraphics, customWidth, customHeight, graphicsLayers) {
		// Test new parameters baseOnly, includeGraphics, customWidth, customHeight and assign
		// //default value is undefined
		baseOnly = typeof baseOnly !== 'undefined' ?  baseOnly : false;
		includeGraphics = typeof includeGraphics !== 'undefined' ?  includeGraphics : false;
		customWidth = typeof customWidth !== 'undefined' ?  customWidth : map.width;
		customHeight = typeof customHeight !== 'undefined' ?  customHeight : map.height;

		// TODO: Add the ability to specify image generation parameters (e.g., DPI).
		var ctx, requests;
		ctx = canvas.getContext("2d");
		// Clear any existing data from the canvas.
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Set the canvas's size to match that of the map.
		canvas.width = customWidth;
		canvas.height = customHeight;

		// This array will contain Deferreds indicating when the images have loaded.
		requests = [];

		// Loop through map layers
		map.layerIds.forEach(function (layerId) {
			var layer, url, exportParams, image, deferred;
			var isBasemap = false;

			// is the current layer a basemap?
			if(map.basemapLayerIds.indexOf(layerId) > -1){
				isBasemap = true;
			}

			if(baseOnly && map.basemapLayerIds.indexOf(layerId) > -1){
				layer = map.getLayer(layerId);
			} else if (baseOnly == false){
				layer = map.getLayer(layerId);
			} else {
				layer = undefined;
			}

			if(layer) {
				if (layer.url && layer.visibleAtMapScale) {
					// Create Deferred for current image loading.
					deferred = new Deferred();
					// Setup map service image export parameters.
					exportParams = {
						f: "image",
						size: [map.width, map.height].join(","),
						bbox: [map.extent.xmin, map.extent.ymin, map.extent.xmax, map.extent.ymax].join(","),
						bboxSR: map.extent.spatialReference.wkid,
						format: "png",
						transparent: true
					};
					// Convert params to query string.
					exportParams = objToQuery(exportParams);
					// Create the export URL.
					url = [layer.url, "/export?", exportParams].join("");
					// Eliminate double slashes before "export".
					url = url.replace("//export", "/export");

					// Create the image element.
					image = new Image(map.width, map.height);
					image.crossOrigin = "anonymous";
					// Add the current Deferred to the array.
					requests.push(deferred);
					// Add an event listener that will resolve the Deferred once the image has loaded.
					image.addEventListener("load", function () {
						deferred.resolve(image);
					}, false);
					image.addEventListener("error", function (errorEvent) {
						deferred.reject({
							error: errorEvent,
							image: image
						});
					});
					// Set the image's src attribute. This will begin the image loading.
					image.src = url;
				} else {
					// If the layer doesn't have a URL property, log info to console.
					console.log("No URL for layer: " + layerId);
				}
				layer = undefined;
			}
		});

		// Once all of the images have loaded, add them to the canvas.
		return all(requests).then(function (images) {
			// Add the map server images to the canvas.
			images.forEach(function (image) {
				ctx.drawImage(image, 0, 0, customWidth, customHeight);
			});

			if(dojoConfig.gfxRenderer == 'canvas') {
				// Get all of the graphics layer canvases in the map's root element
				// and add them to the combined map image canvas.
				var canvases = map.root.querySelectorAll("canvas");
				var tempCanvas;

				if (canvases.length > 0) {
					for (var i = 0, l = canvases.length; i < l; i++) {
						tempCanvas = canvases[i];
						ctx.drawImage(tempCanvas, 0, 0, customWidth, customHeight);
					}
				}
			} else if (dojoConfig.gfxRenderer == 'svg') {
				try {
					graphicsLayers.forEach(function(layerName){
						var svgs = map.root.querySelectorAll("svg")[0]['children'];
						var mySvg = '<svg>' + svgs[layerName + '_layer'].innerHTML + '</svg>';
						var SvgCanvas = document.createElement('canvas');
						SvgCanvas.width = map.width;
						SvgCanvas.height = map.height;
						var SvgCtx = SvgCanvas.getContext("2d");
						SvgCtx.drawSvg(mySvg, 0, 0, map.width, map.height);
						SvgCtx.save();
						ctx.drawImage(SvgCanvas, 0, 0, customWidth, customHeight);
					});
				} catch (e) {
					console.log(e.message);
				}
			}
			// Save the canvas image. (This allows the user to revert this version if further changes are made.)
			ctx.save();
		}, function (error) {
			console.error(error);
			alert("Error creating thumbnail.");
		});
	}

	return mapToCanvas;
});
