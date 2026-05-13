// Anthropic provider — stub. Same interface as OpenAIProvider.
// Wire up by installing @anthropic-ai/sdk and calling Messages.create with a tool
// that takes CLASSIFICATION_SCHEMA as its input_schema.

export class AnthropicProvider {
  static isAvailable() { return false; }

  constructor(config) {
    this.config = config;
    this.model = config.model || 'claude-sonnet-4-6';
  }
  get name() { return 'anthropic'; }
  async classify(/* text, filename */) {
    throw new Error('Anthropic provider not yet implemented. Switch provider to "openai" in settings, or implement this method.');
  }
  stats() { return { provider: 'anthropic', model: this.model, input_tokens: 0, output_tokens: 0, cost_usd: 0 }; }
}
