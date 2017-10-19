define("KanbanSection", ["PageUtilities", "ConfigurationEnums"], function(PageUtilities, ConfigurationEnums) {
	return {

		attributes: {
			"DcmCase": {
				dataValueType: Terrasoft.DataValueType.LOOKUP,
				type: Terrasoft.ViewModelColumnType.VIRTUAL_COLUMN,
				name: "Attribute",
				caption: "Case",
				onChange: "_initializeKanbanBoard"
			},
			"DcmCases": {
				dataValueType: Terrasoft.DataValueType.COLLECTION
			},
			"LastStageFilterData": {
				type: Terrasoft.ViewModelColumnType.VIRTUAL_COLUMN,
				onChange: "_setKanbanFilter"
			},
			"LastStageFilterId": {
				type: Terrasoft.ViewModelColumnType.VIRTUAL_COLUMN,
				onChange: "_loadLastStageFilterData"
			}
		},

		methods: {

			loadGridDataRecord: function(recordId, callback, scope) {
				this.callParent(arguments);
				if (this._isKanban()) {
					var dataStorage = this.get("CaseDataStorage");
					dataStorage.loadEntity(recordId, callback, scope);
				}
			},

			_onBeforeKanbanElementSave: function() {
				this.showBodyMask();
			},

			_onAfterKanbanElementSaved: function() {
				this.hideBodyMask();
			},

			_subscribeCaseDataStorageEvents: function(caseDataStorage) {
				caseDataStorage.on("beforeKanbanElementSave", this._onBeforeKanbanElementSave, this);
				caseDataStorage.on("afterKanbanElementSaved", this._onAfterKanbanElementSaved, this);
			},

			_loadLastStageFilterData: function() {
				var filterData = this.get("LastStageFilterData");
				var filterId = this.get("LastStageFilterId");
				if (filterId == null) {
					this.set("LastStageFilterData", null);
					this.set("LastStageFilterCaption", null);
				} else if (!filterData) {
					var esq = this.Ext.create("Terrasoft.EntitySchemaQuery", {
						rootSchemaName: this.getFolderEntityName()
					});
					esq.allColumns = true;
					esq.getEntity(filterId, function(result) {
						if (result.success) {
							this.set("LastStageFilterData", result.entity.get("SearchData"));
							this.set("LastStageFilterCaption", result.entity.get("Name"));
						}
					}, this);
				}
			},

			init: function(callback, scope) {
				this.callParent([function() {
					this.set("DcmCases", this.Ext.create("Terrasoft.Collection"));
					var caseDataStorage = this.Ext.create("Terrasoft.Kanban.CaseDataStorage");
					this._subscribeCaseDataStorageEvents(caseDataStorage);
					this.set("CaseDataStorage", caseDataStorage);
					this._loadDcmCases(callback, scope);
				}, this]);
			},

			setActiveView: function() {
				this.callParent(arguments);
				var hideSettings = !this._isKanban();
				var state = this.getHistoryStateInfo();
				var needClose = !(state && state.workAreaMode == 2);
				if (hideSettings && needClose) {
					this.closeCard();
				}
				this.set("IsSortMenuVisible", hideSettings);
				this.set("IsSummarySettingsVisible", hideSettings);
			},

			afterFiltersUpdated: function() {
				this.callParent(arguments);
				if (this.kabanInitialized == true) {
					this._setKanbanFilter();
				} else {
					this._initializeKanbanBoard();
				}
			},

			_setKanbanFilter: function() {
				if (this.kabanInitialized) {
					var storage = this.get("CaseDataStorage");
					var filters = this.getSerializableFilter(this.getFilters());
					var lastStageFilter = this.get("LastStageFilterData");
					storage.setFilter(filters, lastStageFilter);
				}
			},

			_decodeColumnsSetingsFromProfile: function(profile) {
				var obj = Ext.decode(profile);
				var items = obj.items;
				var columns = [];
				Terrasoft.each(items, function(item) {
					columns.push({
						path: item.bindTo,
						dataValueType: item.dataValueType,
						caption: item.caption
					});
				}, this);
				return columns;
			},

			_getKanbanColumns: function() {
				var profile = this.get("KanbanProfile");
				var verticalPropertyName = this.getDataGridName("vertical");
				var profileColumnsConfig = null;
				var columns = [];
				if (profile && profile.tiledConfig) {
					columns = this._decodeColumnsSetingsFromProfile(profile.tiledConfig);
				} else if (profile[verticalPropertyName] && profile[verticalPropertyName].tiledConfig) {
					columns = this._decodeColumnsSetingsFromProfile(profile[verticalPropertyName].tiledConfig);
				} else {
					var entitySchema = this.entitySchema;
					var primaryColumn = entitySchema.columns[entitySchema.primaryDisplayColumn.name];
					columns.push({
						path: primaryColumn.name,
						dataValueType: primaryColumn.dataValueType,
						caption: primaryColumn.caption
					});
				}
				return columns;
			},

			_loadDcmCases: function(callback, scope) {
				var schemaUId = this.entitySchema.uId;
				var esq = Terrasoft.DcmSchemaManager.getEnabledDcmSchemasEsq(schemaUId);
				esq.filters.addItem(esq.createColumnFilterWithParameter(Terrasoft.ComparisonType.EQUAL,
					"EntitySchemaUId", schemaUId));
				esq.getEntityCollection(function(result) {
					this._setDcmCases(result);
					Ext.callback(callback, scope);
				}, this);
			},

			_setDcmCases: function(result) {
				var collection = result.collection;
				var dcmCases = this.get("DcmCases");
				collection.each(function(item) {
					item.set("Click", {bindTo: "_setActiveCase"});
					item.set("Tag", item.get("UId"));
					dcmCases.add(item.get("UId"), item);
				}, this);
				//this.set("MultiCases", dcmCases.getCount() > 1);
				//this.set("MultiCases", true);
				var dcmSchema = dcmCases.first();
				this.set("DcmCase", dcmSchema);
				if (dcmCases.getCount() > 0) {
					var dataViews = this.get("DataViews");
					this._lazyKanbanDataView(dataViews);
					this.sandbox.publish("ChangeHeaderCaption", {
						dataViews: this.get("DataViews")
					});
				}
			},

			_setActiveCase: function(caseId) {
				var cases = this.get("DcmCases");
				var selectedCase = cases.get(caseId);
				this.set("DcmCase", selectedCase);
			},

			_lazyKanbanDataView: function(baseDataViews) {
				if (!baseDataViews.contains("Kanban")) {
					var gridDataView = baseDataViews.get("GridDataView");
					baseDataViews.add("Kanban", {
						index: 1,
						name: "Kanban",
						caption: gridDataView.caption,
						hint: this.get("Resources.Strings.KanbanHint"),
						icon: this.get("Resources.Images.KanbanViewIcon")
					}, 1);
					gridDataView.index = 1;
					var analyticsDataView = baseDataViews.get("AnalyticsDataView");
					if (analyticsDataView) {
						analyticsDataView.index = 3;
					}
				}
			},


			_addKanbanDataView: function(baseDataViews) {
				if (!baseDataViews.Kanban) {
					baseDataViews.Kanban = {
						index: 1,
						name: "Kanban",
						caption: baseDataViews.GridDataView.caption,
						hint: this.get("Resources.Strings.KanbanHint"),
						icon: this.get("Resources.Images.KanbanViewIcon"),
						visible: this.get("ShowKanban")
					};
					baseDataViews.GridDataView.index = 1;
					baseDataViews.AnalyticsDataView.index = 3;
				}
			},

			getDefaultDataViews: function() {
				var baseDataViews = this.callParent();
				var activeViewName = this.getActiveViewNameFromProfile()
				if (activeViewName == "Kanban") {
					this._addKanbanDataView(baseDataViews);
				}
				return baseDataViews;
			},

			_isKanban: function() {
				return this.get("ActiveViewName") === "Kanban"
			},

			getKanbanDomAttributes: function() {
				return {
					hiddenControl: this.get("ActiveViewName") !== "Kanban"
				};
			},

			openGridSettings: function() {
				var isKanban = this._isKanban();
				if (isKanban) {
					this._openKanbanGridSettings();
				} else {
					this.callParent(arguments);
				}
			},

			_openKanbanGridSettings: function() {
				var gridSettingsId = this.sandbox.id + "_Kanbam";
				var propertyName = "KanbanColumnSettings";
				var key = this._getKanbanProfileKey();
				var entitySchemaName = this.entitySchemaName;
				this.sandbox.subscribe("GetGridSettingsInfo", function() {
					var gridSettingsInfo = {};
					gridSettingsInfo.entitySchemaName = entitySchemaName;
					gridSettingsInfo.profileKey = key;
					gridSettingsInfo.propertyName = propertyName;
					gridSettingsInfo.isSingleTypeMode = true;
					gridSettingsInfo.baseGridType = Terrasoft.GridType.TILED;
					return gridSettingsInfo;
				}, [gridSettingsId]);
				var params = this.sandbox.publish("GetHistoryState");
				this.sandbox.publish("PushHistoryState", {hash: params.hash.historyState, silent: true});
				this.sandbox.loadModule("GridSettingsV2", {
					renderTo: "centerPanel",
					id: gridSettingsId,
					keepAlive: true
				});
				this.sandbox.subscribe("GridSettingsChanged", function(args) {
				this.set("Profile", args.newProfileData);
				var storage = this.get("CaseDataStorage");
				storage.clear();
				var dcmSchema = this.get("DcmCase");
				var dcmSchemaUId = dcmSchema.get("UId");
				Terrasoft.DcmSchemaManager.getInstanceByUId(dcmSchemaUId, function(schema) {
					storage.initialize({
						dcmCaseSchema: schema,
						entitySchema: this.entitySchema,
						columnsConfig: this.columnsConfig,
						elementColumnConfig: this._getKanbanColumns(),
						lastStageFilters: this._getLastStageFilters()
					});
					storage.loadData();
				}, this);
				}, this, [gridSettingsId]);
			},

			_getLastStageFilters: function() {
				var filters = this.get("LastStageFilterData");
				if (filters == undefined) {
					var columnName = "ModifiedOn";
					var startDate = new Date();
					startDate = Terrasoft.startOfMonth(startDate);
					var dueDate = Terrasoft.endOfMonth(startDate);

					var filtersGroup = Terrasoft.createFilterGroup();
					filtersGroup.logicalOperation = Terrasoft.LogicalOperatorType.AND;

					var startFilter = Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.GREATER_OR_EQUAL,
							columnName, startDate,Terrasoft.DataValueType.DATE);
					filtersGroup.addItem(startFilter);

					var dueFilter = Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.LESS_OR_EQUAL,
							columnName, dueDate, Terrasoft.DataValueType.DATE)
					filtersGroup.addItem(dueFilter);

					var serializationInfo = filtersGroup.getDefSerializationInfo();
  					serializationInfo.serializeFilterManagerInfo = true;
					filters = filtersGroup.serialize(serializationInfo);
				}
				return filters;
			},

			_getKanbanProfileKey: function() {
				return this.entitySchemaName + "KanbanProfile";
			},

			_getVerticalProfileKey: function() {
				var tabName = "GridDataView";
				var schemaName = this.name;
				return schemaName + "GridSettings" + tabName;
			},

			_loadKanbanProfile: function(callback) {
				var kanbanKey = this._getKanbanProfileKey();
				var verticalGridProfileKey = this._getVerticalProfileKey();
				if (this.get("KanbanProfile")) {
					callback.call(this);
				} else {
					this.Terrasoft.require(["profile!" + kanbanKey, "profile!" + verticalGridProfileKey],
						function(kanbanProfile, verticalProfile) {
							var profile = kanbanProfile && kanbanProfile.KanbanColumnSettings ?
								kanbanProfile.KanbanColumnSettings : verticalProfile;
							this.set("KanbanProfile", profile);
							var lastStageFilterId = kanbanProfile ? kanbanProfile.lastStageFilterId : null;
							this.set("LastStageFilterId", lastStageFilterId);
							callback.call(this);
					}, this);
				}
			},

			getFiltersKey: function() {
				var schemaName = this.name;
				var currentTabName = this.getActiveViewName();
				if (this._isKanban()) {
					currentTabName = "GridDataView";
				}
				return schemaName + currentTabName + "Filters";
			},

			_initKanbanStorage: function() {
				if (this.kanbanLoading === true) {
					return;
				} else {
					this.kanbanLoading = true;
				}
				var dcmSchema = this.get("DcmCase");
				if (dcmSchema) {
					var dcmSchemaUId = dcmSchema.get("UId");
					this.kabanInitialized = false;
					Terrasoft.DcmElementSchemaManager.initialize(function() {
						Terrasoft.DcmSchemaManager.getInstanceByUId(dcmSchemaUId, function(schema) {
							var storage = this.get("CaseDataStorage");
							storage.initialize({
								dcmCaseSchema: schema,
								entitySchema: this.entitySchema,
								columnsConfig: this.columnsConfig,
								elementColumnConfig: this._getKanbanColumns(),
								lastStageFilters: this._getLastStageFilters()
							});
							this.kabanInitialized = true;
							this.kanbanLoading === false;
							this._setKanbanFilter();
						}, this);
					}, this);
				}
			},

			_initializeKanbanBoard: function() {
				this._loadKanbanProfile(this._initKanbanStorage);
			},

			loadKanban: function() {
				this.set("IsActionButtonsContainerVisible", true);
				this.set("IsAnalyticsActionButtonsContainerVisible", false);
			},

			loadMore: function() {
				var storage = this.get("CaseDataStorage");
				storage.loadData();
			},

			onDragOver: function() {},

			onDragDrop: function() {},

			onDragOut: function() {},

			findElementViewModel: function(uId) {
				var result;
				var stagesViewModel = this.get("CaseDataStorage");
				stagesViewModel.each(function(stageViewModel) {
					var elementsViewModel = stageViewModel.get("ViewModelItems");
					result = elementsViewModel.find(uId);
					return !result;
				}, this);
				return result;
			},

			findViewModel: function(uId) {
				var stagesViewModel = this.get("CaseDataStorage");
				var result = stagesViewModel.find(uId);
				if (!result) {
					result = this.findElementViewModel(uId);
				}
				return result;
			},

			setSelectedItem: function(id) {
				var oldSelectedItemId = this.selectedItemId;
				var viewModel = this.findViewModel(oldSelectedItemId);
				if (viewModel) {
					viewModel.setSelected(false);
				}
				if (id) {
					viewModel = this.findViewModel(id);
					if (viewModel) {
						viewModel.setSelected(true);
					}
				}
				this.selectedItemId = id;
			},

			onItemSelected: function(id) {
				this.setSelectedItem(id);
			},

			onElementDblClick: function(elementId) {
				this.editRecord(elementId);
			},

			onStageDblClick: function() {},

			moveKanbanElement: function(elementId, unsuccessfulColumnId) {
				var unsuccessfulColumn = this.findViewModel(unsuccessfulColumnId);
				unsuccessfulColumn.moveItem(elementId);
			},

			_dcmButtonCaptionCoverter: function(value) {
				return value ? value.get("Caption") : "";
			},

			getViewOptions: function() {
				var viewOptions = this.callParent(arguments);
				viewOptions.addItem(this.getButtonMenuSeparator());
				viewOptions.addItem(this.getButtonMenuItem({
					"Caption": "Setup last stage filter",
					"Visible": {"bindTo": "_isKanban"},
					"Click": {"bindTo": "_setupLastStageFilter"}
				}));
				viewOptions.addItem(this.getButtonMenuItem({
					"Caption": {"bindTo": "_clearLastStageFilterCaption"},
					"Visible": {"bindTo": "_showLastStageClear"},
					"Click": {"bindTo": "_clearLastStageFilter"}
				}));
				return viewOptions;
			},

			_clearLastStageFilterCaption: function() {
				return "Clear last stage filter (" + this.get("LastStageFilterCaption") + ")";
			},

			_showLastStageClear: function() {
				return this.get("LastStageFilterId") != null && this._isKanban();
			},

			_clearLastStageFilter: function() {
				this.set("LastStageFilterData", undefined);
				this.set("LastStageFilterCaption", null);
				this.set("LastStageFilterId", null);
			},

			_setupLastStageFilter: function() {
				var folferEntitySchemaName = this.getFolderEntityName();
				var config = {
					entitySchemaName: folferEntitySchemaName,
					columns: ["SearchData"]
				};
				this.openLookup(config, this._setLastColumnFilter, this);
			},

			_setLastColumnFilter: function(result) {
				var folder = result.selectedRows.firstOrDefault();
				var folderId = folder ? folder.value : null;
				var folderCaption = folder ? folder.displayValue : null;
				var folderFilter = folder ? folder.SearchData : null;
				this.set("LastStageFilterData", folderFilter);
				this.set("LastStageFilterCaption", folderCaption);
				this.set("LastStageFilterId", folderId);
				this._saveProfile();
			},

			_saveProfile: function() {
				var profile = this.get("KanbanProfile");
				var filterId = this.get("LastStageFilterId");
				if (profile) {
					profile.lastStageFilterId = filterId;
				} else {
					profile = {
						lastStageFilterId: filterId
					}
				}
				var profileKey = this._getKanbanProfileKey();
				this.Terrasoft.utils.saveUserProfile(profileKey, profile, false);
			}

		},

		diff: /**SCHEMA_DIFF*/[
			{
				"operation": "insert",
				"parentName": "FiltersContainer",
				"propertyName": "items",
				"position": 0,
				"index": -1,
				"name": "StageFiltersContainer",
				"values": {
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"classes": {wrapClassName: ["case-filter", "filter-inner-container", "custom-filter-button-container"]},
					"items": [],
					"domAttributes": {bindTo: "getKanbanDomAttributes"}
				}
			},
			{
				"operation": "insert",
				"parentName": "StageFiltersContainer",
				"propertyName": "items",
				"name": "DcmCase",
				"values": {
					"itemType": Terrasoft.ViewItemType.BUTTON,
					"caption": {
						"bindTo": "DcmCase",
						"bindConfig": {
							"converter": "_dcmButtonCaptionCoverter"
						}
					},
					"menu": {"items": {"bindTo": "DcmCases"}},
					"hint": {"bindTo": "Resources.Strings.CaseButton"},
					"controlConfig": {
						"style": this.Terrasoft.controls.ButtonEnums.style.TRANSPARENT,
						"iconAlign": this.Terrasoft.controls.ButtonEnums.iconAlign.LEFT,
						"imageConfig": {"bindTo": "Resources.Images.KanbanSectionFilter"}
					}
				}
			},
			{
				"operation": "insert",
				"name": "KanbanBoard",
				"parentName": "DataViewsContainer",
				"propertyName": "items",
				"values": {
					"generator": "KanbanBoardViewGenerator.generateKanbanBoard",
					"className": "Terrasoft.KanbanBoard",
					"viewModelItems": {"bindTo": "CaseDataStorage"},
					"reorderableIndex": {"bindTo": "ReorderableIndex"},
					"visible": {
						"bindTo": "_isKanban"
					},
					"classes": {
						"wrapClassName": [
							"dcm-stage-container",
							"load-empty-properties-page-on-click"
						]
					},
					"dropGroupName": "dcm-stages",
					"onElementSelected": {"bindTo": "onItemSelected"},
					"onElementRemoveButtonClick": {"bindTo": "onElementRemoveButtonClick"},
					"onElementDblClick": {"bindTo": "onElementDblClick"},
					"onStageDblClick": {"bindTo": "onStageDblClick"},
					"onStageSelected": {"bindTo": "onItemSelected"},
					"elementDragDrop": {"bindTo": "onItemSelected"},
					"loadMore": {"bindTo": "loadMore"},
					"moveElement": {"bindTo": "moveKanbanElement"}
				}
			}
		]/**SCHEMA_DIFF*/

	};
});
