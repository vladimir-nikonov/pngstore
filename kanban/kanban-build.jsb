<?xml version="1.0" encoding="utf-8"?>
<project path="" name="Kanban" author="A.T.F" version="2.0.10" copyright="$projectName&#xD;&#xA;Copyright(c) 2017, $author" output="\script" source="False" source-dir="scripts" minify="true" min-dir="$output\build" doc="False" doc-dir="$output\docs" master="true" master-file="$output\yui-ext.js" zip="true" zip-file="$output\yuo-ext.$version.zip">
  <directory name="src" />
  <file name="src\CaseDataStorage.js" path="" />
  <file name="src\CollectionDataStorage.js" path="" />
  <file name="src\KanbanBoard.js" path="" />
  <file name="src\KanbanBoardViewGenerator.js" path="" />
  <file name="src\KanbanColumn.js" path="" />
  <file name="src\KanbanColumnViewConfigBuilder.js" path="" />
  <file name="src\KanbanElement.js" path="" />
  <file name="src\KanbanSection.js" path="" />
  <file name="src\KanbanElementViewModel.js" path="" />
  <file name="src\KanbanColumnViewModel.js" path="" />
  <target name="kanban" file="scripts\kanban-min.js" debug="True" shorthand="False" shorthand-list="YAHOO.util.Dom.setStyle&#xD;&#xA;YAHOO.util.Dom.getStyle&#xD;&#xA;YAHOO.util.Dom.getRegion&#xD;&#xA;YAHOO.util.Dom.getViewportHeight&#xD;&#xA;YAHOO.util.Dom.getViewportWidth&#xD;&#xA;YAHOO.util.Dom.get&#xD;&#xA;YAHOO.util.Dom.getXY&#xD;&#xA;YAHOO.util.Dom.setXY&#xD;&#xA;YAHOO.util.CustomEvent&#xD;&#xA;YAHOO.util.Event.addListener&#xD;&#xA;YAHOO.util.Event.getEvent&#xD;&#xA;YAHOO.util.Event.getTarget&#xD;&#xA;YAHOO.util.Event.preventDefault&#xD;&#xA;YAHOO.util.Event.stopEvent&#xD;&#xA;YAHOO.util.Event.stopPropagation&#xD;&#xA;YAHOO.util.Event.stopEvent&#xD;&#xA;YAHOO.util.Anim&#xD;&#xA;YAHOO.util.Motion&#xD;&#xA;YAHOO.util.Connect.asyncRequest&#xD;&#xA;YAHOO.util.Connect.setForm&#xD;&#xA;YAHOO.util.Dom&#xD;&#xA;YAHOO.util.Event">
    <include name="dev\CaseDataStorage.js" />
    <include name="dev\CollectionDataStorage.js" />
    <include name="dev\KanbanBoard.js" />
    <include name="dev\KanbanBoardViewGenerator.js" />
    <include name="dev\KanbanColumn.js" />
    <include name="dev\KanbanColumnViewConfigBuilder.js" />
    <include name="dev\KanbanColumnViewModel.js" />
    <include name="dev\KanbanElement.js" />
    <include name="dev\KanbanElementViewModel.js" />
    <include name="dev\KanbanSection.js" />
    <include name="dev\DataQueryBus.js" />
  </target>
  <directory name="dev" />
  <file name="dev\CaseDataStorage.js" path="" />
  <file name="dev\CollectionDataStorage.js" path="" />
  <file name="dev\KanbanBoard.js" path="" />
  <file name="dev\KanbanBoardViewGenerator.js" path="" />
  <file name="dev\KanbanColumn.js" path="" />
  <file name="dev\KanbanColumnViewConfigBuilder.js" path="" />
  <file name="dev\KanbanColumnViewModel.js" path="" />
  <file name="dev\KanbanElement.js" path="" />
  <file name="dev\KanbanElementViewModel.js" path="" />
  <file name="dev\KanbanSection.js" path="" />
  <file name="dev\DataQueryBus.js" path="" />
</project>