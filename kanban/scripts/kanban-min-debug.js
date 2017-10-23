/*
 * Kanban
 * Copyright(c) 2017, bpm'online labs
 */

Ext.define("Terrasoft.Kanban.CaseDataStorage", {

	extend: "Terrasoft.BaseViewModelCollection",

	itemClass: "Terrasoft.KanbanColumnViewModel",

	dcmCaseSchema: null,

	pageRowCount: 7,


	filters: null,

	elementColumnConfig: null,

	lastStageFilters: null,

	init: function() {
		this.callParent(arguments);
		this.addEvent("beforeKanbanElementSave", "afterKanbanElementSaved");
	},

	_getColumnsIds: function(elementColumnsConfig) {
		return elementColumnsConfig.map(function(i) {
			return i.path;
		});
	},

	setFilter: function(filters, lastStageFilters) {
		var needReload = false;
		if (!Terrasoft.isEqual(this.filters, filters)) {
			this.filters = filters;
			needReload = true;
		}
		if (!Terrasoft.isEqual(this.lastStageFilters, lastStageFilters)) {
			this.lastStageFilters = lastStageFilters;
			needReload = true;
		}
		if (needReload) {
			this.reloadData(null, Terrasoft.emptyFn, this);
		}
	},

	initialize: function(config) {
		this.entitySchema = config.entitySchema;
		this.lastStageFilters = config.lastStageFilters;
		var schema = this.dcmCaseSchema = config.dcmCaseSchema;
		var columns = this.elementColumnConfig = config.elementColumnConfig || [];
		var visibility = false;
		if (Terrasoft.contains(this._getColumnsIds(columns), "CreatedOn")) {
			var index = this._getColumnsIds(columns).indexOf("CreatedOn");
			this.elementColumnConfig.splice(index, 1);
			visibility = true;
		}
		this.elementColumnConfig.push({
			path: "CreatedOn",
			orderDirection: Terrasoft.OrderDirection.DESC,
			orderPosition: -1,
			visibility: visibility
		});
		var stageColumn = this._getStageColumn();
		visibility = false;
		if (Terrasoft.contains(this._getColumnsIds(columns), stageColumn.columnPath)) {
			var index = this._getColumnsIds(columns).indexOf(stageColumn.columnPath);
			this.elementColumnConfig.splice(index, 1);
			visibility = true;
		}
		this.elementColumnConfig.push({
			path: stageColumn.columnPath,
			visibility: visibility
		});
		this._initColumns(schema);
	},

	loadEntity: function (recordId, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		Terrasoft.eachAsync(this.getItems(), function(kanbanColumn, next) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.loadEntity(recordId, next, this);
		}, callback, scope);
	},

	loadData: function (config, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		Terrasoft.eachAsync(this.getItems(), function(kanbanColumn, next) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.loadData(next, this);
		}, callback, scope);
	},

	_getStageColumn: function() {
		var stageColumnUId = this.dcmCaseSchema.stageColumnUId;
		return this.entitySchema.findColumnByUId(stageColumnUId);
	},

	_getFilters: function(stageId) {
		var stageColumn = this._getStageColumn();
		var caseSchemaUId = this.dcmCaseSchema.uId;
		return this._createDcmFilters(caseSchemaUId, stageColumn.name, stageId);
	},

	reloadData: function(config, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		var self = this;
		Terrasoft.eachAsync(self.getItems(), function(kanbanColumn, next) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.clear();
			kanbanElements.filters = self._getFilters(kanbanColumn.get("Id"));
			kanbanElements.loadData(next, self);
		}, callback, scope);
	},

	_generateColumnName: function() {
		if (!this.sequentialIdGenerator) {
			this.sequentialIdGenerator = new Ext.data.SequentialIdGenerator({prefix: "column"});
		}
		return this.sequentialIdGenerator.generate();
	},

	createColumn: function(config) {
		var viewModel = this.createItem(config);
		var caseSchemaUId = this.dcmCaseSchema.uId;
		var stageColumnUId = this.dcmCaseSchema.stageColumnUId;
		var stageColumn = this.entitySchema.findColumnByUId(stageColumnUId).name;
		var filters = this._createDcmFilters(caseSchemaUId, stageColumn, config.Id);
		var groupName = viewModel.get("Connections");
		var collection = Ext.create("Terrasoft.Kanban.DataStorage", {
			itemClass: "Terrasoft.KanbanElementViewModel",
			itemConfig: {
				GroupName: groupName,
				ColumnsConfig: this.elementColumnConfig
			},
			collectionEntitySchema: this.entitySchema,
			columnsConfig: this.elementColumnConfig,
			filters: filters,
			rowCount: this.pageRowCount
		});
		var self = this;
		collection.on("add", function(item) {
			if(item.get(stageColumn).value != this.get("Id")) {
				item.set(stageColumn, {
					value: this.get("Id"),
					displayValue: this.get("Caption")
				});
				item.columns[stageColumn].type = Terrasoft.ViewModelColumnType.ENTITY_COLUMN;
				self.fireEvent("beforeKanbanElementSave", item);
				item.saveEntity(function() {
					self.fireEvent("afterKanbanElementSaved", item);
				}, this);
			}
		}, viewModel);
		collection.on("loadcount", function(count) {
			this.set("RecordsCount", count);
		}, viewModel);
		viewModel.set("ViewModelItems", collection);
		this.add(viewModel.get("Id"), viewModel);
	},

	_initLastStageId: function(stages) {
		var stage;
		for(var i = stages.getCount() - 1; i >= 0; i--) {
			stage = stages.getByIndex(i);
			if (!stage.getPropertyValue("parentStageUId")) {
				break;
			}
		}
		this.lastStageId = stage.stageRecordId;
	},

	_isLastStage: function(stages, stage) {
		var parentStages = stages.filterByFn(function(item) {
			return !item.parentStageUId;
		});
		return parentStages.last().stageRecordId === stage.stageRecordId;
	},

	_getColumnsConfig: function(dcmSchema) {
		var stages = dcmSchema.stages;
		this._initLastStageId(stages);
		var result = [];
		stages.each(function(stage) {
			var connections = dcmSchema.stageConnections.getOutgoingConnections(stage.uId);
			var targetConnections = [];
			for (var i = 0; i < connections.length; i++) {
				var connection = connections[i];
				var targetStage = stages.get(connection.target);
				targetConnections.push(targetStage.stageRecordId);
			}
			var parentStage = stage.getParentStage();
			var column = {
				Id: stage.stageRecordId,
				ColumnClassName: this._generateColumnName(),
				Caption: stage.caption.getValue(),
				Color: stage.color,
				ParentColumnId: parentStage && parentStage.stageRecordId,
				IsSuccessful: stage.isSuccessful,
				IsLast: this._isLastStage(stages, stage),
				Connections: targetConnections
			};
			result.push(column);
		}, this);
		return result;
	},

	_getAlternativeColumns: function(columns, columnId) {
		return columns.filter(function(x) {
			return x.ParentColumnId === columnId && x.IsSuccessful;
		}).map(function(x) {
			return x.Id;
		}) || [];
	},

	_initColumns: function(dcmSchema) {
		var columnsConfig = this._getColumnsConfig(dcmSchema);
		Terrasoft.each(columnsConfig, function(columnConfig) {
			//todo move to _getColumnsConfig
			columnConfig.AlternativeColumns = this._getAlternativeColumns(columnsConfig, columnConfig.Id);
			this.createColumn(columnConfig);
		}, this);
	},

	_createDcmFilters: function(caseSchemaUId, stageColumnName, stageId) {
		var filters = Terrasoft.createFilterGroup();
		filters.logicalOperation = Terrasoft.LogicalOperatorType.AND;
		if (this.filters) {
			var sectionFilters = Terrasoft.deserialize(this.filters);
			filters.addItem(sectionFilters);
		}
		var isLast = stageId == this.lastStageId;
		if (isLast && this.lastStageFilters) {
			var lastStageFilter = Terrasoft.deserialize(this.lastStageFilters);
			filters.addItem(lastStageFilter);
		}
		filters.addItem(Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.EQUAL,
			stageColumnName, stageId));
		if (this.dcmCaseSchema.filters) {
			var caseFilter = Terrasoft.deserialize(this.dcmCaseSchema.filters);
			filters.addItem(caseFilter);
		}
		// filters.addItem(Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.EQUAL,
		//  	"[VwSysProcessEntity:EntityId].SysProcess.SysSchema.UId", this.dcmCaseSchema.uId));
		return filters;
	},

	_createDataColumnsConfig: function(columnsConfig) {
		var dataColumns = [];
		for (var i = 0; i < columnsConfig.length; i++) {
			var column = columnsConfig[i];
			dataColumns.push({
				path: column.path,
				orderDirection: column.orderDirection,
				orderPosition: column.orderPosition
			});
		}
		return dataColumns;
	}
});

