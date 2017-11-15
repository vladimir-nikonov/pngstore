Ext.define("Terrasoft.extensions.BatchableEntitySchemaQuery", {
	alternateClassName: "Terrasoft.BatchableEntitySchemaQuery",
	override: "Terrasoft.EntitySchemaQuery",
	useBatch: false,
	skipResponseParsing: false,
	parseGetEntityResponse: function(response, primaryColumnValue, callback, scope) {
		if (response.collection) {
			callback.call(scope || this, {
				success: response.success,
				entity: response.collection.get(primaryColumnValue)
			});
		} else if (response.entity) {
			callback.call(scope || this, response);
		} else {
			this.callParent(arguments);
		}
	},
	parseResponse: function(response, callback, scope) {
		if (response.collection) {
			callback.call(scope || this, response);
		} else {
			this.callParent(arguments);
		}
	}
});

Ext.define("Terrasoft.extensions.DataQueryBus", {
	alternateClassName: "Terrasoft.DataQueryBus",
	override: "Terrasoft.DataProvider",
	_queries: [],
	_delay: 100,
	_batchSize: 10,
	_useBatch: Terrasoft.Features.getIsEnabled("UseDataQueryBus"),
	_esqCount: 0,
	_bqCount: 0,
	_printStatistic: false,
	_isBatchable: function(query) {
		return (query.operationType == 0 && (this._useBatch || query.useBatch));
	},
	executeQuery: function(query, callback, scope) {
		if (this._isBatchable(query)) {
			this._queries.push([query, callback, scope]);
			this._esqCount++;
			Terrasoft.debounce(
				this._execute.bind(this),
				this._delay,
				this._queries.length >= this._batchSize
			)();
		} else {
			this.callParent(arguments);
		}
	},
	_execute: function() {
		var batchItem = this._queries.shift();
		if (batchItem) {
			var batch = Ext.create("Terrasoft.BatchQuery");
			while (batchItem) {
				batch.add.apply(batch, batchItem);
				batchItem = this._queries.shift();
			}
			this._bqCount++;
			batch.execute(Terrasoft.emptyFn, this);
		}
		if (this._printStatistic) {
			console.clear();
			console.log(this._getStatistic());
		}
	},
	_getStatistic: function() {
		var eco = Ext.Number.toFixed(100 - this._bqCount * 100 / this._esqCount, 1);
		return Ext.String.format("ESQ:{0} | BQ:{1} | ECO:{2}%", this._esqCount, this._bqCount, eco);
	}
});