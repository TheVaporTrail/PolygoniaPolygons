//------------------------------------------------------------------------------------
//	Polygonia: Render Polygons
//
//
//
//------------------------------------------------------------------------------------

var PolygoniaPolygonsRender = (function() 
{
	var theCanvas;
	var theContext;
	var theDesign = undefined;
	var theBounds;
	var theTransform = {scale:{x:1, y:1}, offset:{x:0, y:0}};
	
	var sampleList = [];
	var noPolygonsMsg = "Drag JSON polygons here";

	//------------------------------------------------------------------------------------
	//	Init
	//------------------------------------------------------------------------------------
	var Init = function()
	{
		// Get the canvas and context where we will render the polygons
		theCanvas = document.getElementById('ID_Canvas');
		theContext = theCanvas.getContext("2d");

		// Register the drag event handler for all of the drag events, although
		// we will ignore some of them
		let dragEvents = ["dragend", "dragexit", "dragenter", "dragleave", "dragover", "drop"];
		dragEvents.forEach(evtName => theCanvas.addEventListener(evtName, evt => HandleDrag(evt, evtName), false));
		
		// Add sample buttons (if we are running on a server)
		if (document.location.origin.substring(0, 4) == "http")
		{
			sampleList.push({name:"Cat's face, gray", ref:"../Samples/BuddyPolygonsGray.json"});
			sampleList.push({name:"Cat's eye, high contrast", ref:"../Samples/BuddyEyeHighContrastGray.json"});
			sampleList.push({name:"Cat's eye, color", ref:"../Samples/BuddyEyeColor.json"});
			sampleList.push({name:"Peep", ref:"../Samples/PeepPolygons.json"});
			sampleList.push({name:"Avocado", ref:"../Samples/AvocadoPolygonsColor.json"});
			sampleList.push({name:"Flower pattern", ref:"../Samples/FlowerPolygons.json"});
			sampleList.push({name:"Squarish pattern", ref:"../Samples/SquarishPatternPolygons.json"});
			sampleList.push({name:"Rosettes pattern", ref:"../Samples/RosettesPatternPolygons.json"});
			
			AddSampleButtons();
			
			noPolygonsMsg = "Drag JSON polygons here or click button, below";
		}
		
		// Initial render of the canvas, to show the "Drag here" message
		Render();
	}
		
	//------------------------------------------------------------------------------------
	//	Add Sample Buttons
	//------------------------------------------------------------------------------------
	var AddSampleButtons = function()
	{
		let container = document.getElementById("ID_Samples");
		
		for (var i = 0; i < sampleList.length && container != undefined; i++)
		{
			let button = document.createElement("button");
			button.innerHTML = sampleList[i].name;
			button.classList.add("sampleButton");
			button.dataset.sample = sampleList[i].ref;
			button.addEventListener("click", LoadSampleButton);
			container.appendChild(button);
		}
	}
	
	//------------------------------------------------------------------------------------
	//	Load Sample Button
	//------------------------------------------------------------------------------------
	var LoadSampleButton = function(evt)
	{
		const url = evt.target.dataset.sample;

		fetch(url)
		.then( r => 
		{
			if (r.status >= 200 && r.status <= 299)
				return r.text();
			else
				throw Error(r.statusText)
		} )
		.then( t => ProcessPossibleJSON(t) )	
		.catch (err => ReportMessage("Unable to load polygons from server"));
	}

	//------------------------------------------------------------------------------------
	//	Handle Drag
	//------------------------------------------------------------------------------------
	var HandleDrag = function(evt, evtName)
	{
		// Drag enter: Show feedback if we can accept the item
		if (evtName == "dragenter")
		{
			var showFeedback = false;
			evt.preventDefault();

			for (var i = 0; i < evt.dataTransfer.items.length; i++)
			{
				let item = evt.dataTransfer.items[i];
				showFeedback = showFeedback || (item.type.match("^text/json") || item.type.match("^text/plain") || item.type.match("^application/json"));
			}
			DisplayDragFeedback(showFeedback);
		}
		// Drag leave: Remove any feedback
		else if (evtName == "dragleave")
		{
			evt.preventDefault();
			DisplayDragFeedback(false);
		}
		// Drag over: Prevent default event handling, otherwise we don't get the drop event
		else if (evtName == "dragover")
		{
			evt.preventDefault();
		}
		// Drop: Process the drop if it is something we recognize
		else if (evtName == "drop")
		{
			var done = false;
			evt.preventDefault();
			DisplayDragFeedback(false);

			for (var i = 0; i < evt.dataTransfer.items.length && !done; i++)
			{
				var item = evt.dataTransfer.items[i];
				
				// Is dropped item JSON or TEXT?
				if ((item.kind == 'string') && (item.type.match('^text/json') || item.type.match('^text/plain')))
				{
					item.getAsString(s => ProcessPossibleJSON(s));
					done = true;
				}
				// Or is dropped item a text file?
				else if ((item.kind == 'file') && (item.type.match('^application/json')))
				{
					// Drag data item is an image file
					var f = item.getAsFile();
					LoadFile(f)
					done = true;
				}
			}
		}
	}
	
	//------------------------------------------------------------------------------
	//	Display Drag Feedback
	//------------------------------------------------------------------------------
	var DisplayDragFeedback = function(showFeedback)
	{
		if (showFeedback)
			theCanvas.classList.add("dragoverFeedback");
		else
			theCanvas.classList.remove("dragoverFeedback");
	}
	
	//------------------------------------------------------------------------------------
	//	Find Bounds
	//		Find the minimum and maximum x and y values across all of the polygons
	//------------------------------------------------------------------------------------
	var FindPolygonListBounds = function(polygonList)
	{
		let maxcb = ( max, cur ) => Math.max( max, cur );
		let mincb = ( max, cur ) => Math.min( max, cur );
	
		let bounds = {min:{x:Infinity, y:Infinity}, max:{x:-Infinity, y:-Infinity}};
	
		polygonList.polygons.forEach(poly =>
		{
			bounds.min.x = poly.points.map(pt => pt.x).reduce( mincb, bounds.min.x );
			bounds.min.y = poly.points.map(pt => pt.y).reduce( mincb, bounds.min.y );
			bounds.max.x = poly.points.map(pt => pt.x).reduce( maxcb, bounds.max.x );
			bounds.max.y = poly.points.map(pt => pt.y).reduce( maxcb, bounds.max.y );
		});
	
		return bounds;
	}

	//------------------------------------------------------------------------------------
	//	Are Valid Bounds?
	//		Returns true if the bounds contain valid values
	//------------------------------------------------------------------------------------
	var AreValidBounds = function(b)
	{
		return (b != undefined && b.min != undefined && b.max != undefined &&
				isFinite(b.min.x) && isFinite(b.min.y) && isFinite(b.max.x) && isFinite(b.max.y));
	}

	//------------------------------------------------------------------------------------
	//	Set Polygon List
	//		Sets a new polygon list and updates the bounds and transform accordingly
	//------------------------------------------------------------------------------------
	var SetPolygonList = function(designData)
	{
		theDesign = designData;
		theBounds = FindPolygonListBounds(theDesign.polygonList);
		theTransform = CalcTransformToCanvas(theBounds, theCanvas, true /* invert Y */);
	}
	
	//------------------------------------------------------------------------------------
	//	Load File
	//------------------------------------------------------------------------------------
	var LoadFile = function(file)
	{
		var reader = new FileReader();
		reader.onload = evt => { ProcessPossibleJSON(evt.target.result)};
		reader.readAsText(file);
	}
	
	//------------------------------------------------------------------------------------
	//	Process Possible JSON
	//		Accepts a string and tries to convert it to an object and verify that it
	//		contains polygon data.
	//------------------------------------------------------------------------------------
	var ProcessPossibleJSON = function(s)
	{
		let obj = undefined;
		let bounds = undefined;
		let msg = undefined;
		
		// First, attempt to parse the string as JSON
		try {
			obj = JSON.parse(s);
		}
		catch (err) {
			msg = "Could not parse JSON";
		}
		
		// If we parsed the string, see if we can find the bounds. This
		// indicates that there are polygons with points
		if (obj != undefined && obj.polygonList)
		{
			try {
				bounds = FindPolygonListBounds(obj.polygonList);

				// Verify that the bounds are valid
				if (!AreValidBounds(bounds))
				{
					obj = undefined;
					msg = "Could not find bounds of polygons";
				}

			}
			catch (err) {
				msg = "Could not find polygons";
				obj = undefined;
			}
		}
		
		// Everything seems ok, so accept the object as a polygon list
		if (obj != undefined)
		{
			SetPolygonList(obj);
			Render();
		}
		// Otherwise report the message
		else
		{
			ReportMessage(msg);
		}
	}

	//------------------------------------------------------------------------------------
	//	Report Message
	//------------------------------------------------------------------------------------
	var ReportMessage = function(msg)
	{
		let e = document.getElementById("ID_Message");
		if (e != undefined)
		{
			e.innerHTML = msg;
			// Remove the message after a few seconds
			setTimeout(e => {e.innerHTML = ""}, 2000, e);
		}
	}
	
	//------------------------------------------------------------------------------------
	//	Calculate Transform To Canvas
	//------------------------------------------------------------------------------------
	var CalcTransformToCanvas = function(bounds, canvas, invertY)
	{
		// Size of the canvas
		let sizeX = canvas.width;
		let sizeY = canvas.height;
		
		// Size of the polygons
		let boundsX = bounds.max.x - bounds.min.x;
		let boundsY = bounds.max.y - bounds.min.y;
		
		// Find scale that fits the polygons into the canvas
		let scaleX = sizeX / boundsX;
		let scaleY = sizeY / boundsY;
		let scale = (scaleX < scaleY) ? scaleX : scaleY;

		// Calculate an offset that will center the polygons in the canvas.
		let ctrOffsetX = (sizeX - scale * boundsX)/2
		let ctrOffsetY = (sizeY - scale * boundsY)/2

		// The transform object will hold both the scaling values and the
		// offset values
		var transform = {scale:{}, offset:{}};
		
		transform.scale.x = scale;
		transform.scale.y = scale;
		transform.offset.x = ctrOffsetX - scale * bounds.min.x;
		transform.offset.y = ctrOffsetY - scale * bounds.min.y;
		
		// Polygonia uses the bottom left as the origin, so we need to support
		// inverting the Y for rendering
		if (invertY)
		{
			transform.scale.y = -scale;
			transform.offset.y = ctrOffsetY + scale * bounds.max.y;
		}
		
		return transform;
	}

	//------------------------------------------------------------------------------------
	//	Render
	//------------------------------------------------------------------------------------
	var Render = function()
	{
		theContext.clearRect(0, 0, theContext.canvas.width, theContext.canvas.height);

		if (theDesign != undefined)
			RenderPolygons(theDesign);
		else
			RenderDragMessage();
	}
	
	//------------------------------------------------------------------------------------
	//	Render Drag Message
	//------------------------------------------------------------------------------------
	var RenderDragMessage = function()
	{
		theContext.font = '18px serif';
		theContext.fillText(noPolygonsMsg, 20, 50);
	}
	
	//------------------------------------------------------------------------------------
	//	Scale Pt to Canvas
	//------------------------------------------------------------------------------------
	var ScalePtToCanvas = function(pt)
	{
		let x = theTransform.scale.x * pt.x + theTransform.offset.x;
		let y = theTransform.scale.y * pt.y + theTransform.offset.y;
		
		return {x, y};
	}

	//------------------------------------------------------------------------------------
	//	Render Polygons
	//------------------------------------------------------------------------------------
	var RenderPolygons = function(design)
	{
		// For each polygon in the polygon list
		for (var j = 0; j < design.polygonList.polygons.length; j++)
		{
			let poly = design.polygonList.polygons[j];
			
			// Create a path...
			theContext.beginPath();
		
			// ...using the points in the polygon...
			for (var i = 0; i < poly.points.length; i++)
			{
				let pt = ScalePtToCanvas(poly.points[i]);
				if (i == 0)
					theContext.moveTo(pt.x, pt.y);
				else
					theContext.lineTo(pt.x, pt.y);
			}

			// ...and connect the last point back to the first
			theContext.closePath();
			
			// If the polygon has color info, then set the fill style
			// to the color and perform a fill
			if (poly.info != undefined && poly.info.color != undefined)
			{
				theContext.fillStyle = poly.info.color;
				theContext.fill();
			}
			// Otherwise just stroke the polygon
			else
			{
				theContext.stroke();
			}
		}
	}
	
	
	//------------------------------------------------------------------------------------
	//	Public API
	//------------------------------------------------------------------------------------
	return {
		Init:	Init
	};
}());


//------------------------------------------------------------------------------------
//	Start app on load event
//------------------------------------------------------------------------------------
window.addEventListener("load", event => PolygoniaPolygonsRender.Init());
