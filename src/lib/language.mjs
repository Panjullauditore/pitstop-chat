export const DEFAULT_LANGUAGE='en';
/** @param {string} content @param {string} language */
export function soulWithLanguage(content,language='en'){
  const clean=content.replace(/\n*<!-- PITLANE_RESPONSE_LANGUAGE -->[\s\S]*?<!-- \/PITLANE_RESPONSE_LANGUAGE -->/g,'').trim();
  return clean+'\n\n<!-- PITLANE_RESPONSE_LANGUAGE -->\n## Default response language\n- '+(language==='id'?'Use Indonesian (Bahasa Indonesia)':'Use English')+' by default, following the language selected in Pitlane Settings.\n- An explicit language request in the latest user message takes priority.\n- Keep the user\'s tone and writing preferences from Soul Memory. This setting overrides older default-language preferences only; it does not rewrite their style or project memory.\n<!-- /PITLANE_RESPONSE_LANGUAGE -->\n';
}