Ext.define("Terrasoft.Kanban.DataStorage", {

	extend: "Terrasoft.BaseViewModelCollection",

	collectionEntitySchema: null,

	columnsConfig: null,

	filters: null,

	rowCount: 7,

	itemConfig: null,

	full: false,

	totalCount: null,

	_loadItem: function(data) {
		var primaryColumnName = this.collectionEntitySchema.primaryColumnName;
		var key = data.get(primaryColumnName);
		var existItem = this.find(key);
		if (existItem) {
			this.remove(existItem);
		}
		this.insert(0, key, data);
	},

	_setTotalCount: function(count) {
		if (this.totalCount != count) {
			this.totalCount = count;
			this.fireEvent("loadcount", count);
		}
	},

	loadEntity: function(recordId, callback, scope) {
		var esq = this._createEsq();
		var primaryColumnFilter = Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.EQUAL,
				this.collectionEntitySchema.primaryColumnName, recordId);
		esq.filters.addItem(primaryColumnFilter);
		esq.getEntityCollection(function(result) {
			var entity = result.collection.firstOrDefault();
			if (entity) {
				for (var prop in this.itemConfig) {
					entity.set(prop, this.itemConfig[prop]);
				}
				this._loadItem(entity);
			} else {
				var existItem = this.find(recordId);
				if (existItem) {
					this.remove(existItem);
				}
			}
			if (callback) {
				callback.call(scope || this, this);
			}
		}, this);
	},
	
	_activeToken: null,

	loadData: function(callback, scope) {
		var dataEsq = this._createEsq();
		this._applyPageOption(dataEsq);
		var currentToken = Date.now();
		this._activeToken = currentToken;
		dataEsq.getEntityCollection(function(result) {
			if (currentToken == this._activeToken) {
				var collection = result.collection;
				if (this.itemConfig) {
					collection.each(function(item) {
						for (var prop in this.itemConfig) {
							item.set(prop, this.itemConfig[prop]);
						}
						this._loadItem(item);
					}, this);
				}
				this._loadTotalCount();
			}
			Ext.callback(callback, scope);
		}, this);
	},

	_loadTotalCount: function() {
		var countEsq = this._createTotalCountEsq();
		countEsq.getEntityCollection(function(result) {
			var data = result.collection.first();
			this._setTotalCount(data.get(this._countColumnName));
		}, this);
	},

	_reset: function() {
		this.full = false;
		this.totalCount = null;
	},

	insert: function() {
		this._setTotalCount(this.totalCount + 1);
		this.callParent(arguments);
	},

	removeByIndex: function() {
		this._setTotalCount(this.totalCount - 1);
		this.callParent(arguments);
	},

	clear: function() {
		this._reset();
		this.callParent(arguments);
	},

	reloadData: function() {
		this.clear();
		this.loadData();
	},

	_countColumnName: "Count",

	_createTotalCountEsq: function() {
		var esq = Ext.create("Terrasoft.EntitySchemaQuery", {
			rootSchema: this.collectionEntitySchema
		});
		esq.addAggregationSchemaColumn("Id", Terrasoft.AggregationType.COUNT, this._countColumnName);
		if (this.filters) {
			var filters = this.filters;
			var serializationInfo = filters.getDefSerializationInfo();
			serializationInfo.serializeFilterManagerInfo = true;
			var deserializedFilters = Terrasoft.deserialize(filters.serialize(serializationInfo));
			esq.filters.add(deserializedFilters);
		}
		return esq;
	},

	_createEsq: function() {
		var esq = Ext.create("Terrasoft.EntitySchemaQuery", {
			rootSchema: this.collectionEntitySchema,
			rowCount: this.rowCount,
			isPageable: this.rowCount > 0,
			rowViewModelClassName: this.itemClass
		});
		var columns = this.columnsConfig;
		var map = {};
		var addedColumns = [];
		for (var i = 0; i < columns.length; i++) {
			var column = columns[i];
			if (addedColumns.indexOf(column.path) < 0) {
				var esqColumn = esq.addColumn(column.path);
				addedColumns.push(column.path);
				esqColumn.orderDirection = column.orderDirection;
				esqColumn.orderPosition = column.orderPosition || i;
			}
		}
		if (this.filters) {
			var filters = this.filters;
			var serializationInfo = filters.getDefSerializationInfo();
			serializationInfo.serializeFilterManagerInfo = true;
			var deserializedFilters = Terrasoft.deserialize(filters.serialize(serializationInfo));
			esq.filters.addItem(deserializedFilters);
		}
		return esq;
	},

	_applyPageOption: function(esq) {
		var recordsCount = this.getCount();
		if (Terrasoft.useOffsetFetchPaging) {
			esq.rowsOffset = recordsCount;
		} else {
			var lastRecord = this.last();
			if (lastRecord) {
				var conditionalValues = esq.conditionalValues = Ext.create("Terrasoft.ColumnValues");
				var columnName, columnValue, columnType, columns = lastRecord.columns;
				esq.columns.each(function(column) {
					if (Terrasoft.OrderDirection.ASC === column.orderDirection ||
						Terrasoft.OrderDirection.DESC === column.orderDirection) {
						columnName = column.columnPath;
						columnValue = lastRecord.get(columnName);
						columnType = columns[columnName].dataValueType;
						if (columnType === Terrasoft.DataValueType.LOOKUP) {
							columnValue = lastRecord.get(columnName).displayValue;
							columnType = Terrasoft.DataValueType.TEXT;
						}
						conditionalValues.setParameterValue(columnName, columnValue, columnType);
					}
				}, this);
				var primaryColumnName = lastRecord.primaryColumnName;
				if (!conditionalValues.contains(primaryColumnName)) {
					var primaryColumnValue = lastRecord.get(primaryColumnName);
					var primaryColumnType = columns[primaryColumnName].dataValueType;
					conditionalValues.setParameterValue(primaryColumnName, primaryColumnValue, primaryColumnType);
				}
			}
		}
	}
});


