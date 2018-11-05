define("KanbanSection", ["PageUtilities", "ConfigurationEnums"], function(PageUtilities, ConfigurationEnums) {
	return {
		//
		attributes: {
			"DcmCase": {
				dataValueType: Terrasoft.DataValueType.LOOKUP,
				type: Terrasoft.ViewModelColumnType.VIRTUAL_COLUMN,
				name: "Attribute",
				caption: "Case",
				onChange: "_changeCase"
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

			_changeCase: function() {
				this._loadKanbanStorage();
				var selectedCase = this.get("DcmCase");
				this.caseUId = selectedCase ? selectedCase.get("UId") : null;
				this._saveProfile();
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
					this._initKanbanStorage();
					this._loadKanbanProfile(callback, scope);
				}, this]);
			},

			setActiveView: function() {
				this.callParent(arguments);
				var hideSettings = !this._isKanban();
				this.set("IsSortMenuVisible", hideSettings);
				this.set("IsSummarySettingsVisible", hideSettings);
			},

			onFilterUpdate: function() {
				if (this.ignoreFilters()) {
					return;
				}
				this.filtersInitialized = true;
				this.callParent(arguments);
				this._setKanbanFilter();
			},

			_setKanbanFilter: function() {
				if (!this.kanbanLoading && this.filtersInitialized) {
					var storage = this.get("CaseDataStorage");
					var filters = this.getSerializableFilter(this.getFilters());
					var lastStageFilter = this.get("LastStageFilterData");
					storage.setFilter(filters, lastStageFilter);
				} else {
					this._loadKanbanStorage();
				}
			},

			_decodeColumnsSetingsFromProfile: function(profile) {
				var obj = Ext.decode(profile, true);
				var items = obj && obj.items;
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
				var columns = [];
				if (!this._tryGetProfileColumns(columns)) {
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
			
			_tryGetProfileColumns: function(columns) {
				var profile = this.get("KanbanProfile");
				var propertyName = profile && profile.KanbanColumnSettings
					? "KanbanColumnSettings"
					: this.getDataGridName("vertical");
				var tiledConfig = (profile && profile.tiledConfig)
					|| (profile && profile[propertyName] && profile[propertyName].tiledConfig);
				var profileColumns = this._decodeColumnsSetingsFromProfile(tiledConfig);
				Terrasoft.append(columns, profileColumns);
				return columns.length > 0;
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
				dcmCases.clear();
				collection.each(function(item) {
					item.set("Click", {bindTo: "_setActiveCase"});
					item.set("Tag", item.get("UId"));
					dcmCases.add(item.get("UId"), item);
				}, this);
				var dcmSchema = dcmCases.find(this.caseUId) || dcmCases.first();
				this.set("DcmCase", dcmSchema);
				if (dcmCases.getCount() > 0) {
					this._updateMainHedareCaption();
				}
			},

			_updateMainHedareCaption: function() {
				var caption = this.getActiveViewCaption();
				var dataViews = this.get("DataViews");
				this._lazyKanbanDataView(dataViews);
				var activeViewName = this.getActiveViewName();
				var activeView = dataViews.get(activeViewName);
				var markerValue = activeView.caption;
				this.sandbox.publish("ChangeHeaderCaption", {
					caption: caption || this.getDefaultGridDataViewCaption(),
					markerValue: markerValue,
					dataViews: dataViews,
					moduleName: this.name
				});
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
				return;
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
				this._addKanbanDataView(baseDataViews);
				return baseDataViews;
			},

			_isKanban: function() {
				return this.get("ActiveViewName") === "Kanban";
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
					this.set("KanbanProfile", args.newProfileData);
					this._loadKanbanStorage();
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
							columnName, startDate, Terrasoft.DataValueType.DATE);
					filtersGroup.addItem(startFilter);

					var dueFilter = Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.LESS_OR_EQUAL,
							columnName, dueDate, Terrasoft.DataValueType.DATE);
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

			_loadKanbanProfile: function(callback, scope) {
				var kanbanKey = this._getKanbanProfileKey();
				var verticalGridProfileKey = this._getVerticalProfileKey();
				if (this.get("KanbanProfile")) {
					callback.call(scope);
				} else {
					this.Terrasoft.require(["profile!" + kanbanKey, "profile!" + verticalGridProfileKey],
						function(kanbanProfile, verticalProfile) {
							var profile = kanbanProfile && kanbanProfile.KanbanColumnSettings ?
								kanbanProfile : verticalProfile;
							this.set("KanbanProfile", profile);
							var lastStageFilterId = kanbanProfile ? kanbanProfile.lastStageFilterId : null;
							this.set("LastStageFilterId", lastStageFilterId);
							this.caseUId = kanbanProfile ? kanbanProfile.caseUId : null;
							this._loadDcmCases();
							callback.call(scope);
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
				var storage = this.Ext.create("Terrasoft.Kanban.CaseDataStorage");
				storage.on("beforeKanbanElementSave", this.showBodyMask, this);
				storage.on("afterKanbanElementSaved", this.hideBodyMask, this);
				this.set("CaseDataStorage", storage);
			},

			_loadKanbanStorage: function() {
				//if (!this._isKanban()) {
					//return;
				//}
				if (this.kanbanLoading === true) {
					return;
				} else {
					this.kanbanLoading = true;
				}
				var dcmSchema = this.get("DcmCase");
				if (dcmSchema) {
					var dcmSchemaUId = dcmSchema.get("UId");
					Terrasoft.DcmElementSchemaManager.initialize(function() {
						Terrasoft.DcmSchemaManager.getInstanceByUId(dcmSchemaUId, function(schema) {
							var storage = this.get("CaseDataStorage");
							storage.clear();
							storage.initialize({
								dcmCaseSchema: schema,
								entitySchema: this.entitySchema,
								columnsConfig: this.columnsConfig,
								elementColumnConfig: this._getKanbanColumns(),
								lastStageFilters: this._getLastStageFilters()
							});
							this.kanbanLoading = false;
							if (this.filtersInitialized) {
								this._setKanbanFilter();
							}
						}, this);
					}, this);
				}
			},

			_timeoutId: null,

			loadKanban: function() {
				this.set("IsActionButtonsContainerVisible", true);
				this.set("IsAnalyticsActionButtonsContainerVisible", false);
			},

			loadMore: function() {
				this.showBodyMask();
				var storage = this.get("CaseDataStorage");
				storage.loadData();
				setTimeout(function() {
					this.hideBodyMask();
				}.bind(this), 1000);
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
					profile.caseUId = this.caseUId;
				} else {
					profile = {
						lastStageFilterId: filterId,
						caseUId: this.caseUId
					};
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
					"domAttributes": {bindTo: "getKanbanDomAttributes"},
					"visible": {
						"bindTo": "_isKanban",
					}
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
					"moveElement": {"bindTo": "moveKanbanElement"}
				}
			},
			{
				"operation": "insert",
				"name": "LoadMoreContainer",
				"propertyName": "items",
				"values": {
					"id": "LoadMoreContainer",
					"itemType": Terrasoft.ViewItemType.CONTAINER,
					"items": [],
					"wrapClass": ["load-more-container"],
					"visible": "$_isKanban"
				}
			},			
			{
				"operation": "insert",
				"parentName": "LoadMoreContainer",
				"propertyName": "items",
				"name": "LoadMore",
				"values": {
					"itemType": Terrasoft.ViewItemType.BUTTON,
					"style": this.Terrasoft.controls.ButtonEnums.style.TRANSPARENT,
					"caption": "Load more data...",
					"imageConfig": {
						"source": Terrasoft.ImageSources.URL,
						"url": "https://cdn4.iconfinder.com/data/icons/universal-7/614/5_-_Refresh-16.png"
					},
					"click": "$loadMore"					
				}
			}
		]/**SCHEMA_DIFF*/

	};
});