Ext.define("Terrasoft.controls.KanbanColumn", {
	extend: "Terrasoft.DcmStage",
	alternateClassName: "Terrasoft.KanbanColumn",

	selected: false,
	isValidateExecuted: false,
	isValid: true,
	visible: true,
	connections: null,
	onAddBtnCtElMouseEnter: Terrasoft.emptyFn,
	onAddBtnCtEMouseLeave: Terrasoft.emptyFn,
	onHeaderClick: Terrasoft.emptyFn,
	dragActionsCode: 0,

	isSuccessfull: true,

	setIsSuccessfull: function(value) {
		this.isSuccessfull = value;
	},

	/**
	 * @inheritdoc Terrasoft.controls.AbstractContainer#defaultRenderTpl
	 * @overridden
	 */
	defaultRenderTpl: [
		"<div id=\"{id}\" style=\"{wrapStyles}\" class=\"{wrapClassName}\" isSuccessfull=\"{isSuccessfull}\">",
		"<div id=\"{id}-header\" style=\"{headerStyles}\" class=\"{headerClassName}\">",
		"<div id=\"{id}-tools\" class=\"{toolsClassName}\">",
		"{%this.renderTools(out, values)%}",
		"</div>",
		"<div id=\"{id}-add-btn-ct\" class=\"{addBtnCtClassName}\">",
		"<div id=\"{id}-left-add-btn-el\" class=\"{leftAddBtnElClassName}\">",
		"</div>",
		"<div id=\"{id}-add-btn-el\" data-item-marker=\"add-new-stage\" class=\"{addBtnElClassName}\">",
		"+",
		"</div>",
		"<div id=\"{id}-right-add-btn-el\" class=\"{rightAddBtnElClassName}\">",
		"</div>",
		"</div>",
		"</div>",
		"<div id=\"{id}-valid-state\" class=\"{validStateClassName}\"></div>",
		"<div id=\"{id}-inner-container\" style=\"{innerContainerStyles}\" class=\"{innerContainerClassName}\">",
		"{%this.renderItems(out, values)%}",
		"</div>",
		"</div>"
	],

	/**
	 * @inheritdoc Terrasoft.controls.AbstractContainer#getTplData
	 * @overridden
	 */
	getTplData: function() {
		var tplData = this.callParent(arguments);
		tplData.isSuccessfull = this.isSuccessfull;
		return tplData;
	},

	getBindConfig: function() {
		var bindConfig = this.callParent(arguments);
		bindConfig.isSuccessfull = {
			changeMethod: "setIsSuccessfull"
		};
		return bindConfig;
	},

	init: function() {
		this.callParent(arguments);
		this.addEvents("elementBeforeStartDrag");
	}

});
