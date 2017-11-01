define("DevViewModule", ["BaseViewModule", "FWSchemaBuilderV2"], function() {
	
	core.loadModule("ClientFileWather");

	Ext.define("Terrasoft.configuration.DevViewModule", {

		extend: "Terrasoft.BaseViewModule",

		alternateClassName: "Terrasoft.DevViewModule"

	});

	return Terrasoft.DevViewModule;
});
