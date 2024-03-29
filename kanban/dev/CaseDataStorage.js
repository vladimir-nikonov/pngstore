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
		this.addEvent("beforeKanbanElementSave", "afterKanbanElementSaved", "afterKanbanElementMoved", "checkAllDataLoaded");
	},

	checkAllDataLoaded: function() {
		var allColumnsDataLoaded = false;
		var callback = Terrasoft.emptyFn;
		Terrasoft.each(this.getItems(), function(kanbanColumn) {
			var totalRowsCount = kanbanColumn.get("RecordsCount");
			var currentRowsCount = kanbanColumn.get("ViewModelItems").getCount();
			if (totalRowsCount > currentRowsCount) {
				allColumnsDataLoaded = true;
			}
		}, callback, this);
		this.fireEvent("checkAllDataLoaded", {allDataLoaded: allColumnsDataLoaded});
	},

	getColumnsIds: function(elementColumnsConfig) {
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
		var createdOnPosition = 0;
		if (Terrasoft.contains(this.getColumnsIds(columns), "CreatedOn")) {
			var index = this.getColumnsIds(columns).indexOf("CreatedOn");
			createdOnPosition = columns[index].position;
			this.elementColumnConfig.splice(index, 1);
			visibility = true;
		}
		this.elementColumnConfig.push({
			path: "CreatedOn",
			orderDirection: Terrasoft.OrderDirection.DESC,
			orderPosition: -1,
			visibility: visibility,
			position: createdOnPosition
		});
		var stageColumn = this.getStageColumn();
		visibility = false;
		if (Terrasoft.contains(this.getColumnsIds(columns), stageColumn.columnPath)) {
			var index = this.getColumnsIds(columns).indexOf(stageColumn.columnPath);
			this.elementColumnConfig.splice(index, 1);
			visibility = true;
		}
		this.elementColumnConfig.push({
			path: stageColumn.columnPath,
			visibility: visibility
		});
		this.initColumns(schema);
	},

	loadEntity: function (recordId, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		Terrasoft.eachAsync(this.getItems(), function(kanbanColumn) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.loadEntity(recordId, next, this);
		}, callback, scope);
		this.checkAllDataLoaded();
	},

	loadData: function (config, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		Terrasoft.eachAsync(this.getItems(), function(kanbanColumn, next) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.loadData(next, this);
		}, function() {
			this.checkAllDataLoaded();
			Ext.callback(callback, scope);
		}, this);
		
	},

	getStageColumn: function() {
		var stageColumnUId = this.dcmCaseSchema.stageColumnUId;
		return this.entitySchema.findColumnByUId(stageColumnUId);
	},

	getFilters: function(stageId) {
		var stageColumn = this.getStageColumn();
		var caseSchemaUId = this.dcmCaseSchema.uId;
		return this.createDcmFilters(caseSchemaUId, stageColumn.name, stageId);
	},

	reloadData: function(config, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		var self = this;
		Terrasoft.eachAsync(self.getItems(), function(kanbanColumn, next) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.clear();
			kanbanElements.filters = self.getFilters(kanbanColumn.get("Id"));
			kanbanElements.loadData(next, self);
		}, function() {
			self.checkAllDataLoaded();
			Ext.callback(callback, scope);
		});
		
	},

	generateColumnName: function() {
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
		var filters = this.createDcmFilters(caseSchemaUId, stageColumn, config.Id);
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
				item.saveEntity(function(response) {
					item.parentCollection.fireEvent("afterKanbanElementMoved", {
						success: response.success
					});
					self.fireEvent("afterKanbanElementSaved", item);
					if (response.success === false) {
						self.fireEvent("errorSaveEntity", response);
					}
				}, this);
			}
		}, viewModel);
		collection.on("loadcount", function(count) {
			this.set("RecordsCount", count);
			self.checkAllDataLoaded();
		}, viewModel);
		viewModel.set("ViewModelItems", collection);
		this.add(viewModel.get("Id"), viewModel);
	},

	initLastStageId: function(stages) {
		var stage;
		for(var i = stages.getCount() - 1; i >= 0; i--) {
			stage = stages.getByIndex(i);
			if (!stage.getPropertyValue("parentStageUId")) {
				break;
			}
		}
		this.lastStageId = stage.stageRecordId;
	},

	isLastStage: function(stages, stage) {
		var parentStages = stages.filterByFn(function(item) {
			return !item.parentStageUId;
		});
		return parentStages.last().stageRecordId === stage.stageRecordId;
	},

	getColumnsConfig: function(dcmSchema) {
		var stages = dcmSchema.stages;
		this.initLastStageId(stages);
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
				ColumnClassName: this.generateColumnName(),
				Caption: stage.caption.getValue(),
				Color: stage.color,
				ParentColumnId: parentStage && parentStage.stageRecordId,
				IsSuccessful: stage.isSuccessful,
				IsLast: this.isLastStage(stages, stage),
				Connections: targetConnections
			};
			result.push(column);
		}, this);
		return result;
	},

	getAlternativeColumnsisLastStage: function(columns, columnId) {
		return columns.filter(function(x) {
			return x.ParentColumnId === columnId && x.IsSuccessful;
		}).map(function(x) {
			return x.Id;
		}) || [];
	},

	initColumns: function(dcmSchema) {
		var columnsConfig = this.getColumnsConfig(dcmSchema);
		Terrasoft.each(columnsConfig, function(columnConfig) {
			//todo move to getColumnsConfig
			columnConfig.AlternativeColumns = this.getAlternativeColumnsisLastStage(columnsConfig, columnConfig.Id);
			this.createColumn(columnConfig);
		}, this);
	},

	createDcmFilters: function(caseSchemaUId, stageColumnName, stageId) {
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

	createDataColumnsConfig: function(columnsConfig) {
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

	getColumnsIds: function(elementColumnsConfig) {
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
		var position = 0;
		if (Terrasoft.contains(this.getColumnsIds(columns), "CreatedOn")) {
			var index = this.getColumnsIds(columns).indexOf("CreatedOn");
			this.elementColumnConfig.splice(index, 1);
			visibility = true;
		}
		this.elementColumnConfig.push({
			path: "CreatedOn",
			orderDirection: Terrasoft.OrderDirection.DESC,
			orderPosition: -1,
			visibility: visibility
		});
		var stageColumn = this.getStageColumn();
		visibility = false;
		if (Terrasoft.contains(this.getColumnsIds(columns), stageColumn.columnPath)) {
			var index = this.getColumnsIds(columns).indexOf(stageColumn.columnPath);
			this.elementColumnConfig.splice(index, 1);
			visibility = true;
		}
		this.elementColumnConfig.push({
			path: stageColumn.columnPath,
			visibility: visibility
		});
		this._loadStatuses(this.initColumns, this);
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

	getStageColumn: function() {
		return this.entitySchema.getColumnByName("Status");
	},

	getFilters: function(stageId) {
		var stageColumn = this.getStageColumn();
		return this.createDcmFilters(stageColumn.name, stageId);
	},

	reloadData: function(config, callback, scope) {
		callback = callback || Terrasoft.emptyFn;
		var self = this;
		Terrasoft.each(self.getItems(), function(kanbanColumn, next) {
			var kanbanElements = kanbanColumn.get("ViewModelItems");
			kanbanElements.clear();
			kanbanElements.filters = self.getFilters(kanbanColumn.get("Id"));
			kanbanElements.loadData(next, self);
		}, callback, scope);
	},

	generateColumnName: function() {
		if (!this.sequentialIdGenerator) {
			this.sequentialIdGenerator = new Ext.data.SequentialIdGenerator({prefix: "column"});
		}
		return this.sequentialIdGenerator.generate();
	},

	createColumn: function(config) {
		var viewModel = this.createItem(config);
		var stageColumn = this.getStageColumn();
		var filters = this.createDcmFilters(stageColumn, config.Id);
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
				item.saveEntity(function(response) {
					item.parentCollection.fireEvent("afterKanbanElementMoved", {
						success: response.success
					});
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

	initLastStageId: function(stages) {
		return;
		var stage;
		for(var i = stages.getCount() - 1; i >= 0; i--) {
			stage = stages.getByIndex(i);
			if (!stage.getPropertyValue("parentStageUId")) {
				break;
			}
		}
	},

	isLastStage: function(stages, stage) {
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

	getColumnsConfig: function(stages) {
		this.initLastStageId(stages);
		var result = [];
		var targetConnections = [];
		stages.each(function(stage) {
			var targetStage = stage.get("Id");
			targetConnections.push(targetStage);
		}, this);
		stages.each(function(stage) {
			var column = {
				Id: stage.get("Id"),
				ColumnClassName: this.generateColumnName(),
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

	getAlternativeColumnsisLastStage: function(columns, columnId) {
		return columns.filter(function(x) {
			return x.ParentColumnId === columnId && x.IsSuccessful;
		}).map(function(x) {
			return x.Id;
		}) || [];
	},

	initColumns: function(stages) {
		var columnsConfig = this.getColumnsConfig(stages);
		Terrasoft.each(columnsConfig, function(columnConfig) {
			//todo move to getColumnsConfig
			columnConfig.AlternativeColumns = this.getAlternativeColumnsisLastStage(columnsConfig, columnConfig.Id);
			this.createColumn(columnConfig);
		}, this);
	},

	createDcmFilters: function(stageColumnName, stageId) {
		var filters = Terrasoft.createFilterGroup();
		filters.logicalOperation = Terrasoft.LogicalOperatorType.AND;
		if (this.filters) {
			filters.addItem(this.filters);
		}
		var isLast = stageId == this.lastStageId;
		if (isLast && this.lastStageFilters) {
			var lastStageFilter = Terrasoft.deserialize(this.lastStageFilters);
			filters.addItem(lastStageFilter);
		}
		filters.addItem(Terrasoft.createColumnFilterWithParameter(Terrasoft.ComparisonType.EQUAL,
			stageColumnName, stageId));
		return filters;
	},

	createDataColumnsConfig: function(columnsConfig) {
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
