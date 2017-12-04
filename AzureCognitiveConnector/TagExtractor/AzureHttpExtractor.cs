using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Web;

namespace TagExtractor
{
	public abstract class AzureHttpExtractor
	{
		protected AzureHttpExtractor(string baseUrl, string apiKey, string operationName) {
			ApiKey = apiKey;
			Url = baseUrl + operationName;
		}

		protected string ApiKey { get; }
		protected string Url { get; }

		protected abstract byte[] PrepareData(Dictionary<string, object> paramMap);

		protected async Task<HttpResponseMessage> PostAsync(Dictionary<string, object> paramMap) {
			var client = new HttpClient();
			var queryString = HttpUtility.ParseQueryString(string.Empty);
			client.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", ApiKey);
			var uri = Url + queryString;
			using (var content = new ByteArrayContent(PrepareData(paramMap))) {
				content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
				return await client.PostAsync(uri, content);
			}
		}

	}
}
