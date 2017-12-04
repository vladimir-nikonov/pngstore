using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TagExtractor
{
	public abstract class AzureHttpExtractor
	{

		public abstract string OperationName { get; protected set; }
		protected string ApiKey { get; }
		protected string Url { get; }

		protected abstract byte[] PrepareData();

	}
}
