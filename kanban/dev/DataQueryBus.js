Ext.define("Terrasoft.extensions.DataQueryBus", {

	alternateClassName: "Terrasoft.DataQueryBus",
	
	override: "Terrasoft.EntitySchemaQuery",

	statics: {
		_queryMap: {},
		_queries: []
	},
	
	_timerId: null,

	_delay: 5,

	_batchSize: 5,

	_callback: null,

	_scope: null,

	useBatch: false,

	constructor: function() {
		this.useBatch = Terrasoft.Features.getIsEnabled("UseDataQueryBus");
		this.callParent(arguments);
	},

	getEntityCollection: function(callback, scope) {
		if (this.useBatch) {
			this._callback = callback;
			this._scope = scope;
			Terrasoft.EntitySchemaQuery._queries.push(this);
			clearTimeout(this._timerId);
			if (Terrasoft.EntitySchemaQuery._queries.length == this._batchSize) {
				this._execute();
			} else {
				this._timerId = Ext.defer(this._execute, this._delay, this);
			}
		} else {
			this.callParent(arguments);
		}
	},

	_execute: function() {
		var queries = Terrasoft.EntitySchemaQuery._queries;
		if (queries.length > 0) {
			var batchId = Terrasoft.generateGUID();
			var batch = Ext.create("Terrasoft.BatchQuery");
			var batchMap = Terrasoft.EntitySchemaQuery._queryMap[batchId] = [];
			Terrasoft.each(queries, function(query) {
				batchMap.push(query);
				batch.add(query);
			});
			Terrasoft.EntitySchemaQuery._queries = [];
			var responseFunction = function(response) {
				var batchQueries = Terrasoft.EntitySchemaQuery._queryMap[batchId];
				delete Terrasoft.EntitySchemaQuery._queryMap[batchId];
				for(var i = 0; i < batchQueries.length; i++) {
					var query = batchQueries[i];
					var queryResponse = response.queryResults[i];
					queryResponse.success = true;
					query.parseResponse(queryResponse, query._callback, query._scope);
				}
			};
			batch.execute(responseFunction, this);
		}
	}
});