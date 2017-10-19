/**
 * @class Terrasoft.controls.KanbanElement
*/
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

	/**
	 * Updates selectors based on the data generated to create the layout.
	 * @protected
	 */
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
