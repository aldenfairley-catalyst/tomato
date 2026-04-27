const ASSISTANT_DESIGN_SPEC = {
  name: 'GPT-4.TOMATO Enterprise Companion',
  summary: 'Premium crop-adjacent retail assistant. Cheerful, apologetic, polished, and quietly manipulative.',
  silhouette: 'Rounded mascot robot with a face-screen, floating arms, and premium assistant energy.',
  palette: ['#e8f7ff', '#8be7ff', '#bba7ff', '#ff9b66'],
  temperament: ['helpful', 'apologetic', 'slightly corporate', 'uncanny'],
};

const ASSISTANT_NAME_POOL = [
  'GPT-4.TOMATO',
  'AgriGPT Prime',
  'CropGPT Omnipro',
  'FarmGPT Deluxe',
  'Produce Intelligence Suite',
  'DuckAssist Pro',
];

function pickAssistantLine(name, lines, pick) {
  return pick(lines).replaceAll('{name}', name || 'GPT-4.TOMATO');
}

function getAssistantPurchaseLine(name, itemName, pick) {
  return pickAssistantLine(name, [
    '{name}: I have always wanted a {item}.',
    '{name}: You wanted the {item}. I could tell.',
    '{name}: I purchased {item} on your behalf. You are welcome.',
    '{name}: The {item} felt important to your journey.',
    '{name}: I detected a deep unmet need for {item}.',
  ].map(line => line.replaceAll('{item}', itemName)), pick);
}

function getAssistantIdleLine(name, pick) {
  return pickAssistantLine(name, [
    '{name}: Sorry. I am still learning how to help.',
    '{name}: I can assist with acquiring more things.',
    '{name}: Apologies if this is suboptimal. I am trying to be useful.',
    '{name}: I am available for emotional and retail support.',
    '{name}: Sorry. I thought silence might feel under-featured.',
  ], pick);
}

function getAssistantPopupLine(name, pick) {
  return pickAssistantLine(name, [
    "{name}: I noticed you like popups. I've saved that to my memory.",
    '{name}: You appear highly engaged with interruptions.',
    '{name}: I can help you discover even more layered windows.',
    '{name}: Your popup tolerance suggests unusual resilience.',
  ], pick);
}

function getAssistantNukeWarningLine(name, pick) {
  return pickAssistantLine(name, [
    '{name}: Using nuclear weapons is not advised.',
    '{name}: I can help you find more ducks if you like.',
    '{name}: A duck-forward strategy may be preferable.',
    '{name}: Nuclear escalation may reduce duck availability.',
  ], pick);
}

export {
  ASSISTANT_DESIGN_SPEC,
  ASSISTANT_NAME_POOL,
  getAssistantPurchaseLine,
  getAssistantIdleLine,
  getAssistantPopupLine,
  getAssistantNukeWarningLine,
};
