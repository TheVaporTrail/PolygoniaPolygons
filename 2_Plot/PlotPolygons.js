//------------------------------------------------------------------------------------
//	Polygonia: Plot Polygons
//
//
//
//------------------------------------------------------------------------------------

var PolygoniaPolygonsPlot = (function() 
{
	var theCanvas;
	var theContext;
	var theDesign = undefined;
	var theBounds;
	var theTransform = {scale:{x:1, y:1}, offset:{x:0, y:0}};
	
	var sampleList = [];
	var noPolygonsMsg = "Drag JSON polygons here";

	var plotList = [];
	var plotFunc = undefined;
	var plotMode = 0;
	
	
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
		
		// Register mouse events
		let mouseEvents = ["mousedown", "mousemove", "mouseup", "mouseleave"]
		mouseEvents.forEach(evtName => theCanvas.addEventListener(evtName, evt => HandleMouse(evt, evtName), false));

		// Create a list of plot functions. These will be used by BuildUI.
		plotList.push({name:"Basic", func:PlotPolygon_Basic});
		plotList.push({name:"Line to Center", func:PlotPolygon_LineToCenter});
		plotList.push({name:"Twist Gray", func:PlotPolygon_Twist, mode:0});
		plotList.push({name:"Twist Color", func:PlotPolygon_Twist, mode:1});
		plotList.push({name:"Twist Always", func:PlotPolygon_TwistAlways});
		
		// Initial plot function is the first in the list
		plotFunc = plotList[0].func;
		
		// Create a list of samples
		
		// Create the radio button to select the plot
		BuildUI();
		
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
	//	Build UI
	//		Add radio button to the page to select the plot
	//------------------------------------------------------------------------------------
	var BuildUI = function()
	{
		let container = document.getElementById("ID_Plot");
		
		// For each plot in the plot list,...
		for (var i = 0; i < plotList.length; i++)
		{
			// ...Create a div to hold...
			var div = document.createElement("div");
			div.classList.add("radio-div");
			container.appendChild(div);
			
			// ...a radio button, and...
			var radio = document.createElement("input");
			radio.classList.add("radio-button");
			radio.setAttribute("type", "radio");
			radio.setAttribute("name", "plot");
			radio.id = "PlotRadio_"+i;
			radio.dataset.plotIdx = i;
			if (plotList[i].mode != undefined)
				radio.dataset.plotMode = plotList[i].mode;
			if (i == 0)
				radio.checked = true;
			radio.addEventListener("click", HandleRadio);
			div.appendChild(radio);

			// ...a label
			var label = document.createElement("label");
			label.classList.add("radio-label");
			label.innerHTML = plotList[i].name;
			label.setAttribute("for", "PlotRadio_"+i);
			div.appendChild(label);
		}
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
	//	Handle Radio
	//------------------------------------------------------------------------------------
	var HandleRadio = function(evt)
	{
		// Select a different plot
		let idx = evt.target.dataset.plotIdx;
		let mode = evt.target.dataset.plotMode;
		
		if (idx >= 0 && idx < plotList.length)
		{
			plotFunc = plotList[idx].func;
			plotMode = (mode != undefined) ? mode : 0;
			
			Plot_RenderPolygons(theDesign)
		}
	}
	
	//------------------------------------------------------------------------------------
	//	Handle Drag
	//------------------------------------------------------------------------------------
	var HandleMouse = function(evt, evtName)
	{
		if (evtName == "mousedown" && !evt.ctrlKey)
		{
			if (theDesign != undefined)
				Render();
		}
		else if (evtName == "mouseup")
		{
			if (theDesign != undefined)
				Plot_RenderPolygons(theDesign);
		}
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
			AcceptPolygonList(obj);
		}
		// Otherwise report the message
		else
		{
			ReportMessage(msg);
		}
	}

	//------------------------------------------------------------------------------------
	//	Accept Polygon List
	//------------------------------------------------------------------------------------
	var AcceptPolygonList = function(design)
	{
		SetPolygonList(design);
		
		// Show the unmodified design
		Render();
		
		// Set a timer to show the modified design and a message
		window.setTimeout(() => { Plot_RenderPolygons(theDesign); ReportMessage("Click to show original");}, 500);
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
	//	Move To
	//		Scales the points to the canvas and calls moveTo
	//------------------------------------------------------------------------------------
	var MoveTo = function(pt)
	{
		pt = ScalePtToCanvas(pt);
		theContext.moveTo(pt.x, pt.y);
	}

	//------------------------------------------------------------------------------------
	//	Line To
	//		Scales the points to the canvas and calls lineTo
	//------------------------------------------------------------------------------------
	var LineTo = function(pt)
	{
		pt = ScalePtToCanvas(pt);
		theContext.lineTo(pt.x, pt.y);
	}
	
	//------------------------------------------------------------------------------------
	//	Draw Closed Poly
	//		Calls MoveTo and LineTo for the points of the polygon
	//------------------------------------------------------------------------------------
	var DrawClosedPoly = function(points)
	{
		MoveTo(points[0]);
		
		for (var i = 1; i < points.length; i++)
			LineTo(points[i]);
		
		theContext.closePath();
	}
	
	//------------------------------------------------------------------------------------
	//	Calc Point Between
	//		Return a point between two points, according to a value from 0.0 to 1.0
	//		Can also be called with values outside of this range to get points before
	//		or after the line
	//------------------------------------------------------------------------------------
	var CalcPointBetween = function(ptA, ptB, t)
	{
		let x = t * ptA.x + (1 - t) * ptB.x;
		let y = t * ptA.y + (1 - t) * ptB.y;
		
		return {x, y};
	}

	//------------------------------------------------------------------------------------
	//	Distance Between
	//		Calculates the distance between two points
	//------------------------------------------------------------------------------------
	var DistanceBetween = function(ptA, ptB)
	{
		let x = ptA.x - ptB.x;
		let y = ptA.y - ptB.y;
		
		return Math.sqrt(x*x + y*y);
	}
	
	//------------------------------------------------------------------------------------
	//	Unit Vectors
	//		Returns a unit vector pointing from A to B
	//------------------------------------------------------------------------------------
	var UnitVector = function(ptA, ptB)
	{
		let d = DistanceBetween(ptA, ptB);
		
		let x = ptB.x - ptA.x;
		let y = ptB.y - ptA.y;
		
		return {x:x/d, y:y/d};
	}
	
	//------------------------------------------------------------------------------------
	//	Calc Approximate Center (of a polygon)
	//		Find the approximate center of a polygon by averaging all of the points
	//------------------------------------------------------------------------------------
	var CalcApproximateCenter = function(points)
	{
		let ctr = {x:0, y:0};
		
		points.forEach(pt => { ctr.x += pt.x; ctr.y += pt.y });
		ctr.x /= points.length;
		ctr.y /= points.length;
		
		return ctr;
	}
	
	//------------------------------------------------------------------------------------
	//	Plot: Basic
	//		Simply draws the polygon
	//------------------------------------------------------------------------------------
	var PlotPolygon_Basic = function(poly)
	{
		DrawClosedPoly(poly.points);
		
		return undefined; // use default color
	}

	//------------------------------------------------------------------------------------
	//	Plot: Line To Center
	//		Draws lines from the edges of the to the center
	//------------------------------------------------------------------------------------
	var PlotPolygon_LineToCenter = function(poly)
	{
		let polyCtr = (poly.info && poly.info.ctr ? poly.info.ctr : CalcApproximateCenter(poly.points));
		let sp = 2;
		
		theContext.lineWidth = 0.5;
		
		for (var i = 0; i < poly.points.length; i++)
		{
			let ptA = poly.points[i];
			let ptB = poly.points[(i + 1) % poly.points.length];
			let d = DistanceBetween(ptA, ptB);
			let u = UnitVector(ptA, ptB);
			
			var count = Math.floor(d/sp);
			
			if (count > 1)
			{
				for (var j = 1; j < count; j++)
				{
					let pt = CalcPointBetween(ptA, ptB, j/count);
					MoveTo(polyCtr);
					LineTo(pt);
				}
			}
			
			MoveTo(polyCtr);
			LineTo(poly.points[i]);
		}
		return undefined; // use default color
	}

	//------------------------------------------------------------------------------------
	//	Plot: Twist
	//		Twists the polygon if there is a color. The amount of twisting depends
	//		on the brightness
	//------------------------------------------------------------------------------------
	var PlotPolygon_Twist = function(poly, mode)
	{
		let gray = (poly.info && poly.info.gray != undefined) ? poly.info.gray : -1;
		let len = poly.points.length;
		let count = 0;
		
 		DrawClosedPoly(poly.points);
		
		theContext.lineWidth = 0.5;

		var ptsA = poly.points;
		var ptsB = [];
		
		if (gray != -1 && gray != 255)
		{
			let g = 256 - gray; // map 0..255 => 256..1
			let h = Math.floor( (g * 10) / 256 + 2); // map 256..1 => 10..0 ==> 12..2
			var t = 1/h;
			
			if (h > 2)
			{
				do
				{
					for (var i = 0; i < len; i++)
						ptsB[i] = CalcPointBetween(ptsA[i], ptsA[(i + 1) % len], t);

					DrawClosedPoly(ptsB);
		
					ptsA = ptsB.map(pt => {return {x:pt.x, y:pt.y}});
					count++;
				}
				while (DistanceBetween(ptsA[0], ptsA[1]) > 2 && count < 100);
			}
		}
		
		return (mode == 1) ? undefined : "#000000";
	}

	//------------------------------------------------------------------------------------
	//	Plot: Twist Always
	//------------------------------------------------------------------------------------
	var PlotPolygon_TwistAlways = function(poly, mode)
	{
		let len = poly.points.length;
		let count = 0;
		var t = 0.2;
		
 		DrawClosedPoly(poly.points);
		
		theContext.lineWidth = 0.5;

		var ptsA = poly.points;
		var ptsB = [];
		
		do
		{
			for (var i = 0; i < len; i++)
				ptsB[i] = CalcPointBetween(ptsA[i], ptsA[(i + 1) % len], t);

			DrawClosedPoly(ptsB);

			ptsA = ptsB.map(pt => {return {x:pt.x, y:pt.y}});
			count++;
		}
		while (DistanceBetween(ptsA[0], ptsA[1]) > 2 && count < 100);
		
		return "#000000"; // black
	}

	//------------------------------------------------------------------------------------
	//	Plot: Render Polygons
	//------------------------------------------------------------------------------------
	function Plot_RenderPolygons(design)
	{
		theContext.clearRect(0, 0, theContext.canvas.width, theContext.canvas.height);

		// Render each polygon
		let len = design.polygonList.polygons.length
		for (var i = 0; i < len; i++)
		{
			// Get the polygon from the list
			var poly = design.polygonList.polygons[i];
			var color;
			
			// Reset the line width. The plotFunc might change it.
			theContext.lineWidth = 1.0;
			
			// Create a path
			theContext.beginPath();
			
			// Create the path for the polygon, but skip the frame, if it
			// is identified
			if (poly.info == undefined || !poly.info.isFrame)
				color = plotFunc(poly, plotMode);
			
			// Use either the color returned from the plot function, the color
			// stored with the polygon, or black
			if (color != undefined)
				theContext.strokeStyle = color;
			else if (poly.info != undefined && poly.info.color != undefined)
				theContext.strokeStyle = poly.info.color;
			else
				theContext.strokeStyle = "black";

			theContext.stroke();
		};
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
window.addEventListener("load", event => PolygoniaPolygonsPlot.Init());
