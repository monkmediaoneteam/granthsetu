// Pure data, safe for client components (no database imports).
// The first letter (akshara) of each script, its font, and the language's own name.
export const LANGUAGE_GLYPHS: Record<string, string> = {
  English: "A", Hindi: "अ", Marathi: "अ", Sanskrit: "अ", Gujarati: "અ", Tamil: "அ", Telugu: "అ", Bengali: "অ", Kannada: "ಅ", Malayalam: "അ", Urdu: "ا", Punjabi: "ਅ",
};
export const LANGUAGE_FONT: Record<string, string> = {
  English: "var(--font-head)", Hindi: "var(--font-deva)", Marathi: "var(--font-deva)", Sanskrit: "var(--font-deva)", Gujarati: "var(--font-gujr)",
  Tamil: "var(--font-taml)", Telugu: "var(--font-telu)", Bengali: "var(--font-beng)", Kannada: "var(--font-knda)",
};
export const LANGUAGE_NATIVE: Record<string, string> = {
  English: "English", Hindi: "हिन्दी", Marathi: "मराठी", Sanskrit: "संस्कृतम्", Gujarati: "ગુજરાતી", Tamil: "தமிழ்", Telugu: "తెలుగు", Bengali: "বাংলা", Kannada: "ಕನ್ನಡ", Malayalam: "മലയാളം", Urdu: "اردو", Punjabi: "ਪੰਜਾਬੀ",
};