Ext.define("Terrasoft.controls.KanbanBoard", {
	extend: "Terrasoft.DcmStageContainer",
	alternateClassName: "Terrasoft.KanbanBoard",
	itemClassName: "Terrasoft.KanbanColumn",

	mixins: {
		toolsMixin: "Terrasoft.ToolsMixin"
	},

	init: function() {
		this.callParent(arguments);
		this.mixins.toolsMixin.init.apply(this, arguments);
		this.addEvents("loadMore", "moveElement");
		Ext.globalEvents.on("elementGrabbed", this.onElementGrabbed, this);
		Ext.globalEvents.on("elementReleased", this.onElementReleased, this);
	},

	onElementGrabbed: function() {
		//TODO: find out why this.wrapEl is null in some cases
		this.wrapEl && this.wrapEl.dom.setAttribute("showUnsuccessfulColumns", true);
	},

	onElementReleased: function() {
		//TODO: find out why this.wrapEl is null in some cases
		this.wrapEl && this.wrapEl.dom.setAttribute("showUnsuccessfulColumns", false);
	},

	bind: function() {
		this.callParent(arguments);
		this.mixins.toolsMixin.bind.call(this, this.model);
	},

	onDestroy: function() {
		this.mixins.toolsMixin.onDestroy.apply(this, arguments);
		this.callParent(arguments);
	},

	initRenderData: function() {
		this.callParent(arguments);
		this.mixins.toolsMixin.initRenderData.apply(this, arguments);
	},

	onWrapElScroll: function() {
		this.callParent(arguments);
		var refreshCacheObject = {};
		var columnKeys = this.viewModelItems.getKeys();
		columnKeys.map(function(columnKey) {
			refreshCacheObject[columnKey] = true;
		});
		Ext.dd.DragDropManager.refreshCache(refreshCacheObject);
	},

	getTplData: function() {
		var tplData = this.callParent(arguments);
		tplData.itemsClassName = this.itemsClassName;
		tplData.toolsClassName = this.toolsClassName;
		tplData.renderUnsuccessfulColumns = this.renderUnsuccessfulColumns;
		this.selectors["unsuccessfulColumns"] = "#" + this.id + "-unsuccessful-columns";
		return tplData;
	},

	_getColumnCaption: function(column) {
		return column.tools.items[0].caption;
	},

	_getColumnHeaderColor: function(column) {
		return column.headerColor;
	},

	_getUnsuccessfulColumnConfig: function(column) {
		var id = column.id;
		var columnHeaderColor = this._getColumnHeaderColor(column)
		var styles = Ext.String.format("background:{0};color:white;", columnHeaderColor, columnHeaderColor);
		return {
			id: id,
			class: "kanban-unsuccessful-column",
			style: styles,
			caption: this._getColumnCaption(column)
		};
	},

	onItemAdd: function(index, item) {
		this.callParent(arguments);
		this.addUnsuccessfulColumn(item);
	},

	addUnsuccessfulColumn: function(item) {
		if (this.unsuccessfulColumns && !item.isSuccessfull) {
			this.unsuccessfulColumns.createChild(this._getUnsuccessfulColumnConfig(item));
			this._registerUnsuccessfulColumnDropZones(item.id);
		}
	},

	_unsuccessfulColumnDropZones: null,

	_registerUnsuccessfulColumnDropZones: function(dropZoneId) {
		this._unsuccessfulColumnDropZones = this._unsuccessfulColumnDropZones || [];
		var dropZoneEl = Ext.get(dropZoneId);
		var dropZone = dropZoneEl.initDDTarget(dropZoneId, {}, {
			unsuccessfulColumnId: dropZoneId
		});
		this._unsuccessfulColumnDropZones.push(dropZone);
		this.applyDropZoneAdditionalParameters(dropZone);
	},

	getGroupName: function() {
		return [];
	},

	getIsScrolledToBottom: function() {
		var body = Ext.getBody();
		var element = body.dom;
		return element.clientHeight + Terrasoft.getTopScroll() >= element.scrollHeight - 10;
	},

	onWindowScroll: function() {
		if (this.getIsScrolledToBottom()) {
			this.fireEvent("loadMore");
		}
	},

	initDomEvents: function() {
		Ext.EventManager.on(window, "scroll", this.onWindowScroll, this);
	},

	itemsClassName: "kanban-board-items",

	toolsClassName: "kanban-board-tools",

	defaultRenderTpl: [
		'<div id=\"{id}\" style=\"{wrapStyles}\" class=\"{wrapClassName}\">',
			'<div id=\"{id}-inner-container\" class=\"{itemsClassName}\">',
				'{%this.renderItems(out, values)%}',
			'</div>',
			"<div id=\"{id}-tools\" class=\"{toolsClassName}\">",
				"{%this.renderTools(out, values)%}",
			"</div>",
			"<div id=\"{id}-unsuccessful-columns\" class=\"kanban-unsuccessful-columns\"></div>",
		'</div>'
	],

	onAfterReRender: function() {
		this.callParent(arguments);
		this.items.each(function(item) {
			this.addUnsuccessfulColumn(item)
		}, this);
	},

	onAfterRender: function() {
		this.callParent(arguments);
		this.items.each(function(item) {
			this.addUnsuccessfulColumn(item)
		}, this);
	},

	onDestroy: function () {
		this._clearUnsuccessfulColumnDropZones();
		this.callParent(arguments);
	},

	constructor: function() {
		this.callParent(arguments);
		this._unsuccessfulColumnDropZones = [];
	},

	onElementDragDrop: function(elementId, unsuccessfulColumnId) {
		this.fireEvent("moveElement", elementId, unsuccessfulColumnId);
	},

	_clearUnsuccessfulColumnDropZones: function() {
		this._unsuccessfulColumnDropZones.map(function(unsuccessfulColumn) {
			delete Ext.dd.DDM.ids[unsuccessfulColumn.id];
			Ext.dd.DragDropManager.refreshCache(unsuccessfulColumn.id);
		});
	},

});

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

