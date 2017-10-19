/**
 * @class Terrasoft.controls.KanbanColumnViewModel
 */
Ext.define("Terrasoft.controls.KanbanElementViewModel", {
	extend: "Terrasoft.DcmStageElementViewModel",
	alternateClassName: "Terrasoft.KanbanElementViewModel",

	subscribeOnItemChanged: Terrasoft.emptyFn,

	initAttributes: Terrasoft.emptyFn,

	getSchemaElement: function() {return {};},

	generateAdditionalColumnViewConfig: function(columnConfig) {
		var id = Terrasoft.generateGUID();
		var numberClass = Terrasoft.isNumberDataValueType(columnConfig.dataValueType) ? "column-type-number" : "";
		return {
			"className": "Terrasoft.Container",
			"classes": {"wrapClassName": "kanban-element-additional-column " + numberClass},
			"id": id + "-kanban-element-additional-column",
			"selectors": {"wrapEl": "#" + id + "-kanban-element-additional-column"},
			"items": [
				{
					className: "Terrasoft.Label",
					wordWrap: false,
					labelClass: "column-caption",
					caption: columnConfig.caption
				},
				{
					className: "Terrasoft.Label",
					wordWrap: false,
					labelClass: "column-value",
					caption: {
						bindTo: columnConfig.path,
						bindConfig: {
							converter: function() {
								return Terrasoft.isNumberDataValueType(columnConfig.dataValueType)
									? Terrasoft.getFormattedNumberValue(this.get(columnConfig.path))
									: this.get(columnConfig.path);
							}
						}
					}
				}
			]
		};
	},

	getKanbanElementsAdditionalFields: function() {
		var result = [];
		var conlumnsConfig = this.get("ColumnsConfig");
		Terrasoft.each(conlumnsConfig, function(columnConfig) {
			if (columnConfig.path !== (this.entitySchema && this.entitySchema.primaryDisplayColumnName)) {
				if (columnConfig.visibility !== false) {
					result.push(this.generateAdditionalColumnViewConfig(columnConfig));
				}
			}
		}, this);
		return result;
	},

	getImageConfig: function() {
		var primaryImageColumnValue = this.get("Owner");
		if (!primaryImageColumnValue || !primaryImageColumnValue.primaryImageValue) {
			return null;
		}
		var imageConfig = {
			source: Terrasoft.ImageSources.SYS_IMAGE,
			params: {
				primaryColumnValue: primaryImageColumnValue.primaryImageValue
			}
		};
		return imageConfig;
	},

	getViewConfig: function() {
		var primaryDisplayColumnName = this.entitySchema && this.entitySchema.primaryDisplayColumnName || "Caption";
		return {
			className: "Terrasoft.KanbanElement",
			tag: this.get("Id"),
			id: this.get("Id"),
			caption: {
				bindTo: primaryDisplayColumnName
			},
			markerValue: {
				bindTo: "Caption"
			},
			isValidateExecuted: false,
			isValid: true,
			selected: {
				bindTo: "Selected"
			},
			imageConfig: {
				bindTo: "getImageConfig"
			},
			onDragEnter: {
				bindTo: "onDragEnter"
			},
			onDragDrop: {
				bindTo: "onDragDrop"
			},
			onDragOut: {
				bindTo: "onDragOut"
			},
			groupName: {
				bindTo: "GroupName"
			},
			items: this.getKanbanElementsAdditionalFields()
		};
	}

});
