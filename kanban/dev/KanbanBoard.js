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
