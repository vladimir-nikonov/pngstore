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
								var formattedValue =Terrasoft.isNumberDataValueType(columnConfig.dataValueType)
									? Terrasoft.getFormattedNumberValue(this.get(columnConfig.path))
									: this.get(columnConfig.path);
								if (Ext.isDate(formattedValue)) {
									var type = null;
									for (var columnName in this.columns) {
										var column = this.columns[columnName];
										if (columnConfig.path == column.columnPath) {
											type = column.dataValueType;
											break;
										}
									}
									switch (type) {
										case Terrasoft.DataValueType.DATE:
											formattedValue =  Ext.Date.format(formattedValue, Terrasoft.Resources.CultureSettings.dateFormat);
											break;
										case Terrasoft.DataValueType.TIME:
											formattedValue = Ext.Date.format(formattedValue, Terrasoft.Resources.CultureSettings.timeFormat);
											break;
										case Terrasoft.DataValueType.DATE_TIME:
											formattedValue= Ext.Date.format(formattedValue, Terrasoft.Resources.CultureSettings.dateFormat + " " +
												Terrasoft.Resources.CultureSettings.timeFormat);
												break;
									}
								}
								return formattedValue;
							}
						}
					}
				}
			]
		};
	},

	getKanbanElementsAdditionalFields: function() {
		var result = [];
		var columnsConfig = this.get("ColumnsConfig");
		var sortedColumns = Ext.Array.sort(columnsConfig, function(x, y) {
			return x.position - y.position;
		});
		Terrasoft.each(sortedColumns, function(columnConfig) {
			if (columnConfig.path !== (this.entitySchema && this.entitySchema.primaryDisplayColumnName)) {
				if (columnConfig.visibility !== false) {
					result.push(this.generateAdditionalColumnViewConfig(columnConfig));
				}
			}
		}, this);
		return result;
	},


	getOwnerImageConfig() {
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

	getPrimaryImageConfig() {
		var primaryImageColumnName = this.entitySchema.primaryImageColumnName;
        if (!primaryImageColumnName || !this.get(primaryImageColumnName)) {
            return null;
        }
		var imageColumnValue = this.get(primaryImageColumnName);
		var imageValue =  imageColumnValue && imageColumnValue.value;
		if (!imageValue) {
			return null;
		}
        var imageConfig = {
            source: Terrasoft.ImageSources.SYS_IMAGE,
            params: {
                primaryColumnValue: imageValue
            }
        };
        return imageConfig;
	},

	getImageConfig: function() {
		var imageConfig = this.getPrimaryImageConfig() || this.getOwnerImageConfig();
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
