export async function translateToArabic(text) {
  const cleanText = (text || '').trim();
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(cleanText)}`
  );
  const data = await response.json();
  if (!data?.[0]?.[0]?.[0]) throw new Error('Invalid response');
  return data[0][0][0];
}