////TODO:
// 1. hide add stage buttons
// 2. avoid stage dragging


Ext.define("Terrasoft.controls.KanbanColumn", {
	extend: "Terrasoft.DcmStage",
	alternateClassName: "Terrasoft.KanbanColumn",

	selected: false,
	isValidateExecuted: false,
	isValid: true,
	visible: true,
	connections: null,
	onAddBtnCtElMouseEnter: Terrasoft.emptyFn,
	onAddBtnCtEMouseLeave: Terrasoft.emptyFn,
	onHeaderClick: Terrasoft.emptyFn,
	dragActionsCode: 0,

	isSuccessfull: true,

	setIsSuccessfull: function(value) {
		this.isSuccessfull = value;
	},

	
	defaultRenderTpl: [
		"<div id=\"{id}\" style=\"{wrapStyles}\" class=\"{wrapClassName}\" isSuccessfull=\"{isSuccessfull}\">",
		"<div id=\"{id}-header\" style=\"{headerStyles}\" class=\"{headerClassName}\">",
		"<div id=\"{id}-tools\" class=\"{toolsClassName}\">",
		"{%this.renderTools(out, values)%}",
		"</div>",
		"<div id=\"{id}-add-btn-ct\" class=\"{addBtnCtClassName}\">",
		"<div id=\"{id}-left-add-btn-el\" class=\"{leftAddBtnElClassName}\">",
		"</div>",
		"<div id=\"{id}-add-btn-el\" data-item-marker=\"add-new-stage\" class=\"{addBtnElClassName}\">",
		"+",
		"</div>",
		"<div id=\"{id}-right-add-btn-el\" class=\"{rightAddBtnElClassName}\">",
		"</div>",
		"</div>",
		"</div>",
		"<div id=\"{id}-valid-state\" class=\"{validStateClassName}\"></div>",
		"<div id=\"{id}-inner-container\" style=\"{innerContainerStyles}\" class=\"{innerContainerClassName}\">",
		"{%this.renderItems(out, values)%}",
		"</div>",
		"</div>"
	],

	
	getTplData: function() {
		var tplData = this.callParent(arguments);
		tplData.isSuccessfull = this.isSuccessfull;
		return tplData;
	},

	getBindConfig: function() {
		var bindConfig = this.callParent(arguments);
		bindConfig.isSuccessfull = {
			changeMethod: "setIsSuccessfull"
		};
		return bindConfig;
	},

	init: function() {
		this.callParent(arguments);
		this.addEvents("elementBeforeStartDrag");
	}

});


