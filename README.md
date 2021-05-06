# PolygoniaPolygons
This project contains sample code demonstrating how to use the polygon data exported by Polygonia.design. It provides examples of rendering the polygons, animating the polygons, and using the polygons to create more detailed designs. This project also contains sample data.

The code is live at https://Polygonia.design/polygons/index.html

A more sophisticated version is at https://Polygonia.design/polygonTools/index.html

You can design you own polygons at https://Polygonia.design  See the blog post at https://blog.polygonia.design/2021/04/15/polygon-export/


## Format
The polygon data exported by Polygonia is formatted as JSON. The top-level object contains a ``polygonList``, which contains an array called ``polygons``. Each polygon has an array called ``points`` and an option ``info`` object. All of the items in the ``info`` object are optional.

```json
{
	"polygonList": {
		"polygons": [
			{
				"points": [
					{
						"x":-37.5,
						"y":37.5
					}
				],
				"info": {
					"tag":"info",
					"isFrame":true,
					"color":"#00ff00",
					"ctr":{
						"x":0,
						"y":0
					}
				}
			}
		]
	}
}
```

## Sample applications
Each of the sample applications is completely standalone. They are organized under the top page (https://Polygonia.design/polygons/index.html) for convenience.
### Render
The "Render" application simply draws the polygons. It uses the color data, if provided to fill polygons, otherwise it only draws the polygon edges.
### Animate
The "Animate" application moves the polygons around. Different animation styles are provided.
### Plot
The "Plot" applicaiton uses the polygons as the basis for additional rendering, typically in the style of _string art_.

