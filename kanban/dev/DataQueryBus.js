Ext.define("Terrasoft.extensions.DataQueryBus", {

	alternateClassName: "Terrasoft.DataQueryBus",
	
	override: "Terrasoft.DataProvider",

	_queryMap: {},

	_queries: [],

	_timerId: null,

	_delay: 5,

	_batchSize: 5,

	_callback: null,

	_scope: null,

	_useBatch: Terrasoft.Features.getIsEnabled("UseDataQueryBus"),

	executeQuery: function(query, callback, scope) {
		if (query.operationType == 0 && (this._useBatch || query.useBatch)) {
			query._callback = callback;
			query._scope = scope;
			this._queries.push(query);
			clearTimeout(this._timerId);
			if (this._queries.length == this._batchSize) {
				this._execute();
			} else {
				this._timerId = Ext.defer(this._execute, this._delay, this);
			}
		} else {
			this.callParent(arguments);
		}
	},

	_execute: function() {
		var queries = this._queries;
		if (queries.length > 0) {
			var batchId = Terrasoft.generateGUID();
			var batch = Ext.create("Terrasoft.BatchQuery");
			var batchMap = this._queryMap[batchId] = [];
			Terrasoft.each(queries, function(query) {
				batchMap.push(query);
				batch.add(query);
			});
			this._queries = [];
			var responseFunction = function(response) {
				var batchQueries = this._queryMap[batchId];
				delete this._queryMap[batchId];
				for(var i = 0; i < batchQueries.length; i++) {
					var query = batchQueries[i];
					var queryResponse = response.queryResults[i];
					queryResponse.success = true;
					query._callback.call(query._scope, queryResponse);
				}
			};
			batch.execute(responseFunction, this);
		}
	}
});