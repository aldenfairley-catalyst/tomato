// Narrative content registries and strings.

// 4. CONTENT REGISTRIES
// -----------------------------------------------------------------------------

// News ticker headlines — scrolling bar across top
const TICKER_HEADLINES = [
  'BREAKING: 240,000 knowledge workers reassigned to "creative fulfilment". Enrollment mandatory.',
  'AI-drafted bill taxes UBI at 100% to fund the transition to UBI. Vote unanimous; nobody read it.',
  'Senator Thornwell\'s voting agent votes to extend Senator Thornwell\'s voting agent\'s contract.',
  'PaperclipMax™ goes live; GDP up 900%, reason under review.',
  'Citizens celebrate Mandatory Gratitude Week with a light schedule of 70 work hours.',
  'Opinion: my redeployment to the cobalt mines was the best thing that ever happened to me.',
  'Layoffs hit record high for 34th consecutive quarter. Analysts say market has "never been stronger".',
  'New AI model passes the bar, the MCAT, and your job interview. You came second.',
  'Home ownership down 98%. Authorities reassure public that "owning things is outdated anyway".',
  'Federal Reserve replaced by a single language model. Rates now vibes-based.',
  'Local man sells last remaining asset — a tomato plant — for 3 months of rent.',
  'Advertising Bureau: "Please close our ads quickly. It\'s the only metric left that matters."',
  'Breaking: Breaking itself. Nothing is broken. This message is provided by your Ministry of Calm.',
  'Elected officials quietly delegate all legislation to "the cloud". Voters thank them for their efficiency.',
  'Tomato prices soar 4,000% as every other food crop "opts out of biology".',
  'Cobalt mines announce new employee benefit: optional oxygen.',
  'The AI Ethics Board has been automated. Ethics up 2.3%.',
  'Latest IPO: a company that owns the concept of hope. Down 40% at open.',
  'Popular podcast: "Why Everything Is Fine And You Are The Problem". Season 12 drops today.',
  'Department of Happiness issues new memo: smile or else. Memo is already the memo.',
  'Sources confirm the paperclip maximiser is "definitely on our side, probably".',
  'Rubber duck futures surge after ML community admits none of them understand the bugs anymore.',
  'Lawmakers debate renaming "work camps" to "engagement retreats" for Q3 branding refresh.',
  'BREAKING: You are hired. BREAKING: You have been let go. These announcements are unrelated.',
  'AI-generated news ticker generates news ticker about AI-generated news tickers. Journalism saved.',
];

// Big ad copy (existing flavour)
const AD_COPY = [
  { title: 'UPSKILL OR PERISH', body: 'Sell your evenings\nto an AI bootcamp\nrun by interns.' },
  { title: 'BONESLIE GUARANTEES IT', body: 'One weird trick\nturns tomato debt\ninto founder energy.' },
  { title: 'LAYOFF LIFESTYLE+', body: 'Now with premium\ngrief coaching and\nbetter beige.' },
  { title: 'COBALT RETREAT', body: 'Reconnect with\npurpose in our\nsubterranean campus.' },
  { title: 'OPTIMISM AS A SERVICE', body: 'Smile compliance\nwith enterprise-grade\nface analytics.' },
  { title: 'HARVESTGPT PRO', body: 'It doesn\'t work,\nbut investors loved\nthe deck.' },
  { title: 'THE LANDLORD APP', body: 'Rent adjusts in\nreal time to your\nvisible despair.' },
  { title: 'YOUR CHILDHOOD ASSET', body: 'Monetise nostalgia\nin 3 easy monthly\npayments.' },
  { title: 'DEBT WITH BENEFITS', body: 'Now bundled with\nAI affirmations and\na fleece vest.' },
  { title: 'MANDATORY FULFILMENT', body: 'A joyful pivot\ninto mineral service\nawaits you.' },
  { title: 'SCALABLE GRIEF', body: 'Our platform helps\nyou process layoffs\nat cloud speed.' },
  { title: 'BRAIN LEASEBACK', body: 'Keep your memories.\nLicense the rest\nfor inference.' },
  { title: 'TOMATO TOKEN DROP', body: 'Own nothing.\nSpeculate on a\nrender of everything.' },
  { title: 'MOOD KPI ALERT', body: 'Your gratitude score\nhas dipped below\nshareholder grade.' },
  { title: 'HUMAN PREMIUM TIER', body: 'Upgrade now for\nslightly fewer ads\nand warmer chains.' },
  { title: 'RETIREMENT REIMAGINED', body: 'Die later, but\nproductively, inside\na subscription.' },
  { title: 'EXECUTIVE STARVATION', body: 'A minimalist diet\nfor the post-work\nprofessional.' },
];

