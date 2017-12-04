using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TagExtractor;

namespace Runner
{
	class Program
	{
		private static string _defaultApiKey = "78fd64a2f2474316a341ead6ce0d198e";
		private static string _defaultUrl = "https://westeurope.api.cognitive.microsoft.com/text/analytics/v2.0/";

		static void Main(string[] args) {
			var tExtractor = new TagExtractorExecuter(_defaultUrl, _defaultApiKey);
			try {
				var	tags = tExtractor.GetTags(new Guid(), @"Что то на русском");
				tags.ForEach(tag => Console.WriteLine(tag));
			} catch (UnsupportedLangException exception) {
				Console.WriteLine(exception.Message);
			} catch (Exception ex) {
				Console.WriteLine(ex.Message);
			}
			Console.ReadKey();
		}
	}
}
