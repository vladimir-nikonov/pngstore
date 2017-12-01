define("SmartTagsSection", [], function() {
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
			
			_usesAutoTag: function() {
				//TODO: use lookup valuez
				return true;
			},
			
			getViewOptions: function() {
				var viewOptions = this.callParent(arguments);
				viewOptions.addItem(this.getButtonMenuSeparator());
				viewOptions.addItem(this.getButtonMenuItem({
					"Caption": "Show tag cloud",
					"Visible": {"bindTo": "_usesAutoTag"},
					"Click": {"bindTo": "_showTagCloud"}
				}));
				return viewOptions;
			}
		}
	};
});
