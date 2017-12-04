using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace TagExtractor
{
	public class AzureHttpLangExtractor : AzureHttpExtractor, ILangExtractor
	{

		private static string _operationName = "languages?";

		public AzureHttpLangExtractor(string baseUrl, string apiKey)
			: base(baseUrl, apiKey, _operationName) {
		}


		protected override byte[] PrepareData(Dictionary<string, object> paramMap) {
			var strBuilder = new StringBuilder();
			strBuilder.Append(@"{'documents': [{'id': '");
			strBuilder.Append(paramMap["id"]);
			strBuilder.Append("','text': '");
			strBuilder.Append(paramMap["text"]);
			strBuilder.Append("'}]}");
			return Encoding.UTF8.GetBytes(strBuilder.ToString());
		}

		public async Task<string> AsyncDetectLang(Guid id, string text) {
			var map = new Dictionary<string, object> {
				[nameof(id)] = id,
				[nameof(text)] = text
			};
			var response = await PostAsync(map);
			if (response.IsSuccessStatusCode) {
				var json = await response.Content.ReadAsStringAsync();
				var documents = JObject.Parse(json)["documents"];
				return documents[0]["detectedLanguages"][0]["iso6391Name"].Value<string>().Trim();
			}
			response.EnsureSuccessStatusCode();
			return string.Empty;
		}
	}
}