Ext.define("Terrasoft.controls.KanbanColumnViewConfigBuilder", {
	extend: "Terrasoft.BaseObject",
	alternateClassName: "Terrasoft.KanbanColumnViewConfigBuilder",

	viewModel: null,

	getStageCaptionConfig: function() {
		return {
			className: "Terrasoft.Label",
			wordWrap: false,
			caption: {
				bindTo: "Caption"
			}
		};
	},

	getStageItemsContainerConfig: function() {
		var id = this.viewModel.get("Id");
		return {
			className: "Terrasoft.DcmReorderableContainer",
			tag: id,
			align: Terrasoft.enums.ReorderableContainer.Align.VERTICAL,
			groupName: "dcm-stage-items",
			classes: {
				wrapClassName: ["dcm-stage-items"]
			},
			viewModelItems: {
				bindTo: "ViewModelItems"
			},
			reorderableIndex: {
				bindTo: "ReorderableIndex"
			},
			onDragEnter: {
				bindTo: "onDragOver"
			},
			onDragOver: {
				bindTo: "onDragOver"
			},
			onDragDrop: {
				bindTo: "onDragDrop"
			},
			onDragOut: {
				bindTo: "onDragOut"
			},
			itemsEventMap: {
				select: "elementSelected",
				dblclick: "elementDblClick",
				removeBtnClick: "elementRemoveBtnClick"
			},
			dropGroupName: id
		};
	},

	getId: function() {
		return this.viewModel.get("Id");
	},

	
	getRecordsCountConfig: function() {
		return {
			className: "Terrasoft.Label",
			wordWrap: false,
			labelClass: "kanban-column-summary",
			caption: {
				bindTo: "RecordsCount"
			}
		};
	},

	generate: function() {
		var id = this.getId();
		return {
			className: "Terrasoft.KanbanColumn",
			tag: id,
			id: id,
			headerColor: {bindTo: "Color"},
			headerColorWarpClassName: this.viewModel.get("ColumnClassName"),
			classes: {
				wrapClassName: ["dcm-stage-wrap"],
				innerContainerClassName: ["load-empty-properties-page-on-click"]
			},
			visible: {
				bindTo: "IsSuccessful"
			},
			isSuccessfull: {
				bindTo: "IsSuccessful"
			},
			itemsEventMap: {
				"elementSelected": "elementSelected",
				"elementDblClick": "elementDblClick",
				"elementRemoveBtnClick": "elementRemoveBtnClick",
				"onDragDrop": "elementDragDrop"
			},
			addButtonStyle: {bindTo: "getHeaderStyle"},
			tools: [
				this.getStageCaptionConfig(),
				this.getRecordsCountConfig()
			],
			items: [
				this.getStageItemsContainerConfig()
			]
		};
	}

});



