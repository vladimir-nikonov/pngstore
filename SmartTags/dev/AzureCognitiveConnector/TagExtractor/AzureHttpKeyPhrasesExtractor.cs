using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using Newtonsoft.Json.Linq;

namespace TagExtractor
{

	public class UnsupportedLangException : Exception
	{
		public UnsupportedLangException()
			: base() {
		}

		/// <summary>
		/// Create the exception with description
		/// </summary>
		/// <param name="message">Exception description</param>
		public UnsupportedLangException(String message)
		 : base(message) {
		}

		/// <summary>
		/// Create the exception with description and inner cause
		/// </summary>
		/// <param name="message">Exception description</param>
		/// <param name="innerException">Exception inner cause</param>
		public UnsupportedLangException(String message, Exception innerException)
		  : base(message, innerException) {
		}

		/// <summary>
		/// Create the exception from serialized data.
		/// Usual scenario is when exception is occured somewhere on the remote workstation
		/// and we have to re-create/re-throw the exception on the local machine
		/// </summary>
		/// <param name="info">Serialization info</param>
		/// <param name="context">Serialization context</param>
		protected UnsupportedLangException(SerializationInfo info, StreamingContext context)
			: base(info, context) {
		}
	}

	public class AzureHttpKeyPhrasesExtractor : IKeyPhrasesExtractor
	{
		private const string UnsupportedLangMessage = "Supplied language is not supported";
		private string _operationName = "keyPhrases?";

		private readonly string _apiKey;
		private readonly string _url;

		public AzureHttpKeyPhrasesExtractor(string baseUrl, string apiKey) {
			_apiKey = apiKey;
			_url = baseUrl + _operationName;
		}

		private Exception ProcessError(string json) {
			var errors = JObject.Parse(json)["errors"];
			var message = errors[0]["message"].Value<string>();
			return message.StartsWith(UnsupportedLangMessage)
				? new UnsupportedLangException(message)
				: new Exception(message);
		}

		private byte[] PrepareData(string lang, Guid id, string text) {
			var strBuilder = new StringBuilder();
			strBuilder.Append(@"{'documents': [{'id': '");
			strBuilder.Append(id);
			strBuilder.Append("','language': '");
			strBuilder.Append(lang);
			strBuilder.Append("','text': '");
			strBuilder.Append(text);
			strBuilder.Append("'}]}");
			return Encoding.UTF8.GetBytes(strBuilder.ToString());
		}

		public async Task<List<string>> AsyncKeyPhrases(string lang, Guid id, string text) {
			var client = new HttpClient();
			var queryString = HttpUtility.ParseQueryString(string.Empty);
			client.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", _apiKey);
			var uri = _url + queryString;
			using (var content = new ByteArrayContent(PrepareData(lang, id, text))) {
				content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
				var response = await client.PostAsync(uri, content);
				if (response.IsSuccessStatusCode) {
					var json = await response.Content.ReadAsStringAsync();
					var documents = JObject.Parse(json)["documents"];
					if (documents.Any()) {
						return documents[0]["keyPhrases"].Select(key => key.Value<string>()).ToList();
					}
					throw ProcessError(json);
				}
				response.EnsureSuccessStatusCode();
				return null;
			}
		}
	}
}
