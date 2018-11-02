Ext.define("Terrasoft.Kanban.DataStorage", {

	extend: "Terrasoft.BaseViewModelCollection",

	collectionEntitySchema: null,

	columnsConfig: null,

	filters: null,

	rowCount: 7,

	itemConfig: null,

	full: false,

	totalCount: null,

	_loadItem: function(data, inTop) {
		var primaryColumnName = this.collectionEntitySchema.primaryColumnName;
		var key = data.get(primaryColumnName);
		var existItem = this.find(key);
		if (existItem) {
			this.remove(existItem);
		}
		if (inTop) {
			this.insert(0, key, data);
		} else {
			this.add(key, data);
		}
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
				this._loadItem(entity, true);
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
