using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace TagExtractor
{

	public class AzureHttpKeyPhrasesExtractor : AzureHttpExtractor, IKeyPhrasesExtractor
	{
		private const string UnsupportedLangMessage = "Supplied language is not supported";
		private static string _operationName = "keyPhrases?";

		public AzureHttpKeyPhrasesExtractor(string baseUrl, string apiKey)
			: base(baseUrl, apiKey, _operationName) {
		}

		private Exception ProcessError(string json) {
			var errors = JObject.Parse(json)["errors"];
			var message = errors[0]["message"].Value<string>();
			return message.StartsWith(UnsupportedLangMessage)
				? new UnsupportedLangException(message)
				: new Exception(message);
		}

		protected override byte[] PrepareData(Dictionary<string, object> paramMap) {
			var strBuilder = new StringBuilder();
			strBuilder.Append(@"{'documents': [{'id': '");
			strBuilder.Append(paramMap["id"]);
			strBuilder.Append("','language': '");
			strBuilder.Append(paramMap["lang"]);
			strBuilder.Append("','text': '");
			strBuilder.Append(paramMap["text"]);
			strBuilder.Append("'}]}");
			return Encoding.UTF8.GetBytes(strBuilder.ToString());
		}

		public async Task<List<string>> AsyncKeyPhrases(string lang, Guid id, string text) {
			var map = new Dictionary<string, object> {
				[nameof(id)] = id,
				[nameof(lang)] = lang,
				[nameof(text)] = text
			};
			var response = await PostAsync(map);
			if (response.IsSuccessStatusCode) {
				var json = await response.Content.ReadAsStringAsync();
				var documents = JObject.Parse(json)["documents"];
				if (documents.Any()) {
					return documents[0]["keyPhrases"].Select(key => key.Value<string>().Trim()).ToList();
				}
				throw ProcessError(json);
			}
			response.EnsureSuccessStatusCode();
			return null;
		}
	}

}