Ext.define("Terrasoft.controls.KanbanColumnViewModel", {
	extend: "Terrasoft.DcmStageViewModel",
	alternateClassName: "Terrasoft.KanbanColumnViewModel",

	initAttributes: function() {},
	onDcmStageElementTypesCollectionInitialized: function() {},
	applyMoveDataForDependentElements: function() {},
	applyMoveDataForChainElement: function() {},
	getViewConfig: function() {
		var builder = Ext.create("Terrasoft.KanbanColumnViewConfigBuilder", {
			viewModel: this
		});
		return builder.generate();
	},

	getReorderableIndex: function() {
		return 0;
	},

	move: function(moveData) {
		moveData.sourceCollection.removeByKey(moveData.itemId);
		var groups = this.getConnections();
		moveData.item.set("GroupName", groups);
		moveData.targetCollection.insert(0, moveData.itemId, moveData.item);
		return moveData.targetIndex;
	},

	getParentConnections: function(columnId) {
		var result = [];
		var column = this.parentCollection.find(columnId);
		if (column) {
			var parentColumnId = column.get("ParentColumnId");
			if (parentColumnId !== columnId) {
				var parentColumn = this.parentCollection.find(parentColumnId);
				if (parentColumn) {
					result = parentColumn.getConnections();
				}
			}
		}
		return result;
	},

	getConnections: function() {
		var result = [];
		var connections = this.get("Connections");
		Terrasoft.each(connections, function(connection) {
			result.push(connection);
			var nestedConnections = this.get("AlternativeColumns");
			Array.prototype.push.apply(result, nestedConnections);
		}, this);
		var parentConnections = this.getParentConnections(this.get("Id"));
		Array.prototype.push.apply(result, parentConnections);
		return result;
	},

	getIsAlternative: function() {
		return this.get("ParentColumnId") !== null;
	},

	getIsLastInGroup: function() {
		var result = false;
		var parentColumnId = this.get("ParentColumnId");
		if (parentColumnId !== null) {
			var nestedColumns = this.get("AlternativeColumns");
			var stageIndexInGroup = nestedColumns.indexOf(this.get("Id"));
			result = stageIndexInGroup === nestedColumns.length - 1;
		}
		return result;
	},

	getHeaderStyle: function() {
		var addButtonStyle;
		var isAlternative = this.getIsAlternative();
		var isLastInGroup = this.getIsLastInGroup();
		var isLast = this.get("IsLast");
		if (isLast) {
			addButtonStyle = Terrasoft.enums.DcmStage.AddButtonStyle.OUTER_ROUNDED;
		} else if (isAlternative && !isLastInGroup) {
			addButtonStyle = Terrasoft.enums.DcmStage.AddButtonStyle.INNER_ROUNDED;
		} else {
			addButtonStyle = Terrasoft.enums.DcmStage.AddButtonStyle.INNER_ARROW;
		}
		return addButtonStyle;
	}

});


