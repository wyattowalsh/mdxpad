/**
 * Spellcheck Dictionary
 *
 * Common English words and tech terms used as a basic allowlist
 * for the spellcheck extension.
 *
 * @module renderer/lib/editor/extensions/spellcheck-dictionary
 */

// prettier-ignore
const WORD_LIST = [
  // Articles, pronouns, prepositions
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'yes',
  'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our',
  'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'who', 'whom',
  'whose', 'which', 'what', 'where', 'when', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than',
  'too', 'very', 'just', 'about', 'above', 'after', 'again', 'against',
  'also', 'any', 'because', 'before', 'between', 'into', 'through',
  'during', 'out', 'off', 'over', 'under', 'until', 'up', 'down',
  // Common verbs
  'get', 'got', 'make', 'made', 'go', 'went', 'gone', 'come', 'came',
  'take', 'took', 'taken', 'give', 'gave', 'given', 'say', 'said',
  'see', 'saw', 'seen', 'know', 'knew', 'known', 'think', 'thought',
  'find', 'found', 'tell', 'told', 'ask', 'asked', 'work', 'worked',
  'call', 'called', 'try', 'tried', 'need', 'needed', 'feel', 'felt',
  'become', 'became', 'leave', 'left', 'put', 'mean', 'meant', 'keep',
  'kept', 'let', 'begin', 'began', 'begun', 'seem', 'seemed', 'help',
  'show', 'showed', 'shown', 'hear', 'heard', 'play', 'run', 'ran',
  'move', 'moved', 'live', 'lived', 'believe', 'hold', 'held', 'bring',
  'brought', 'happen', 'write', 'wrote', 'written', 'provide', 'sit',
  'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met',
  'include', 'continue', 'set', 'learn', 'change', 'lead', 'led',
  'understand', 'understood', 'watch', 'follow', 'stop', 'create',
  'speak', 'spoke', 'read', 'allow', 'add', 'spend', 'spent', 'grow',
  'grew', 'grown', 'open', 'walk', 'win', 'won', 'offer', 'remember',
  'love', 'consider', 'appear', 'buy', 'bought', 'wait', 'serve',
  'die', 'died', 'send', 'sent', 'expect', 'build', 'built', 'stay',
  'fall', 'fell', 'fallen', 'cut', 'reach', 'kill', 'remain',
  // Common nouns
  'time', 'year', 'people', 'way', 'day', 'man', 'woman', 'child',
  'world', 'life', 'hand', 'part', 'place', 'case', 'week', 'company',
  'system', 'program', 'question', 'work', 'government', 'number',
  'night', 'point', 'home', 'water', 'room', 'mother', 'area', 'money',
  'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye',
  'job', 'word', 'business', 'issue', 'side', 'kind', 'head', 'house',
  'service', 'friend', 'father', 'power', 'hour', 'game', 'line',
  'end', 'member', 'law', 'car', 'city', 'community', 'name',
  // Common adjectives
  'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own',
  'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next',
  'early', 'young', 'important', 'public', 'bad', 'same', 'able',
  // Tech words commonly found in MDX
  'code', 'file', 'function', 'component', 'data', 'type', 'value',
  'string', 'number', 'boolean', 'array', 'object', 'class', 'const',
  'export', 'import', 'default', 'return', 'props', 'state', 'react',
  'typescript', 'javascript', 'html', 'css', 'api', 'url', 'app',
  'config', 'module', 'package', 'node', 'npm', 'pnpm', 'yarn',
  'async', 'await', 'promise', 'error', 'null', 'undefined', 'true',
  'false', 'interface', 'enum', 'void', 'readonly', 'param', 'todo',
  'mdx', 'markdown', 'jsx', 'tsx', 'json', 'yaml', 'yml',
];

/**
 * Common English words used for basic spell checking.
 * A production implementation would use a full dictionary or the
 * browser's built-in spellcheck API.
 */
export const COMMON_WORDS: ReadonlySet<string> = new Set(WORD_LIST);
