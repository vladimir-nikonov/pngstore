define("KanbanBoardViewGenerator", [], function() {
	var viewGenerator = Ext.define("Terrasoft.configuration.KanbanBoardViewGenerator", {
		extend: "Terrasoft.ViewGenerator",
		alternateClassName: "Terrasoft.KanbanBoardViewGenerator",
		generateKanbanBoard: function(config) {
			var result = {
				className: "Terrasoft.KanbanBoard"
			};
			Ext.apply(result, this.getConfigWithoutServiceProperties(config, []));
			delete result.generator;
			return result;
		}
	});
	return Ext.create(viewGenerator);
});
