define("SmartTagsCloudPage", ["SmartTagsD3LayoutCloud"], function() {
	return {
		methods: {

			_getData: function(collection) {
				var result = [];
				collection.each(function (item) {
					result.push({
						"text": item.get("Tag.Name"),
						"size": item.get("Count") * 10
					});
				}, this);
				return result;
			},
			
			_requestData: function(callback, scope) {
				var esq = Ext.create("Terrasoft.EntitySchemaQuery", {
					rootSchemaName: this.get("moduleInfo").entitySchemaName + "InTag"
				});
				esq.addAggregationSchemaColumn("Id", Terrasoft.AggregationType.COUNT, "Count");
				esq.addColumn("Tag.Name");
				esq.getEntityCollection(function(response) {
					var data = [];
					if (response.success) {
						data = this._getData(response.collection);
					}
					callback.call(scope, data);
				}, this);
			},
			
			_drawTagCloud: function (tags) {
				var color = d3.scale.linear()
					.domain([0,1,2,3,4,5,6,10,15,20,100])
					.range(["#ddd", "#ccc", "#bbb", "#aaa", "#999", "#888", "#777", "#666", "#555", "#444", "#333", "#222"]);
				d3.select("#PNGTagCloudPageTagCloudContainer")
					.append("svg")
					.attr("width", 800)
					.attr("height", 300)
					.append("g")
					// without the transform, words words would get cutoff to the left and top, they would
					// appear outside of the SVG area
					.attr("transform", "translate(320,200)")
					.selectAll("text")
					.data(tags)
					.enter().append("text")
					.style("font-size", function(d) { return d.size + "px"; })
					.style("fill", function(d, i) { return color(i); })
					.attr("transform", function(d) {
						return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
					})
					.text(function(d) { return d.text; });
			},
			
			_rendered: function() {
				this._requestData(function (tagCloudData) {
					d3.layout.cloud().size([800, 300])
						.words(tagCloudData)
						.rotate(0)
						.fontSize(function(d) { return d.size; })
						.on("end", this._drawTagCloud)
						.start();
				}, this);
			}
			
		},
		diff: /**SCHEMA_DIFF*/[
			{
				"operation": "insert",
				"name": "TagCloud",
				"values": {
					"itemType": this.Terrasoft.ViewItemType.CONTAINER,
					"afterrender": {bindTo: "_rendered"},
					"items": []
				}
			}
		]/**SCHEMA_DIFF*/
	};
});