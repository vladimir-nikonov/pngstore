using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TagExtractor
{
	public interface ILangExtractor
	{
		Task<string> AsyncDetectLang(Guid id, string text);
	}
}