Ext.define("Terrasoft.controls.KanbanElement", {
	extend: "Terrasoft.DcmStageElement",
	alternateClassName: "Terrasoft.KanbanElement",

	defaultRenderTpl: [
		'<div id="{id}" class="kanban-element-wrap">',
			'<div id="{id}-kanban-element-top" class="kanban-element-top">{caption}</div>',
			'<div id="{id}-kanban-element-bottom" class="kanban-element-bottom">',
				'<div id="{id}-kanban-element-image-container" class="kanban-element-image-container">',
					'<div id="{id}-kanban-element-image" class="kanban-element-image" style=\"{imageStyle}\"></div>',
				'</div>',
				'<div id="{id}-kanban-element-additional-columns" class="kanban-element-additional-columns">',
					"{%this.renderItems(out, values)%}",
				'</div>',
			'</div>',
		'</div>'
	],

	innerContainerClassName: "kanban-element-additional-columns",

	columnsValues: null,

	columnsConfig: null,

	
	_updateWrapSelector: function(id) {
		if (!this.selectors) {
			this.selectors = {};
		}
		this.selectors["wrapEl"] = "#" + id;
	},

	getTplData: function() {
		var id = this.instanceId;
		var tplData = this.callParent(arguments);
		tplData.id = id;
		this._updateWrapSelector(id);
		return tplData;
	},

	init: function () {
		this.callParent(arguments);
		this.addEvents("elementGrabbed");
		this.addEvents("elementReleased");
	},

	onDragEnter: function () {
		Ext.get(this.clone).addCls("kanban-element-drag-enter");
	},

	onDragOut: function() {
		Ext.get(this.clone).removeCls("kanban-element-drag-enter");
	},

	_refreshDDInstanceCache: function() {
		Ext.dd.DragDropManager.refreshCache(Ext.dd.DDM.dragCurrent.groups);
	},

	b4StartDrag: function(x, y) {
		x = x || 0;
		y = y || 0;
		var wrapEl = this.getWrapEl();
		if (wrapEl) {
			this.clone = this.createDraggableClone(wrapEl.dom, x, y);
			this.appendDraggableClone(this.clone);
			wrapEl.setVisible(this.dragCopy);
		}
		Ext.globalEvents.fireEvent("elementGrabbed", this.id);
		this.setDropZoneHintVisible(true);
		this._refreshDDInstanceCache();
	},

	onAfterReRender: function() {
		this.callParent(arguments);
		Ext.globalEvents.fireEvent("elementReleased", this.id);
		this.setDropZoneHintVisible(false);
	},

	setGroupName: function(value) {
		this.groupName = value;
	},

	getBindConfig: function() {
		var result = this.callParent(arguments);
		return Ext.apply(result, {
			groupName: {
				changeMethod: "setGroupName"
			}
		});
	},

	setDropZoneHintVisible: function(value) {
		var dropZoneInstances = this.getDropZoneInstances();
		Terrasoft.each(dropZoneInstances, function(droppableInstance) {
			var wrapEl = droppableInstance.getWrapEl();
			if (wrapEl) {
				if (value) {
					wrapEl.addCls(this.dropZoneHintClass);
				} else {
					wrapEl.removeCls(this.dropZoneHintClass);
				}
			}
		}, this);
	},

	onDragDrop: function(ddItem, crossedDDItems) {
		this.reRender();
		if (this.container) {
			var droppableElements = crossedDDItems.filter(function(i) {
				return i.droppableInstance;
			});
			var unsuccessfulColumns = droppableElements.filter(function(i) {
				return i.unsuccessfulColumnId;
			});
			var unsuccessfulColumn = unsuccessfulColumns && unsuccessfulColumns[0];
			if (unsuccessfulColumn) {
				var unsuccessfulColumnId = unsuccessfulColumn.unsuccessfulColumnId;
				unsuccessfulColumn.droppableInstance.onElementDragDrop(this.id, unsuccessfulColumnId);
			} else {
				this.container.onDragDrop(this.id);
			}
		}
	}

});


