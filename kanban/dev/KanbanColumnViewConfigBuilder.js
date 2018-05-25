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

	/**
	 * Метод подготавливает шаблон рендеринга. Создает ссылки для inline-методов.
	 * @param {Ext.XTemplate} tpl Шаблон для процессинга.
	 * @protected
	 * @overridden
	 */
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
			id: Terrasoft.generateGUID(),
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
