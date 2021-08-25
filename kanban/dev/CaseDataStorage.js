Ext.define("Terrasoft.CaseDataStorage", {

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
		Terrasoft.each(self.getItems(), function(kanbanColumn, next) {
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


Ext.define("Terrasoft.ActivityDataStorage", {

	extend: "Terrasoft.CaseDataStorage",

	itemClass: "Terrasoft.KanbanColumnViewModel",

	pageRowCount: 7,

	filters: null,

	elementColumnConfig: null,

	lastStageId: null,

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
		this._loadStatuses(this._initColumns, this);
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
		return this.entitySchema.getColumnByName("Status");
	},

	_getFilters: function(stageId) {
		var stageColumn = this._getStageColumn();
		return this._createDcmFilters(stageColumn.name, stageId);
	},

	reloadData: function(config, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		var self = this;
		Terrasoft.each(self.getItems(), function(kanbanColumn, next) {
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
		var stageColumn = this._getStageColumn();
		var filters = this._createDcmFilters(stageColumn, config.Id);
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
		var stageColumnName = stageColumn.name;
		collection.on("add", function(item) {
			if(item.get(stageColumnName).value != this.get("Id")) {
				item.set(stageColumnName, {
					value: this.get("Id"),
					displayValue: this.get("Caption")
				});
				item.columns[stageColumnName].type = Terrasoft.ViewModelColumnType.ENTITY_COLUMN;
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
		return;
		var stage;
		for(var i = stages.getCount() - 1; i >= 0; i--) {
			stage = stages.getByIndex(i);
			if (!stage.getPropertyValue("parentStageUId")) {
				break;
			}
		}
	},

	_isLastStage: function(stages, stage) {
		var parentStages = stages.filterByFn(function(item) {
			return !item.parentStageUId;
		});
		return parentStages.last().stageRecordId === stage.stageRecordId;
	},

	_loadStatuses: function(callback, scope) {
		var esq = Ext.create("Terrasoft.EntitySchemaQuery", {
			rootSchemaName: "ActivityStatus"
		});
		esq.allColumns = true;
		esq.getEntityCollection(function(result) {
				callback.apply(scope, [result.collection]);
		}, scope);
	},

	_getColumnsConfig: function(stages) {
		this._initLastStageId(stages);
		var result = [];
		var targetConnections = [];
		stages.each(function(stage) {
			var targetStage = stage.get("Id");
			targetConnections.push(targetStage);
		}, this);
		stages.each(function(stage) {
			var column = {
				Id: stage.get("Id"),
				ColumnClassName: this._generateColumnName(),
				Caption: stage.get("Name"),
				Color: "#8ecb60",
				IsSuccessful: true,
				IsLast: stage.isLast,
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

	_initColumns: function(stages) {
		var columnsConfig = this._getColumnsConfig(stages);
		Terrasoft.each(columnsConfig, function(columnConfig) {
			//todo move to _getColumnsConfig
			columnConfig.AlternativeColumns = this._getAlternativeColumns(columnsConfig, columnConfig.Id);
			this.createColumn(columnConfig);
		}, this);
	},

	_createDcmFilters: function(stageColumnName, stageId) {
		var filters = Terrasoft.createFilterGroup();
		filters.logicalOperation = Terrasoft.LogicalOperatorType.AND;
		// if (this.filters) {
		// 	var sectionFilters = this.filters;
		// 	filters.addItem(sectionFilters);
		// }
		var isLast = stageId == this.lastStageId;
		if (isLast && this.lastStageFilters) {
			var lastStageFilter = Terrasoft.deserialize(this.lastStageFilters);
			filters.addItem(lastStageFilter);
		}
		filters.addItem(Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.EQUAL,
			stageColumnName, stageId));
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
