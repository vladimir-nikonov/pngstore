define("ClientFileWather", [], function() {
	Ext.define("Terrasoft.ClientFileWather", {
		init: function() {
			Terrasoft.ServerChannel.on(Terrasoft.EventName.ON_MESSAGE, function(channel, message) {
				console.clear();
				if (message.Header.Sender === "FileWatcher") {
					var moduleName = Ext.decode(message.Body);
					Terrasoft.each(require.s.contexts._.defined, function(module, dm) {
						this.prepareDefinedModuleDescriptor(moduleName, dm);
					}, this);
					var cmp = Ext.getCmp("mainContentWrapper");
					if (cmp && cmp.destroyed !== true){
						cmp.destroy();
					}
					core.loadModule("ViewModuleWrapper");
				}
			}, this);
		},

		prepareDefinedModuleDescriptor: function(moduleName, dm) {
			if (dm.indexOf(moduleName) > -1) {
				var descriptor = core.getModuleDescriptor(dm);
				if (descriptor) {
					var path = descriptor.path;
					var match = path.split("/");
					var length = match && match.length;
					if (match && match[length - 1]) {
						match = match[length - 1];
						path = path.replace(match, Terrasoft.generateGUID().replace(/-/gi, ""));
					}
					descriptor.path = path;
					core.setModuleDescriptor(dm, descriptor);
				}
				require.undef(dm);
			}
			require([moduleName]);
		}
	});
	return Ext.create("Terrasoft.ClientFileWather", {});
});
