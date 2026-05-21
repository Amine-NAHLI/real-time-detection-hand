export async function translateToArabic(text) {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`
  );
  const data = await response.json();
  if (!data?.responseData?.translatedText) throw new Error('Invalid response');
  return data.responseData.translatedText;
}
