using System;
using System.IO;
using System.Security.Permissions;
using System.Threading.Tasks;
using Terrasoft.Core;
using Terrasoft.Messaging.Common;
using Terrasoft.Web.Common;

namespace Terrasoft.Configuration
{
	public class FileEventWather : IAppEventListener
	{
		//public static string FilePathSettingsCode = "ConfigurationJSPath";

		private static FileSystemWatcher _watcher;

		private static volatile bool _initialized;

		private static readonly object _lockObject = new object();

		[PermissionSet(SecurityAction.Demand, Name = "FullTrust")]
		private void Watch(string path) {
			_watcher = new FileSystemWatcher {
				IncludeSubdirectories = true,
				Path = path,
				NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
				Filter = "*.js"
			};
			_watcher.Changed += OnChanged;
			_watcher.Created += OnChanged;
			_watcher.Deleted += OnChanged;
			_watcher.Renamed += OnChanged;
			_watcher.EnableRaisingEvents = true;
		}

		private static void OnFileChanged(string fileName) {
			var paths = fileName.Split('\\');
			string name;
			if (paths.Length > 0) {
				name = paths[paths.Length - 1];
			} else {
				name = paths[0];
			}
			var subNames = name.Split('.');
			string schemaName = subNames.Length > 2 ? subNames[1] : subNames[0];
			SendMessage(schemaName);
		}

		private static void OnChanged(object source, FileSystemEventArgs e) {
			try {
				_watcher.EnableRaisingEvents = false;
				var fileName = e.Name;
				OnFileChanged(fileName);
			} finally {
				_watcher.EnableRaisingEvents = true;
			}
		}

		private static void SendMessage(string schemaName) {
			var sysAdminUnitId = new Guid("7F3B869F-34F3-4F20-AB4D-7480A5FDF647");
			var simpleMessage = new SimpleMessage {
				Body = string.Format("\"{0}\"", schemaName),
				Id = sysAdminUnitId
			};
			simpleMessage.Header.Sender = "FileWatcher";
			var manager = MsgChannelManager.Instance;
			foreach (var channel in manager.Channels) {
				//var channel = manager.FindItemByUId(sysAdminUnitId);
				//if(channel != null) {
				channel.Value.PostMessage(simpleMessage);
				//}
			}
		}

		public virtual void OnAppEnd(AppEventContext context) {
			lock (_lockObject) {
				_watcher.Dispose();
				_watcher = null;
				_initialized = false;
			}
		}

		public virtual void OnAppStart(AppEventContext context) {
			lock (_lockObject) {
				if (!_initialized) {
					var appConection = context.Application["AppConnection"] as AppConnection;
					if (appConection == null) {
						return;
					}
					_initialized = true;
					Task.Run(() => {
						SessionHelper.InitializeSystemCurrentPrincipal();
						var userConnection = appConection.SystemUserConnection;
						var filePath = AppDomain.CurrentDomain.BaseDirectory;// + @"\Terrasoft.WebApp\Terrasoft.Configuration\Pkg";
						Watch(filePath);
					});
				}
			}
		}

		public virtual void OnSessionEnd(AppEventContext context) {}

		public virtual void OnSessionStart(AppEventContext context) {}
	}
}