using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace TagExtractor
{
	internal interface IKeyPhrasesExtractor
	{
		Task<List<string>> AsyncKeyPhrases(string lang, Guid id, string text);
	}
}