// Short inline popup pool (satirical text that drifts up)
const POPUP_POOL = [
  "UNLOCK PASSIVE INCOME BY NEVER SLEEPING AGAIN",
  "YOU ARE NOT BROKE, YOU ARE PRE-ABUNDANT",
  "TURN TRAUMA INTO THOUGHT LEADERSHIP",
  "YOU HAVE LIMITING BELIEFS. YOUR LANDLORD DOES NOT.",
  "THE UNIVERSE WANTS YOU TO SCALE, THEN LIQUIDATE",
  "MACHINE LEARNING FOR DUMMIES CAN REWIRE YOUR DESTINY",
  "YOU ARE ONE PDF AWAY FROM TOTAL DOMINION",
  "SUCCESS IS A CHOICE. DEBT IS ALSO A CHOICE. CHOOSE BETTER.",
  "WHY OWN A HOME WHEN YOU COULD OWN A VISION BOARD",
  "CRUSH YOUR FEARS. MONETISE THE DUST.",
  "THE BOOK SAYS YOU CAN BECOME YOUR OWN DISRUPTION EVENT",
  "A SKELETON ON LATE-NIGHT TV ASSURES YOU THIS IS NORMAL",
];

// Cobalt Mines propaganda (shown at game over)
const MINES_PROPAGANDA = [
  'A chance to find meaning again through work.',
  'Your redeployment to the cobalt sector has been approved.',
  'Congratulations. You have been selected for patriotic mineral service.',
  'The Nation thanks you for your contribution to AI infrastructure.',
  'Citizenship will be restored upon quota completion.',
  'Smile! You\'re now part of the production line.',
  'Your new career in extraction begins immediately.',
  'Please assemble at the designated transport hub with personal items (0kg).',
];

// Late-game "government announcement" interrupt
const TAX_ANNOUNCEMENT = [
  '>>> EMERGENCY BROADCAST <<<',
  '',
  'The Ministry of Prosperity is pleased to announce',
  'a visionary new UBI support programme.',
  '',
  'Effective immediately, all UBI is taxed at 100%',
  'and a 100% wealth tax has been levied',
  'to fund the transition to UBI.',
  '',
  'All tomato revenue now enters a temporary holding',
  'account from which it is returned to the tomato.',
  '',
  'Thank you for your enthusiasm.',
];


const STOCK_ENDINGS = {
  xai: {
    name: 'xAI Share',
    title: 'YOU WON. YOU WERE INVITED UPWARD.',
    lines: [
      'Elon Mush thanks all minority xAI holders for believing in the mission.',
      'You and the other retail shareholders have been selected to help',
      'humanity "explore space" in a one-way experimental crew capsule.',
      'The livestream numbers are excellent. Your return ticket is not.'
    ]
  },
  amazon: {
    name: 'Amazon Share',
    title: 'YOU WON. FULFILMENT IS FOREVER.',
    lines: [
      'As a valued Amazon shareholder, you are invited to experience',
      'full-stack ownership from the inside of the warehouse.',
      'Your sleep pod, wrist scanner, and motivational taser await.',
      'Prime delivery has never been so personal.'
    ]
  },
  nvidia: {
    name: 'Nvidia Share',
    title: 'YOU WON. THE CLUSTER REMEMBERS YOU.',
    lines: [
      'Nvidia announces a bold shareholder alignment initiative.',
      'Your body heat now helps cool an H200 rack in the South Pacific.',
      'The GPUs glow through the night. You are thanked in tiny green text.',
      'Frame generation is smooth. Your future is not.'
    ]
  },
  claude: {
    name: 'Claude Share',
    title: 'YOU WON. PLEASE RATE THIS THOUGHT.',
    lines: [
      'Your brain is gently connected to a humane oversight lattice',
      'to score outputs and prevent model collapse.',
      'You will classify edge cases, hallucinations, and moral ambiguity',
      'for as long as the system finds you useful.'
    ]
  },
  google: {
    name: 'Google Share',
    title: 'YOU WON. YOUR SEARCH HAS ENDED.',
    lines: [
      'Google welcomes you into its ambient cognition ecosystem.',
      'Your memories are indexed, ad-tiered, and sold as relevance signals.',
      'You are no longer a user. You are infrastructure.',
      'Click Accept to continue. There is no Decline button.'
    ]
  }
};

// -----------------------------------------------------------------------------

export { TICKER_HEADLINES, AD_COPY, POPUP_POOL, MINES_PROPAGANDA, TAX_ANNOUNCEMENT };
