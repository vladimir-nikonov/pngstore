namespace Terrasoft.Configuration
{
	using System;
	using System.Linq;
	using System.Text;
	using System.Security.Cryptography;
	using System.Collections.Generic;
	using System.Collections.Concurrent;
	using System.Data;
	using System.Web;
	using Terrasoft.Common;
	using Terrasoft.Common.Json;
	using Terrasoft.Core;
	using Terrasoft.Core.DB;
	using Terrasoft.Core.Entities;
	using Terrasoft.Core.Factories;
	using Terrasoft.Core.Store;
	using Terrasoft.Nui;
	using Terrasoft.UI.WebControls;
	using CoreSysSettings = Terrasoft.Core.Configuration.SysSettings;
	using Terrasoft.Nui.ServiceModel.Extensions;

	[Terrasoft.Core.Factories.Override]
	public class FileWatcherSectionHelper: ConfigurationSectionHelper
	{
		
		public FileWatcherSectionHelper(UserConnection userConnection):base(userConnection) {}
		
		public override string GetConfigurationScript(UserConnection userConnection) {
			var baseScript = base.GetConfigurationScript(userConnection);
			return baseScript;// + @"setTimeout(function(){core.loadModule('ClientFileWather');}, 5000);";
		}

	}

}