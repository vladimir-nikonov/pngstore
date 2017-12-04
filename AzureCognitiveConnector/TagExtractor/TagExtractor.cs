using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Web;

namespace TagExtractor
{
	public class TagExtractorExecuter
	{

		public TagExtractorExecuter(string baseUrl, string apiKey) {
			_langExtractor = new AzureHttpLangExtractor(baseUrl, apiKey);
			_keyPhrasesExtractor = new AzureHttpKeyPhrasesExtractor(baseUrl, apiKey);
		}

		private ILangExtractor _langExtractor;
		private IKeyPhrasesExtractor _keyPhrasesExtractor;

		private async Task<string> AsyncGetLangByText(Guid id, string text) {
			return await _langExtractor.AsyncDetectLang(id, text);
		}

		public List<string> GetTags(Guid recordId, string text, string lang) {
			try {
				var result = _keyPhrasesExtractor.AsyncKeyPhrases(lang, recordId, text).GetAwaiter();
				return result.GetResult();
			} catch (Exception e) {
				throw e;
			}
		}

		public List<string> GetTags(Guid recordId, string text) {
			var pText = HttpUtility.HtmlEncode(text);
			var lang = AsyncGetLangByText(recordId, pText).Result;
			return GetTags(recordId, pText, lang);
		}

	}

}
