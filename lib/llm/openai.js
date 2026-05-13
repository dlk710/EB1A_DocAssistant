import OpenAI from 'openai';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CLASSIFICATION_SCHEMA, buildUserPrompt, resolvePrompts } from './index.js';
import { getModelPricing } from './pricing.js';

export class OpenAIProvider {
  static isAvailable() { return true; }

  constructor(config) {
    if (!config.apiKey) throw new Error('OpenAI API key required.');
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4o-mini';
    this.prompts = resolvePrompts(config.prompts);
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.lastMode = 'standard';
  }

  get name() { return 'openai'; }
  supportsBatch() { return true; }
  batchDiscountMultiplier() { return 0.5; }

  async classify(text, filename, context = {}) {
    this.lastMode = 'standard';
    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.prompts.systemPrompt },
          { role: 'user', content: buildUserPrompt(filename, text, this.prompts.userPromptTemplate, context.extraContext || '') },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'eb1a_classification',
            strict: true,
            schema: CLASSIFICATION_SCHEMA,
          },
        },
      });
    } catch (err) {
      throw decorateProviderError(err);
    }

    if (completion.usage) {
      this.totalInputTokens += completion.usage.prompt_tokens || 0;
      this.totalOutputTokens += completion.usage.completion_tokens || 0;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI returned no content.');
    return JSON.parse(raw);
  }

  async classifyBatch(items, { onProgress } = {}) {
    this.lastMode = 'batch';
    const emit = onProgress || (() => {});
    const payloadPath = path.join(os.tmpdir(), `eb1a-batch-${Date.now()}.jsonl`);
    try {
      const lines = items.map((item, idx) => JSON.stringify({
        custom_id: String(idx),
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: this.model,
          messages: [
            { role: 'system', content: this.prompts.systemPrompt },
            { role: 'user', content: buildUserPrompt(item.filename, item.text, this.prompts.userPromptTemplate, item.context?.extraContext || '') },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'eb1a_classification',
              strict: true,
              schema: CLASSIFICATION_SCHEMA,
            },
          },
        },
      }));
      await fsp.writeFile(payloadPath, `${lines.join('\n')}\n`, 'utf8');

      emit({ phase: 'batch', message: `Uploading batch payload for ${items.length} files…`, done: 0, total: items.length });
      const uploaded = await this.client.files.create({
        file: createReadStream(payloadPath),
        purpose: 'batch',
      });
      const batch = await this.client.batches.create({
        input_file_id: uploaded.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: {
          app: 'eb1a-organizer',
          model: this.model,
          file_count: String(items.length),
        },
      });

      emit({ phase: 'batch', message: `Batch queued (${batch.id}). Waiting for OpenAI to process it…`, batchId: batch.id, done: 0, total: items.length });
      const completed = await this.waitForBatch(batch.id, items.length, emit);
      const results = await this.readBatchResults(completed, items);
      return results;
    } catch (err) {
      throw decorateProviderError(err);
    } finally {
      await fsp.rm(payloadPath, { force: true }).catch(() => {});
    }
  }

  estimateCostUSD() {
    const price = getModelPricing(this.model) || getModelPricing('gpt-4o-mini');
    const inCost = (this.totalInputTokens / 1_000_000) * price.inputPer1M;
    const outCost = (this.totalOutputTokens / 1_000_000) * price.outputPer1M;
    const total = inCost + outCost;
    return this.lastMode === 'batch' ? total * this.batchDiscountMultiplier() : total;
  }

  stats() {
    return {
      provider: 'openai',
      model: this.model,
      mode: this.lastMode,
      input_tokens: this.totalInputTokens,
      output_tokens: this.totalOutputTokens,
      cost_usd: this.estimateCostUSD(),
    };
  }

  async waitForBatch(batchId, total, emit) {
    const terminal = new Set(['completed', 'failed', 'cancelled', 'expired']);
    while (true) {
      const batch = await this.client.batches.retrieve(batchId);
      const done = (batch.request_counts?.completed || 0) + (batch.request_counts?.failed || 0);
      emit({
        phase: 'batch',
        message: batchStatusMessage(batch, total),
        batchId,
        done,
        total,
      });
      if (terminal.has(batch.status)) {
        if (batch.status !== 'completed') {
          throw new Error(`OpenAI batch ${batch.status}. ${batch.errors?.data?.[0]?.message || 'No output file was produced.'}`);
        }
        return batch;
      }
      await sleep(10000);
    }
  }

  async readBatchResults(batch, items) {
    if (!batch.output_file_id) {
      throw new Error('OpenAI batch completed without an output file.');
    }
    const response = await this.client.files.content(batch.output_file_id);
    const raw = await response.text();
    const parsed = new Array(items.length).fill(null);

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const idx = Number.parseInt(row.custom_id, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) continue;

      const usage = row.response?.body?.usage;
      if (usage) {
        this.totalInputTokens += usage.prompt_tokens || 0;
        this.totalOutputTokens += usage.completion_tokens || 0;
      }

      if (row.response?.status_code === 200) {
        const content = row.response.body?.choices?.[0]?.message?.content;
        if (content) {
          parsed[idx] = { result: JSON.parse(content) };
          continue;
        }
      }

      const errMsg = row.error?.message || row.response?.body?.error?.message || `Batch classification failed for ${items[idx].filename}`;
      parsed[idx] = { error: new Error(errMsg) };
    }

    return parsed.map((entry, idx) => entry || { error: new Error(`Missing batch result for ${items[idx].filename}`) });
  }
}

function batchStatusMessage(batch, total) {
  const completed = batch.request_counts?.completed || 0;
  const failed = batch.request_counts?.failed || 0;
  const inProgress = Math.max(0, total - completed - failed);
  if (batch.status === 'in_progress' || batch.status === 'finalizing') {
    return `Batch mode: ${completed}/${total} completed, ${failed} failed, ${inProgress} still processing on OpenAI.`;
  }
  if (batch.status === 'validating') {
    return 'Batch mode: validating uploaded requests…';
  }
  return `Batch mode: ${batch.status}.`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decorateProviderError(err) {
  const status = err?.status;
  const code = err?.code || err?.error?.code;
  const msg = err?.message || 'OpenAI request failed.';
  const unrecoverable =
    status === 401 ||
    status === 403 ||
    (status === 429 && code === 'insufficient_quota');

  if (!unrecoverable) return err;

  const friendly = new Error(
    status === 429 && code === 'insufficient_quota'
      ? 'OpenAI API quota exceeded. Update billing or replace the API key in Settings before starting a run.'
      : 'OpenAI API key is invalid or unauthorized. Update the API key in Settings before starting a run.'
  );
  friendly.cause = err;
  friendly.unrecoverable = true;
  friendly.provider = 'openai';
  friendly.status = status;
  friendly.code = code;
  friendly.originalMessage = msg;
  return friendly;
}
