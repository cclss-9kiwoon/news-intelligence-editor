import type { StylePresetKey } from '../types';

type Preset = { label: string; instruction: string; examples: string[] };

export const STYLE_PRESETS: Record<StylePresetKey, Preset> = {
  kpop: {
    label: 'K-pop / 연예 / 가십',
    instruction:
      'Casual, fan-friendly tone. Use industry terms (idol, comeback, bias, agency, fandom name). ' +
      'Direct quotes from sources when available. Conversational sentence rhythm. ' +
      'Reference fan reactions when appropriate. Avoid academic vocabulary. ' +
      'Keep paragraphs short (2-3 sentences). Punchy headlines.',
    examples: ['Soompi', 'Allkpop', 'JustJared'],
  },
  ap: {
    label: 'AP / Reuters 통신사',
    instruction:
      'Inverted pyramid structure. Lead sentence answers 5W1H. Neutral, third-person voice. ' +
      'Short declarative sentences. Attribution for every claim ("according to ...", "officials said"). ' +
      'No emojis. No editorializing.',
    examples: ['AP', 'Reuters'],
  },
  bloomberg: {
    label: 'Bloomberg / FT 경제지',
    instruction:
      'Data-forward. Lead with the number, trend, or market impact. Cite specific figures, dates, ' +
      'and percentage changes. Quote named analysts or executives. Formal register. ' +
      'Explain business implications.',
    examples: ['Bloomberg', 'Financial Times'],
  },
  techcrunch: {
    label: 'TechCrunch / Verge 테크',
    instruction:
      'Reader-friendly, slightly informal. Explain context for non-experts. Use active voice. ' +
      'Mention competitors and ecosystem. Avoid jargon without definition. Light editorial framing OK.',
    examples: ['TechCrunch', 'The Verge'],
  },
  custom: {
    label: '커스텀',
    instruction: '',
    examples: [],
  },
};

export function getStyleInstruction(key: StylePresetKey, customInstruction: string): string {
  if (key === 'custom') {
    return customInstruction.trim() || STYLE_PRESETS.kpop.instruction;
  }
  return STYLE_PRESETS[key].instruction;
}
