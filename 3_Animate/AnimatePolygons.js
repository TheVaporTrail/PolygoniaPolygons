//------------------------------------------------------------------------------------
//	Polygonia: Animate Polygons
//
//
//
//------------------------------------------------------------------------------------

var PolygoniaPolygonsAnimate = (function() 
{
	var theCanvas;
	var theContext;
	var theDesign = undefined;
	var theBounds;
	var theTransform = {scale:{x:1, y:1}, offset:{x:0, y:0}};
	
	var sampleList = [];
	var noPolygonsMsg = "Drag JSON polygons here";

	var animationStage = 0; 			// 0:in; 1:hold; 2:out; 3:hold
	var animationDurations = [3000, 2000, 3000, 2000]; // index is animationStage
	var animationTime = 0; 				// time (in ms) that current stage started
	var animationRef = undefined; 		// see requestAnimationFrame
	var animationTimeout = undefined; 	// see setTimeout
	var animationList = []; 			// list of animation functions
	var animationFunc = undefined; 		// current animation function
	
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

		// Create a list of animation functions, which will be used by BuildUI
		animationList.push({name:"Rearrange", func:AnimatePolygon_SortByBrightness});
		animationList.push({name:"From the Top", func:AnimatePolygon_SlideFromTop});
		animationList.push({name:"Drop In", func:AnimatePolygon_DropIn});
		animationList.push({name:"Unravel", func:AnimatePolygon_Unravel});
		animationList.push({name:"Spiral", func:AnimatePolygon_Spiral});
		animationList.push({name:"Dissolve", func:AnimatePolygon_Dissolve});
		animationList.push({name:"Evaporate", func:AnimatePolygon_Evaporate});
		animationList.push({name:"Just render", func:AnimatePolygon_Render, renderOnly:true});
		
		// Initial animation is the first in the list
		animationFunc = animationList[0].func;
		
		// Create the radio buttons to select the animation
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
	//		Add radio button to the page to select the animation
	//------------------------------------------------------------------------------------
	var BuildUI = function()
	{
		let container = document.getElementById("ID_Animations");
		
		// For each animation in the animation list,...
		for (var i = 0; i < animationList.length; i++)
		{
			// ...Create a div to hold...
			var div = document.createElement("div");
			div.classList.add("radio-div");
			container.appendChild(div);
			
			// ...a radio button, and...
			var radio = document.createElement("input");
			radio.classList.add("radio-button");
			radio.setAttribute("type", "radio");
			radio.setAttribute("name", "anim");
			radio.id = "AnimRadio_"+i;
			radio.dataset.animIdx = i;
			if (animationList[i].renderOnly != undefined)
				radio.dataset.renderOnly = animationList[i].renderOnly;
			if (i == 0)
				radio.checked = true;
			radio.addEventListener("click", HandleRadio);
			div.appendChild(radio);

			// ...a label
			var label = document.createElement("label");
			label.classList.add("radio-label");
			label.innerHTML = animationList[i].name;
			label.setAttribute("for", "AnimRadio_"+i);
			div.appendChild(label);
		}
	}

	//------------------------------------------------------------------------------------
	//	Handle Radio
	//------------------------------------------------------------------------------------
	var HandleRadio = function(evt)
	{
		// Select a different animation
		let idx = evt.target.dataset.animIdx;
		let renderOnly = evt.target.dataset.renderOnly;
		
		if (idx >= 0 && idx < animationList.length)
		{
			animationFunc = animationList[idx].func;

			if (!renderOnly)
				Animation_Restart();
			else
			{
				Animation_Cancel();
 				Render();
			}
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
	//	Handle Mouse
	//------------------------------------------------------------------------------------
	var HandleMouse = function(evt, evtName)
	{
		// Mouse up to restart the animation
		if (evtName == "mouseup")
		{
			Animation_Restart();
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
		Animation_Restart();
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
	//	Offset Pt
	//------------------------------------------------------------------------------------
	var OffsetPt = function(pt, offset)
	{
		return {x:pt.x + offset.x, y:pt.y + offset.y};
	}
	
	//------------------------------------------------------------------------------------
	//	Animate Polygon: Render
	//		Does not change the polygon position, so the effect is simply render
	//------------------------------------------------------------------------------------
	function AnimatePolygon_Render(poly, t, index, count)
	{
		let offset = {x:0, y:0};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Sort by Brightness
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_SortByBrightness(poly, t, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);
		let kSteps = 255;
		var k = (index % kSteps);

		// Use the gray (brightness) info in the polygon if it is provided
		if (poly.info != undefined && poly.info.gray != undefined)
			k = poly.info.gray;

		let canvasCtr = {x:theCanvas.width/2, y:theCanvas.height/2};
		let radius = Math.min(canvasCtr.x, canvasCtr.y) * 0.9;
		let angle = k * 2 * Math.PI/kSteps;
		//angle += t * Math.PI * 3; // swirl
		
		let animX = t * (canvasCtr.x - polyCtr.x + radius * Math.cos(angle));
		let animY = t * (canvasCtr.x - polyCtr.y + radius * Math.sin(angle));
		let offset = {x:animX, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Slide from Top
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_SlideFromTop(poly, t, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);

		let animY = (1.0 - t) * (-polyCtr.y + 10);
		let offset = {x:0, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Drop In
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_DropIn(poly, progress, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);
		
		let window = 0.25;
		let t = CalcWindowedProgress(progress, window, index, count);

		let animY = (1.0 - t) * (-polyCtr.y - 200);
		let offset = {x:0, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Unravel
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_Unravel(poly, progress, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);
		let canvasCtr = {x:theCanvas.width/2, y:theCanvas.height/2};
		
		let window = 0.25;
		let t = CalcWindowedProgress(progress, window, index, count);

		var kSteps = 72;		
		var k = (index % kSteps);

		let radius = Math.min(canvasCtr.x, canvasCtr.y) * (0.8 + progress * 0.4);
		let angle = k * 2 * Math.PI/kSteps + progress * Math.PI / 6;
		
		let animX = t * (canvasCtr.x - polyCtr.x + radius * Math.cos(angle));
		let animY = t * (canvasCtr.x - polyCtr.y + radius * Math.sin(angle));
		let offset = {x:animX, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Spiral
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_Spiral(poly, progress, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);
		let kSteps = 255;
		var k = (index % kSteps);

		// Use the gray (brightness) info in the polygon if it is provided
		if (poly.info != undefined && poly.info.gray != undefined)
			k = poly.info.gray;

		let window = 0.25;
		let t = CalcWindowedProgress(progress, window, k, kSteps);

		let canvasCtr = {x:theCanvas.width/2, y:theCanvas.height/2};
		let radius = Math.min(canvasCtr.x, canvasCtr.y) * 0.9 * k/kSteps;
		let angle = 3 * k * 2 * Math.PI/kSteps;
		
		let animX = t * (canvasCtr.x - polyCtr.x + radius * Math.cos(angle));
		let animY = t * (canvasCtr.x - polyCtr.y + radius * Math.sin(angle));
		let offset = {x:animX, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Dissolve
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_Dissolve(poly, progress, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);
		let kSteps = 120;
		var k = (index % kSteps);
		let canvasCtr = {x:theCanvas.width/2, y:theCanvas.height/2};
		let radius = Math.min(canvasCtr.x, canvasCtr.y) * 0.9;

		let a = {x:(polyCtr.x - canvasCtr.x), y:(polyCtr.y - canvasCtr.y)};
		let d = Math.sqrt(a.x * a.x + a.y * a.y);
		let mx = Math.sqrt(theCanvas.width * theCanvas.width + theCanvas.height * theCanvas.width)/2 * 0.85;
		
		if (d > mx)
			d = mx;
			
		d = mx - d;
		
		let window = 0.2;
		let t = CalcWindowedProgress(progress, window, d, mx);

		let angle = k * 2 * Math.PI/kSteps;
		
		let animX = t * (canvasCtr.x - polyCtr.x + radius * Math.cos(angle));
		let animY = t * (canvasCtr.x - polyCtr.y + radius * Math.sin(angle));
		let offset = {x:animX, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Animate Polygon: Evaporate
	//		
	//------------------------------------------------------------------------------------
	function AnimatePolygon_Evaporate(poly, progress, index, count)
	{
		let polyCtr = ScalePtToCanvas(poly.info && poly.info.ctr ? poly.info.ctr : poly.points[0]);
		let kSteps = 255;
		var k = (index % kSteps);

		// Use the gray (brightness) info in the polygon if it is provided
		if (poly.info != undefined && poly.info.gray != undefined)
			k = poly.info.gray;
		
		let window = 0.1;
		let t = CalcWindowedProgress(progress, window, 255-k, kSteps);

		let animY = t * (-polyCtr.y - 200);
		let offset = {x:0, y:animY};
		
		AnimatePolygon_Path(poly.points, offset)	
	}

	//------------------------------------------------------------------------------------
	//	Calc Windowed Progress
	//		Calculates a new progress value based on sliding a window across the
	//		input progress value. The window width is a value from 0.0 to less than
	//		1.0. The position of the is given by index/count.
	//		The progress before the window is 0.0, the progress after the window is 1.0
	//		The progress ramps from 0.0 to 1.0 across the width of the window.
	//------------------------------------------------------------------------------------
	var CalcWindowedProgress = function(progress, window, index, count)
	{
		let tWall = 1.0 - window;
		let tIndex = index/count * tWall;
		
		var t;
		
		if (progress < tIndex)
			t = 0.0;
		else if (progress > tIndex + window)
			t = 1.0;
		else
			t = (progress - tIndex)/window;
			
		return t;
	}
	
	//------------------------------------------------------------------------------------
	//	Path
	//		Draw the polygon path, scaled to the canvas coordinates, and shifted by the offset
	//------------------------------------------------------------------------------------
	var AnimatePolygon_Path = function(points, offset)
	{
		var pt;
		pt = ScalePtToCanvas(points[0]);
		pt = OffsetPt(pt, offset);
		theContext.moveTo(pt.x, pt.y);
		
		for (var i = 1; i < points.length; i++)
		{
			pt = ScalePtToCanvas(points[i]);
			pt = OffsetPt(pt, offset);
			theContext.lineTo(pt.x, pt.y);
		}
	}

	//------------------------------------------------------------------------------------
	//	Animation: Render Polygons
	//		Renders each polygon in the polygon list, calling the current animate 
	//		function to draw the path for each polygon
	//------------------------------------------------------------------------------------
	function Animation_RenderPolygons(stage, progress)
	{
		var t;

		theContext.clearRect(0, 0, theContext.canvas.width, theContext.canvas.height);

		// Map the progress, which is linear, into a curve
		//t = progress; // linear
		//t = Math.sin(progress * Math.PI/2); // quick start (similar to linear), but slows down
		t = 1.0 - (Math.cos(progress * Math.PI)/2 + 0.5); // slow at start and end
		
		// In the second stage we want to reverse the animation
		if (stage == 2)
			t = 1.0 - t;
		
		// Determine if there is any color in the design. This usually means that most of the polygons have color.
		// We use this flag to skip drawing the frame, which does not have an associated color, because it does 
		// not animate well.
		let hasColor = theDesign.polygonList.polygons.some(poly => (poly.info != undefined && poly.info.color != undefined));

		// Render each polygon
		let len = theDesign.polygonList.polygons.length
		for (var i = 0; i < len; i++)
		{
			// Get the polygon from the list
			var poly = theDesign.polygonList.polygons[i];
			
			// Create a path
			theContext.beginPath();
			
			//
			animationFunc(poly, t, i, len);
			
			theContext.closePath();
			
			// Fill or stroke
			if (poly.info != undefined && poly.info.color != undefined)
			{
				theContext.fillStyle = poly.info.color;
				theContext.fill();
			}
			else
			{
				// See the comment above about hasColor
				if (!hasColor)
					theContext.stroke();
			}
		};
	}

	//------------------------------------------------------------------------------------
	//	Animation: Restart
	//		Cancel any pending animation, restart the time, and request a new animation
	//------------------------------------------------------------------------------------
	function Animation_Restart()
	{
		Animation_Cancel();
		
		// Don't start the animation if there is no design data
		if (theDesign != undefined)
		{
			animationTime = Date.now();
			animationStage = 0;
			animationRef = window.requestAnimationFrame(Animation_Tick);
		}
	}
	
	//------------------------------------------------------------------------------------
	//	Animation: Cancel
	//------------------------------------------------------------------------------------
	function Animation_Cancel()
	{
		if (animationRef != undefined)
		{
			window.cancelAnimationFrame(animationRef);
			animationRef = undefined;
		}
		
		if (animationTimeout != undefined)
		{
			window.clearTimeout(animationTimeout);
			animationTimeout = undefined;
		}
	}
	
	//------------------------------------------------------------------------------------
	//	Animation: Tick
	//		Called from either requestAnimationFrame or setTimeout. When called from
	//		setTimeout the isRequestFrame is false
	//------------------------------------------------------------------------------------
	function Animation_Tick(isRequestFrame = true)
	{
		// Look-up length of the current stage
		let duration = animationDurations[animationStage];
		// Compute elapsed time
		let elapsed  = Date.now() - animationTime;
		// Compute the progress as a value from 0.0 to 1.0
		let progress = elapsed/duration;
		// Clear the requestAnimationFrame reference
		if (isRequestFrame)
			animationRef = undefined;
		else
			animationTimeout = undefined;
		
		// If we haven't completed the current stage and we are in an animating stage
		// then draw the polygons and request another frame
		if (elapsed < duration && (animationStage == 0 || animationStage == 2))
		{
			Animation_RenderPolygons(animationStage, progress);
			animationRef = window.requestAnimationFrame(Animation_Tick);
		}
		// Otherwise advance the stage and reset the start time
		else
		{
			// If about to hold, then draw the design at the end of the animation
			if (animationStage == 0 || animationStage == 2)
				Animation_RenderPolygons(animationStage, 1.0);
				
			animationTime = Date.now();
			animationStage = (animationStage + 1) % 4;
			
			// If we are at a "hold" stage, then request a timeout for the appropriate duration
			// Note that we pass setTimeout a closure to call Animation_Tick with false so that
			// we know that the callback came from setTimeout instead of requestAnimationFrame
			if (animationStage == 1 || animationStage == 3)
				animationTimeout = window.setTimeout(() => Animation_Tick(false), animationDurations[animationStage]);
			// otherwise request an animation frame
			else
				animationRef = window.requestAnimationFrame(Animation_Tick);
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
window.addEventListener("load", event => PolygoniaPolygonsAnimate.Init());
