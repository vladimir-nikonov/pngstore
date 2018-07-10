Ext.define("Terrasoft.AtfPreviewableGridLayoutEditItem", {
	override: "Terrasoft.PreviewableGridLayoutEditItem",
	show: function() {
		var renderTo = this.renderTo;
		if (renderTo && renderTo.isVisible()) {
			this.visible = true;
			if (!this.rendered) {
				this.render(this.renderTo);
			} else {
				if (this._debouncedReRender) {
					this._debouncedReRender();
				} else {
					this._debouncedReRender = _.debounce(function() {
						this.reRender(null, this.renderTo);
					}, 300);
					this._debouncedReRender();
				}
			}
		}
	}
});

define("atf_dashboarddesigner", ["ATF_DashboardDesignerSchemaResources", "DashboardDesignerResources", "css!atf_dashboarddesigner"],
function(resources, ddResources) {
	return {
		messages: {
			"GetHistoryState": {
				mode: this.Terrasoft.MessageMode.PTP,
				direction: this.Terrasoft.MessageDirectionType.PUBLISH
			},
			"PushHistoryState": {
				mode: this.Terrasoft.MessageMode.BROADCAST,
				direction: this.Terrasoft.MessageDirectionType.PUBLISH
			},
			"GetDashboardInfo": {
				mode: this.Terrasoft.MessageMode.PTP,
				direction: this.Terrasoft.MessageDirectionType.PUBLISH
			},
			"BackHistoryState": {
				mode: this.Terrasoft.MessageMode.BROADCAST,
				direction: this.Terrasoft.MessageDirectionType.PUBLISH
			},
			"SetDesignerResult": {
				mode: this.Terrasoft.MessageMode.PTP,
				direction: this.Terrasoft.MessageDirectionType.PUBLISH
			}
		},
		attributes: {
			"Id": {
				"dataValueType": Terrasoft.DataValueType.TEXT
			},
			"Caption": {
				"dataValueType": Terrasoft.DataValueType.TEXT,
				"isRequired": true
			},
			"SelectedItems": {
				dataValueType: Terrasoft.DataValueType.CUSTOM_OBJECT
			},
			"Items": {
				dataValueType: Terrasoft.DataValueType.COLLECTION
			},
			"Selection": {
				dataValueType: Terrasoft.DataValueType.CUSTOM_OBJECT,
				value: null
			},
			"Widgets": {
				dataValueType: Terrasoft.DataValueType.COLLECTION
			},
			"SectionId": {
				"dataValueType": Terrasoft.DataValueType.GUID
			}
		},
		methods: {

			//region Methods: Private

			////TODO: Move to TipHelper
			showTip: function(config) {
				if (this.tipInstance) {
					this.tipInstance.destroy();
					delete this.tipInstance;
				}
				this.tipInstance = this.Ext.create("Terrasoft.Tip", config);
				this.tipInstance.show();
			},

			/**
			 * Returns items's max row index.
			 * @private
			 * @return {Number} Max row index.
			 */
			getItemsMaxRow: function() {
				var result = 0, items = this.get("Items");
				items.each(function(item) {
					var itemRow = item.get("row");
					var itemRowSpan = item.get("rowSpan");
					result = (result < (itemRow + itemRowSpan)) ? (itemRow + itemRowSpan) : result;
				}, this);
				return result;
			},

			//endregion

			//region Methods: Protected

			/**
			 * Returns dashboard init info.
			 * @protected
			 * @return {Object} Dashboard info.
			 */
			getDashboardInfo: function() {
				return this.sandbox.publish("GetDashboardInfo", null, [this.sandbox.id]);
			},

			/**
			 * Returns current section id.
			 * @protected
			 * @param {String} Section id.
			 */
			getSectionId: function() {
				var sectionInfo = this.getSectionInfo();
				var dashboardSectionModule = Terrasoft.configuration.ModuleStructure.Dashboard.sectionModule;
				return sectionInfo.sectionModule !== dashboardSectionModule && sectionInfo.moduleId;
			},

			/**
			 * Creates new dashboard.
			 * @protected
			 * @param {Function} callback Callback function.
			 * @param {Object} scope Callback function context.
			 * @return {Terrasoft.DashboardManagerItem} New dashboard.
			 */
			createDashboard: function(callback, scope) {
				var createItemConfig = {
					sectionId: this.getSectionId()
				};
				this.Terrasoft.DashboardManager.createItem(createItemConfig, function(item) {
					callback.call(scope, item);
				}, this);
			},

			////TODO: Move to WidgetDesignerHelper
			getWidgetImageConfig: function(widgetType) {
				return this.get("Resources.Images." + widgetType + "WidgetImage");
			},

			/**
			 * Creates grid layout edit item view model.
			 * @protected
			 * @param {Object} viewConfigItem Widget layouting config.
			 * @param {Object} widgetConfig Widget config.
			 * @return {Terrasoft.BaseViewModel} Grid layout edit item view model.
			 */
			createWidgetGridLayoutEditItemViewModel: function(viewConfigItem, widgetConfig) {
				var itemConfig = this.Ext.apply({
					itemId: viewConfigItem.name,
					imageConfig: this.getWidgetImageConfig(widgetConfig.widgetType),
					widgetConfig: widgetConfig,
					itemType: viewConfigItem.itemType,
					content: widgetConfig.parameters && widgetConfig.parameters.caption
				}, viewConfigItem.layout);
				return this.Ext.create("Terrasoft.BaseViewModel", {
					values: itemConfig
				});
			},

			/**
			 * Inits dashboard widgets.
			 * @protected
			 * @param {Terrasoft.DashboardManagerItem} dashboardManagerItem Dashboard.
			 * @param {Function} callback Callback function.
			 * @param {Object} scope Callback function context.
			 */
			initItems: function(dashboardManagerItem, callback, scope) {
				var items = this.Ext.create("Terrasoft.BaseViewModelCollection");
				dashboardManagerItem.loadLazyPropertiesData(function() {
					var widgets = dashboardManagerItem.getItems();
					var viewConfig = dashboardManagerItem.getViewConfig();
					this.Terrasoft.each(viewConfig, function(viewConfigItem) {
						var itemName = viewConfigItem.name;
						var widgetConfig = widgets[itemName];
						var widget = this.createWidgetGridLayoutEditItemViewModel(viewConfigItem, widgetConfig);
						this.subscribeWidgetModuleConfigMessage(widget);
						items.add(itemName, widget);
					}, this);
					this.set("Items", items);
					callback.call(scope);
				}, this);
			},

			getWidgetModuleConfig: function(item) {
				var widgetConfig = item.get("widgetConfig");
				var widgetTypeConfig = Terrasoft.DashboardEnums.WidgetType[widgetConfig.widgetType];
				var config = Ext.apply({}, widgetTypeConfig.view, widgetConfig);
				config.moduleName = config.moduleName || (config.parameters && config.parameters.moduleName);
				return config;
			},

			registerWidgetModuleMessages: function(item) {
				var widgetModuleConfig = this.getWidgetModuleConfig(item);
				var messages = {};
				var configurationMessage = widgetModuleConfig.configurationMessage ||
					widgetModuleConfig.parameters.configurationMessage;
				messages[configurationMessage] = {
					mode: Terrasoft.MessageMode.PTP,
					direction: Terrasoft.MessageDirectionType.SUBSCRIBE
				};
				this.sandbox.registerMessages(messages);
			},

			getWidgetModuleConfigurationMessage: function(widget) {
				var config = this.getWidgetModuleConfig(widget);
				return config.configurationMessage || config.parameters.configurationMessage;
			},

			subscribeWidgetModuleConfigMessage: function(widget) {
				this.registerWidgetModuleMessages(widget);
				var configurationMessage = this.getWidgetModuleConfigurationMessage(widget);
				this.sandbox.subscribe(configurationMessage, function() {
					var config = widget.get("widgetConfig");
					var parameters = config.parameters.parameters || config.parameters;
					return parameters;
				}, [widget.get("itemId")]);
			},

			getSaveData: function() {
				var items = this.get("Items");
				var viewConfig = [];
				var widgets = {};
				items.each(function(item) {
					var itemId = item.get("itemId");
					var viewConfigItem = {
						"name": itemId,
						"itemType": item.get("itemType"),
						"layout": {
							"row": item.get("row"),
							"rowSpan": item.get("rowSpan"),
							"column": item.get("column"),
							"colSpan": item.get("colSpan")
						}
					};
					viewConfig.push(viewConfigItem);
					widgets[itemId] = item.get("widgetConfig");
				}, this);
				return {
					widgets: widgets,
					viewConfig: viewConfig
				};
			},

			_getWidgetCaptionByType: function(widgetType) {
				let result = {};
				let wte = Terrasoft.DashboardEnums.WidgetType;
				result.Chart = ddResources.localizableStrings.AddChartButtonCaption;
				result.Indicator = ddResources.localizableStrings.AddIndicatorButtonCaption;
				resultGauge = ddResources.localizableStrings.AddGaugeButtonCaption;
				result.DashboardGrid = ddResources.localizableStrings.AddDashboardGridButtonCaption;
				result.Module = ddResources.localizableStrings.AddModuleButtonCaption;
				result.WebPage = ddResources.localizableStrings.AddWebPageButtonCaption;
				return result[widgetType] || widgetType;
			},
			
			getWidgets: function() {
				var result = [];
				var self = this;
				this.Terrasoft.each(this.Terrasoft.DashboardEnums.WidgetType, function(widgetConfig, widgetType) {
					result.push({
						className: "Terrasoft.Button",
						caption: this._getWidgetCaptionByType(widgetType),
						imageConfig: this.getWidgetImageConfig(widgetType),
						tag: widgetType,
						onClick: function() {
							self.openWidgetDesigner(widgetType);
						}
					});
				}, this);
				return result;
			},

			getSelectedItem: function() {
				var result;
				var selectedItems = this.get("SelectedItems");
				var selectedItemName = selectedItems && selectedItems[0];
				if (!this.Ext.isEmpty(selectedItemName)) {
					var items = this.get("Items");
					result = items.get(selectedItemName);
				}
				return result;
			},

			generageItemName: function() {
				return this.Terrasoft.generateGUID();
			},

			createNewWidget: function(config) {
				var itemName = this.generageItemName();
				var viewConfigItem = {
					name: itemName,
					layout: config.selection,
					itemType: Terrasoft.ViewItemType.MODULE
				};
				var widgetConfig = {
					parameters: config.widgetConfig,
					widgetType: config.widgetType
				};
				var widget = this.createWidgetGridLayoutEditItemViewModel(viewConfigItem, widgetConfig);
				this.subscribeWidgetModuleConfigMessage(widget);
				var items = this.get("Items");
				items.add(itemName, widget);
			},

			registerWidgetTypeMessages: function() {
				var messages = {};
				var ptpSubscribeConfig = {
					mode: Terrasoft.MessageMode.PTP,
					direction: Terrasoft.MessageDirectionType.SUBSCRIBE
				};
				Terrasoft.each(Terrasoft.DashboardEnums.WidgetType, function(typeConfig) {
					var deisgnTimeConfig = typeConfig.design;
					messages[deisgnTimeConfig.configurationMessage] = ptpSubscribeConfig;
					messages[deisgnTimeConfig.resultMessage] = ptpSubscribeConfig;
				}, this);
				this.sandbox.registerMessages(messages);
			},

			editWidget: function(widgetViewModel) {
				var widgetConfig = widgetViewModel.get("widgetConfig");
				this.openWidgetDesigner(widgetConfig.widgetType);
			},

			copyWidget: function(widgetViewModel) {
				var itemName = this.Terrasoft.generateGUID();
				var viewConfigItem = {
					name: itemName,
					layout: {
						row: this.getItemsMaxRow(),
						rowSpan: widgetViewModel.get("rowSpan"),
						column: 0,
						colSpan: widgetViewModel.get("colSpan")
					},
					itemType: Terrasoft.ViewItemType.MODULE
				};
				var widgetConfig = widgetViewModel.get("widgetConfig");
				var widget = this.createWidgetGridLayoutEditItemViewModel(viewConfigItem, widgetConfig);
				this.subscribeWidgetModuleConfigMessage(widget);
				var items = this.get("Items");
				items.add(itemName, widget);
			},

			onWidgetPreviewReady: function(previewId, itemId) {
				var items = this.get("Items");
				var item = items.get(itemId);
				var moduleConfig = item.get("widgetConfig");
				var moduleName = (moduleConfig.parameters && moduleConfig.parameters.moduleName) ||
					Terrasoft.DashboardEnums.WidgetType[moduleConfig.widgetType].view.moduleName;
				this.sandbox.loadModule(moduleName, {
					renderTo: previewId,
					id: itemId
				});
			},

			onWidgetActionClick: function(tag) {
				var selectedItem = this.getSelectedItem();
				switch (tag) {
					case "edit":
						this.editWidget(selectedItem);
						break;
					case "copy":
						this.copyWidget(selectedItem);
						break;
					case "remove":
						var items = this.get("Items");
						items.remove(selectedItem);
						break;
				}
			},

			onItemDblClick: function() {
				var selectedItem = this.getSelectedItem();
				this.editWidget(selectedItem);
			},

			onSaveButtonClick: function() {
				if (!this.validate()) {
					return;
				}
				this.showBodyMask();
				var dashboardManagerItem = this.get("DashboardManagerItem");
				var saveData = this.getSaveData();
				dashboardManagerItem.setCaption(this.get("Caption"));
				dashboardManagerItem.setViewConfig(saveData.viewConfig);
				dashboardManagerItem.setItems(saveData.widgets);
				dashboardManagerItem.save(function() {
					if (dashboardManagerItem.getIsNew()) {
						this.Terrasoft.DashboardManager.addItem(dashboardManagerItem);
					}
					this.sandbox.publish("SetDesignerResult", {
						dashboardId: dashboardManagerItem.getId()
					}, [this.sandbox.id]);
					this.sandbox.publish("BackHistoryState");
				}, this);
			},

			onCancelButtonClick: function() {
				this.showBodyMask();
				this.sandbox.publish("BackHistoryState");
			},

			onSelectionEnded: function(event) {
				this.showTip({
					displayMode: Terrasoft.controls.TipEnums.displayMode.WIDE,
					content: resources.localizableStrings.SelectWidgetAction,
					alignToEl: this.Ext.get(event.target),
					items: this.getWidgets()
				});
			},

			onGetWidgetDesignerConfig: function() {
				var result = {sectionId: this.get("SectionId")};
				var selectedItem = this.getSelectedItem();
				if (selectedItem) {
					var widgetConfig = selectedItem.get("widgetConfig");
					this.Ext.apply(result, widgetConfig.parameters);
				}
				this.hideBodyMask();
				return result;
			},

			onSaveWidgetConfig: function(config) {
				var item = config.item;
				if (item) {
					var newWidgetConfig = config.widgetConfig;
					item.set("content", newWidgetConfig.caption);
					var widgetConfig = item.get("widgetConfig");
					widgetConfig.parameters = newWidgetConfig;
				} else {
					this.createNewWidget(config);
				}
			},

			//endregion

			//region Methods: Public

			openWidgetDesigner: function(widgetType) {
				this.showBodyMask();
				var selectedItem = this.getSelectedItem();
				var selection = this.get("Selection");
				var widgetTypeConfig = this.Terrasoft.DashboardEnums.WidgetType[widgetType];
				var widgetTypeDesignerConfig = widgetTypeConfig.design;
				var moduleId = this.sandbox.id + "_" + widgetTypeDesignerConfig.moduleName;
				this.sandbox.subscribe(widgetTypeDesignerConfig.configurationMessage, this.onGetWidgetDesignerConfig,
					this, [moduleId]);
				this.sandbox.subscribe(widgetTypeDesignerConfig.resultMessage, function(widgetConfig) {
					var config = {
						widgetConfig: widgetConfig,
						item: selectedItem,
						widgetType: widgetType,
						selection: selection
					};
					this.onSaveWidgetConfig(config);
				}, this, [moduleId]);
				var historyState = this.sandbox.publish("GetHistoryState");
				var moduleState = Ext.apply({hash: historyState.hash.historyState}, widgetTypeDesignerConfig.stateConfig);
				this.sandbox.publish("PushHistoryState", moduleState);
				this.sandbox.loadModule(widgetTypeDesignerConfig.moduleName, {
					"renderTo": this.renderTo,
					"id": moduleId,
					"keepAlive": true
				});
			},

			/**
			 * @inheritdoc Terrasoft.BaseSchemaViewModel#init.
			 * @protected
			 * @overridden
			 */
			init: function(callback, scope) {
				this.callParent([function() {
					this.Terrasoft.chain(
						function(next) {
							this.registerWidgetTypeMessages();
							this.Terrasoft.DashboardManager.initialize("", next, this);
						},
						function(next) {
							var dashboardInfo = this.getDashboardInfo();
							var dashboardId = dashboardInfo && dashboardInfo.dashboardId;
							if (dashboardId) {
								var dashboardItem = this.Terrasoft.DashboardManager.getItem(dashboardId);
								next(dashboardItem);
							} else {
								this.createDashboard(next, this);
							}
						},
						function(next, dashboardItem) {
							this.initItems(dashboardItem, function() {
								this.set("DashboardManagerItem", dashboardItem);
								this.set("Caption", dashboardItem.getCaption());
								callback.call(scope || this);
							}, this);
						},
						this
					);
				}, this]);
			}

			//endregion

		},
		diff: /**SCHEMA_DIFF*/[
			{
				"operation": "insert",
				"name": "DashboardDesignerContainer",
				"values": {
					"id": "DashboardDesignerContainer",
					"selectors": {"wrapEl": "#DashboardDesignerContainer"},
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"wrapClass": ["dashboard-designer-container"],
					"items": []
				}
			},
			{
				"operation": "insert",
				"name": "DashboardDesignerHeader",
				"parentName": "DashboardDesignerContainer",
				"propertyName": "items",
				"index": "0",
				"values": {
					"id": "DashboardDesignerHeader",
					"selectors": {"wrapEl": "#DashboardDesignerHeader"},
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"wrapClass": ["dashboard-designer-header"],
					"items": []
				}
			},
			{
				"operation": "insert",
				"name": "DashboardDesignerHeaderButtons",
				"parentName": "DashboardDesignerHeader",
				"propertyName": "items",
				"index": "0",
				"values": {
					"id": "DashboardDesignerHeaderButtons",
					"selectors": {"wrapEl": "#DashboardDesignerHeaderButtons"},
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"wrapClass": ["dashboard-designer-header-buttons"],
					"items": []
				}
			},
			{
				"operation": "insert",
				"name": "SaveButton",
				"parentName": "DashboardDesignerHeaderButtons",
				"propertyName": "items",
				"values": {
					"itemType": Terrasoft.ViewItemType.BUTTON,
					"caption": {"bindTo": "Resources.Strings.SaveButtonCaption"},
					"click": {"bindTo": "onSaveButtonClick"},
					"style": Terrasoft.controls.ButtonEnums.style.GREEN
				}
			},
			{
				"operation": "insert",
				"name": "CancelButton",
				"parentName": "DashboardDesignerHeaderButtons",
				"propertyName": "items",
				"values": {
					"itemType": Terrasoft.ViewItemType.BUTTON,
					"caption": {"bindTo": "Resources.Strings.CancelButtonCaption"},
					"click": {"bindTo": "onCancelButtonClick"}
				}
			},
			{
				"operation": "insert",
				"name": "DashboardDesignerHeaderInputs",
				"parentName": "DashboardDesignerHeader",
				"propertyName": "items",
				"index": "1",
				"values": {
					"id": "DashboardDesignerHeaderInputs",
					"selectors": {"wrapEl": "#DashboardDesignerHeaderInputs"},
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"wrapClass": ["dashboard-designer-header-inputs"],
					"items": []
				}
			},
			{
				"operation": "insert",
				"parentName": "DashboardDesignerHeaderInputs",
				"propertyName": "items",
				"name": "DashboardCaption",
				"values": {
					"bindTo": "Caption",
					"labelConfig": {
						"caption": {"bindTo": "Resources.Strings.DashboardCaption"}
					}
				}
			},
			{
				"operation": "insert",
				"name": "DashboardDesignerFooter",
				"parentName": "DashboardDesignerContainer",
				"propertyName": "items",
				"index": "1",
				"values": {
					"id": "DashboardDesignerFooter",
					"selectors": {"wrapEl": "#DashboardDesignerFooter"},
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"wrapClass": ["dashboard-designer-footer"],
					"items": []
				}
			},
			{
				"operation": "insert",
				"name": "DashboardDesignerGrid",
				"parentName": "DashboardDesignerFooter",
				"propertyName": "items",
				"index": "1",
				"values": {
					"id": "DashboardDesignerGrid",
					"selectors": {"wrapEl": "#DashboardDesignerGrid"},
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"wrapClass": ["dashboard-designer-grid"],
					"items": []
				}
			},
			{
				"operation": "insert",
				"name": "DashboardGrid",
				"propertyName": "items",
				"parentName": "DashboardDesignerGrid",
				"values": {
					"generator": "DashboardDesignerViewGenerator.generateGridLayout",
					"className": "Terrasoft.PreviewableGridLayouEdit",
					"id": "DashboardGrid",
					"itemClassName": "Terrasoft.PreviewableGridLayoutEditItem",
					"selectors": {"wrapEl": "#DashboardGrid"},
					"items": {"bindTo": "Items"},
					"selection": {"bindTo": "Selection"},
					"selectedItems": {"bindTo": "SelectedItems"},
					"tag": "DashboardGrid",
					"autoHeight": true,
					"maxRows": 500,
					"minRows": 20,
					"autoWidth": false,
					"multipleSelection": false,
					"allowItemsIntersection": false,
					"columns": 24,
					"markerValue": "DashboardGrid",
					"useManualSelection": true,
					"itemBindingConfig": {
						"itemId": {"bindTo": "itemId"},
						"markerValue": {"bindTo": "content"},
						"content": {"bindTo": "content"},
						"column": {"bindTo": "column"},
						"colSpan": {"bindTo": "colSpan"},
						"row": {"bindTo": "row"},
						"rowSpan": {"bindTo": "rowSpan"},
						"imageConfig": {"bindTo": "imageConfig"}
					},
					"selectionEnded": {"bindTo": "onSelectionEnded"},
					"previewReady": {
						"bindTo": "onWidgetPreviewReady"
					},
					"itemActions": [
						{
							"className": "Terrasoft.Button",
							"style": Terrasoft.controls.ButtonEnums.style.TRANSPARENT,
							"tag": "edit",
							"hint": resources.localizableStrings.SetupAction,
							"imageConfig": resources.localizableImages.ItemEditButtonImage
						},
						{
							"className": "Terrasoft.Button",
							"style": Terrasoft.controls.ButtonEnums.style.TRANSPARENT,
							"tag": "copy",
							"hint": resources.localizableStrings.CopyAction,
							"imageConfig": resources.localizableImages.ItemCopyButtonImage
						},
						{
							"className": "Terrasoft.Button",
							"style": Terrasoft.controls.ButtonEnums.style.TRANSPARENT,
							"tag": "remove",
							"hint": resources.localizableStrings.RemoveAction,
							"imageConfig": resources.localizableImages.ItemRemoveButtonImage
						}
					],
					"itemActionClick": {"bindTo": "onWidgetActionClick"},
					"itemDblClick": {"bindTo": "onItemDblClick"}
				}
			}
		]/**SCHEMA_DIFF*/
	};
});
