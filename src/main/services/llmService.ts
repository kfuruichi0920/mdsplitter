import { LLMProvider, LLMResponse, LLMRequest } from '../../shared/types';
import { getSettings } from './settingsService';
import { logInfo, logWarn, logError, logDebug } from './logService';

/**
 * LLM統合サービス
 * OpenAI/Gemini/Ollama APIとの統合を提供
 */

/**
 * LLMプロバイダーの抽象インターフェース
 */
interface LLMProviderInterface {
  generateCompletion(request: LLMRequest): Promise<LLMResponse>;
  validateConfig(): boolean;
}

/**
 * OpenAI API実装
 */
class OpenAIProvider implements LLMProviderInterface {
  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(apiKey: string, model: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.model = model || 'gpt-4o-mini';
    this.endpoint = endpoint || 'https://api.openai.com/v1/chat/completions';
  }

  validateConfig(): boolean {
    if (!this.apiKey) {
      logError('OpenAI API key is not configured');
      return false;
    }
    return true;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('OpenAI configuration is invalid');
    }

    const settings = getSettings();
    const timeout = request.timeout || settings.llm.timeoutMs || 60000;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const requestBody = {
      model: this.model,
      messages,
      temperature: request.temperature ?? settings.llm.temperature,
      max_tokens: request.maxTokens || settings.llm.maxTokens,
    };

    logDebug('OpenAI API request', { model: this.model, endpoint: this.endpoint });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logError('OpenAI API error', { status: response.status, error: errorText });
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      const result: LLMResponse = {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model,
      };

      logInfo('OpenAI API response received', {
        model: result.model,
        tokens: result.usage?.totalTokens,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logError('OpenAI API request timeout', { timeout });
        throw new Error(`OpenAI API request timeout after ${timeout}ms`);
      }
      logError('OpenAI API request failed', error);
      throw error;
    }
  }
}

/**
 * Gemini API実装
 */
class GeminiProvider implements LLMProviderInterface {
  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(apiKey: string, model: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.model = model || 'gemini-2.0-flash-exp';
    this.endpoint =
      endpoint ||
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  }

  validateConfig(): boolean {
    if (!this.apiKey) {
      logError('Gemini API key is not configured');
      return false;
    }
    return true;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('Gemini configuration is invalid');
    }

    const settings = getSettings();
    const timeout = request.timeout || settings.llm.timeoutMs || 60000;

    const parts: Array<{ text: string }> = [];
    if (request.systemPrompt) {
      parts.push({ text: `System: ${request.systemPrompt}\n\n` });
    }
    parts.push({ text: request.prompt });

    const requestBody = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? settings.llm.temperature,
        maxOutputTokens: request.maxTokens || settings.llm.maxTokens,
      },
    };

    logDebug('Gemini API request', { model: this.model, endpoint: this.endpoint });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logError('Gemini API error', { status: response.status, error: errorText });
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      const result: LLMResponse = {
        content: data.candidates[0].content.parts[0].text,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
        model: this.model,
      };

      logInfo('Gemini API response received', {
        model: result.model,
        tokens: result.usage?.totalTokens,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logError('Gemini API request timeout', { timeout });
        throw new Error(`Gemini API request timeout after ${timeout}ms`);
      }
      logError('Gemini API request failed', error);
      throw error;
    }
  }
}

/**
 * Ollama API実装
 */
class OllamaProvider implements LLMProviderInterface {
  private model: string;
  private endpoint: string;

  constructor(model: string, endpoint?: string) {
    this.model = model || 'llama3';
    this.endpoint = endpoint || 'http://localhost:11434/api/generate';
  }

  validateConfig(): boolean {
    // Ollamaはローカル実行なのでAPIキー不要
    return true;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      throw new Error('Ollama configuration is invalid');
    }

    const settings = getSettings();
    const timeout = request.timeout || settings.llm.timeoutMs || 120000; // Ollamaは長めに設定

    let prompt = request.prompt;
    if (request.systemPrompt) {
      prompt = `${request.systemPrompt}\n\n${request.prompt}`;
    }

    const requestBody = {
      model: this.model,
      prompt,
      temperature: request.temperature ?? settings.llm.temperature,
      stream: false,
    };

    logDebug('Ollama API request', { model: this.model, endpoint: this.endpoint });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logError('Ollama API error', { status: response.status, error: errorText });
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      const result: LLMResponse = {
        content: data.response,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        model: this.model,
      };

      logInfo('Ollama API response received', {
        model: result.model,
        tokens: result.usage?.totalTokens,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logError('Ollama API request timeout', { timeout });
        throw new Error(`Ollama API request timeout after ${timeout}ms`);
      }
      logError('Ollama API request failed', error);
      throw error;
    }
  }
}

/**
 * LLMプロバイダーファクトリー
 */
function createLLMProvider(provider: LLMProvider): LLMProviderInterface | null {
  const settings = getSettings();

  switch (provider) {
    case 'openai':
      if (!settings.llm.apiKey) {
        logError('OpenAI API key is not configured');
        return null;
      }
      return new OpenAIProvider(
        settings.llm.apiKey,
        settings.llm.model || 'gpt-4o-mini',
        settings.llm.endpoint
      );

    case 'gemini':
      if (!settings.llm.apiKey) {
        logError('Gemini API key is not configured');
        return null;
      }
      return new GeminiProvider(
        settings.llm.apiKey,
        settings.llm.model || 'gemini-2.0-flash-exp',
        settings.llm.endpoint
      );

    case 'ollama':
      return new OllamaProvider(
        settings.llm.model || 'llama3',
        settings.llm.endpoint || 'http://localhost:11434/api/generate'
      );

    case 'none':
      logWarn('LLM provider is set to none');
      return null;

    default:
      logError('Unknown LLM provider', { provider });
      return null;
  }
}

/**
 * LLM補完を生成（エントリーポイント）
 */
export async function generateLLMCompletion(request: LLMRequest): Promise<LLMResponse> {
  const settings = getSettings();
  const provider = settings.llm.provider;

  // クラウドLLMの使用チェック
  if (
    !settings.llm.allowCloud &&
    (provider === 'openai' || provider === 'gemini')
  ) {
    const error = 'Cloud LLM usage is not allowed. Please enable llm.allowCloud in settings.';
    logError(error);
    throw new Error(error);
  }

  const llmProvider = createLLMProvider(provider);
  if (!llmProvider) {
    throw new Error(`LLM provider ${provider} is not available`);
  }

  logInfo('Generating LLM completion', {
    provider,
    promptLength: request.prompt.length,
  });

  const response = await llmProvider.generateCompletion(request);

  // 匿名化ログ記録
  logInfo('LLM completion generated', {
    provider,
    model: response.model,
    tokens: response.usage?.totalTokens,
    contentLength: response.content.length,
  });

  return response;
}

/**
 * LLMプロバイダーの設定検証
 */
export function validateLLMConfig(): { valid: boolean; message: string } {
  const settings = getSettings();
  const provider = settings.llm.provider;

  if (provider === 'none') {
    return { valid: true, message: 'LLM provider is set to none' };
  }

  const llmProvider = createLLMProvider(provider);
  if (!llmProvider) {
    return { valid: false, message: `LLM provider ${provider} is not configured` };
  }

  if (!llmProvider.validateConfig()) {
    return { valid: false, message: `LLM provider ${provider} configuration is invalid` };
  }

  return { valid: true, message: 'LLM configuration is valid' };
}
