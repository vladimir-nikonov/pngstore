/*
 * Dashboard designer
 * Copyright(c) 2018, atf
 */


requirejs.config({paths:{atf_dashboarddesigner:"https://pngstore.azureedge.net/DashboardDesigner/src/build/atf_dashboarddesigner-min",atf_dashboarddesigner_overrides:"https://pngstore.azureedge.net/DashboardDesigner/src/build/atf_dashboarddesigner_overrides-min"},shim:{atf_dashboarddesigner:{deps:["DashboardManager","DashboardDesignerViewGenerator","CommonCSSV2","PreviewableGridLayoutEdit","PreviewableGridLayoutEditItem","DashboardDesigner"]},atf_dashboarddesigner_overrides:{deps:["DashboardBuilder"]}}});require(["atf_dashboarddesigner_overrides"]);