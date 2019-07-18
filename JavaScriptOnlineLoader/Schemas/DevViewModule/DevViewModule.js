define("DevViewModule", ["core-base", "BaseViewModule", "FWSchemaBuilderV2"], function(core) {
	
	core.loadModule("ClientFileWather");

	Ext.define("Terrasoft.configuration.DevViewModule", {

		extend: "Terrasoft.BaseViewModule",

		alternateClassName: "Terrasoft.DevViewModule"

	});

	return Terrasoft.DevViewModule;
});
