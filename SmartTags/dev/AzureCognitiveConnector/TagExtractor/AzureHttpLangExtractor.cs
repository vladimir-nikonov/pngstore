using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using Newtonsoft.Json.Linq;

namespace TagExtractor
{
	public class AzureHttpLangExtractor : ILangExtractor
	{

		private string _operationName = "languages?";

		private readonly string _apiKey;
		private readonly string _url;

		public AzureHttpLangExtractor(string baseUrl, string apiKey) {
			_apiKey = apiKey;
			_url = baseUrl + _operationName;
		}

		private byte[] PrepareData(Guid id, string text) {
			var strBuilder = new StringBuilder();
			strBuilder.Append(@"{'documents': [{'id': '");
			strBuilder.Append(id);
			strBuilder.Append("','text': '");
			strBuilder.Append(text);
			strBuilder.Append("'}]}");
			return Encoding.UTF8.GetBytes(strBuilder.ToString());
		}

		public async Task<string> AsyncDetectLang(Guid id, string text) {
			var client = new HttpClient();
			var queryString = HttpUtility.ParseQueryString(string.Empty);
			client.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", _apiKey);
			var uri = _url + queryString;
			HttpResponseMessage response;
			using (var content = new ByteArrayContent(PrepareData(id, text))) {
				content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
				response = await client.PostAsync(uri, content);
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
}