Ext.define("Terrasoft.controls.KanbanElementViewModel", {
	extend: "Terrasoft.DcmStageElementViewModel",
	alternateClassName: "Terrasoft.KanbanElementViewModel",

	subscribeOnItemChanged: Terrasoft.emptyFn,

	initAttributes: Terrasoft.emptyFn,

	getSchemaElement: function() {return {};},

	generateAdditionalColumnViewConfig: function(columnConfig) {
		var id = Terrasoft.generateGUID();
		var numberClass = Terrasoft.isNumberDataValueType(columnConfig.dataValueType) ? "column-type-number" : "";
		return {
			"className": "Terrasoft.Container",
			"classes": {"wrapClassName": "kanban-element-additional-column " + numberClass},
			"id": id + "-kanban-element-additional-column",
			"selectors": {"wrapEl": "#" + id + "-kanban-element-additional-column"},
			"items": [
				{
					className: "Terrasoft.Label",
					wordWrap: false,
					labelClass: "column-caption",
					caption: columnConfig.caption
				},
				{
					className: "Terrasoft.Label",
					wordWrap: false,
					labelClass: "column-value",
					caption: {
						bindTo: columnConfig.path,
						bindConfig: {
							converter: function() {
								return Terrasoft.isNumberDataValueType(columnConfig.dataValueType)
									? Terrasoft.getFormattedNumberValue(this.get(columnConfig.path))
									: this.get(columnConfig.path);
							}
						}
					}
				}
			]
		};
	},

	getKanbanElementsAdditionalFields: function() {
		var result = [];
		var conlumnsConfig = this.get("ColumnsConfig");
		Terrasoft.each(conlumnsConfig, function(columnConfig) {
			if (columnConfig.path !== (this.entitySchema && this.entitySchema.primaryDisplayColumnName)) {
				if (columnConfig.visibility !== false) {
					result.push(this.generateAdditionalColumnViewConfig(columnConfig));
				}
			}
		}, this);
		return result;
	},

	getImageConfig: function() {
		var primaryImageColumnValue = this.get("Owner");
		if (!primaryImageColumnValue || !primaryImageColumnValue.primaryImageValue) {
			return null;
		}
		var imageConfig = {
			source: Terrasoft.ImageSources.SYS_IMAGE,
			params: {
				primaryColumnValue: primaryImageColumnValue.primaryImageValue
			}
		};
		return imageConfig;
	},

	getViewConfig: function() {
		var primaryDisplayColumnName = this.entitySchema && this.entitySchema.primaryDisplayColumnName || "Caption";
		return {
			className: "Terrasoft.KanbanElement",
			tag: this.get("Id"),
			id: this.get("Id"),
			caption: {
				bindTo: primaryDisplayColumnName
			},
			markerValue: {
				bindTo: "Caption"
			},
			isValidateExecuted: false,
			isValid: true,
			selected: {
				bindTo: "Selected"
			},
			imageConfig: {
				bindTo: "getImageConfig"
			},
			onDragEnter: {
				bindTo: "onDragEnter"
			},
			onDragDrop: {
				bindTo: "onDragDrop"
			},
			onDragOut: {
				bindTo: "onDragOut"
			},
			groupName: {
				bindTo: "GroupName"
			},
			items: this.getKanbanElementsAdditionalFields()
		};
	}

});

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

		diff: [
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
		]

	};
});

