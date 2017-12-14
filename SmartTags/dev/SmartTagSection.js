define("SmartTagsSection", ["BaseSectionV2Resources"], function(resources) {
	return {
		methods: {

			_showTagCloud: function() {
				this.sandbox.loadModule("ModalBoxSchemaModule", {
					id: this.sandbox.id + "_PNGTagCloudPage",
					instanceConfig: {
						moduleInfo: {
							entitySchemaName: this.entitySchemaName,
							schemaName: "PNGTagCloudPage"
						},
						initialSize: { width: 1000, height: 500 }
					}
				});
			},
			
			getViewOptions: function() {
				var viewOptions = this.callParent(arguments);
				viewOptions.addItem(this.getButtonMenuSeparator());
				viewOptions.addItem(this.getButtonMenuItem({
					"Caption": resources.localizableStrings.ShowTagCloud,
					"Click": {"bindTo": "_showTagCloud"}
				}));
				return viewOptions;
			}
		}
	};
});
