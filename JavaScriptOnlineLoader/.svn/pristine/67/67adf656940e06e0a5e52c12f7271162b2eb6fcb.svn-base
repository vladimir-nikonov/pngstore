define("FWSchemaBuilderV2", ["ext-base"], function(Ext) {
	Ext.define("Terrasoft.configuration.FWViewModelGenerator", {
		override: "Terrasoft.configuration.ViewModelGenerator",
		useCache: false
	});
	Ext.define("Terrasoft.configuration.FWSchemaBuilder", {
		override: "Terrasoft.configuration.SchemaBuilder",
		build: function(config, callback, scope) {
			config.useCache = false;
			this.callParent([config, callback, scope]);
		}
	});
	return {};
});
