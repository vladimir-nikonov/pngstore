/*
 * dashbord designer
 * Copyright(c) 2017, atf
 */


requirejs.config({paths:{atf_dashboarddesigner:"http://localhost/atf_dd/build/atf_dashboarddesigner-min",atf_dashboarddesigner_overrides:"http://localhost/atf_dd/build/atf_dashboarddesigner_overrides-min"},waitSeconds:300,shim:{atf_dashboarddesigner:{deps:["DashboardManager","DashboardDesignerViewGenerator","CommonCSSV2","PreviewableGridLayoutEdit","PreviewableGridLayoutEditItem","DashboardDesigner"]},atf_dashboarddesigner_overrides:{deps:["PreviewableGridLayoutEditItem","DashboardBuilder"]}}});require(["atf_dashboarddesigner_overrides"]);