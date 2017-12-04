define("SmartTagsCloudPage", ["SmartTagsD3LayoutCloud"], function() {
	return {
		methods: {

			_getData: function(collection) {
				var result = [];
				collection.each(function (item) {
					result.push({
						"text": item.get("Tag.Name"),
						"size": item.get("Count") * 15
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
				var width = 800;
				var height = 300;
				var fill = d3.scale.category20();
				d3.select("#PNGTagCloudPageTagCloudContainer").append("svg")
					.attr("width", width)
					.attr("height", height)
					.append("g")
					.attr("transform", "translate(" + ~~(width / 2) + "," + ~~(height / 2) + ")")
					.selectAll("text")
					.data(tags)
					.enter().append("text")
					.style("font-size", function(d) {
						return d.size + "px";
					})
					.style("-webkit-touch-callout", "none")
					.style("-webkit-user-select", "none")
					.style("-khtml-user-select", "none")
					.style("-moz-user-select", "none")
					.style("-ms-user-select", "none")
					.style("user-select", "none")
					.style("cursor", "default")
					.style("font-family", "Impact")
					.style("fill", function(d, i) {
						return fill(i);
					})
					.attr("text-anchor", "middle")
					.attr("transform", function(d) {
						return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
					})
					.text(function(d) {
						return d.text;
					});
			},
			
			_rendered: function() {
				this._requestData(function (tagCloudData) {
					var width = 800;
					var height = 300;
					d3.layout.cloud()
						.size([width, height])
						.words(tagCloudData)
						.rotate(function() {
							return ~~(Math.random() * 2) * 90;
						})
						.font("Impact")
						.fontSize(function(d) {
							return d.size;
						})
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