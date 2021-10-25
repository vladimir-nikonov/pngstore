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
		var movedId = moveData.itemId
		var groups = this.getConnections();
		moveData.item.set("GroupName", groups);
		var movedFunction = function(response) {
			if (!response.success) {
				moveData.sourceCollection.loadEntity(movedId);
				moveData.targetCollection.loadEntity(movedId);
			}
			moveData.targetCollection.un("afterKanbanElementMoved", movedFunction);
		};
		moveData.targetCollection.on("afterKanbanElementMoved", movedFunction, this);
		moveData.sourceCollection.removeByKey(moveData.itemId);
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
