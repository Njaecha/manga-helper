/**
 * Ollama API Client
 * Direct communication with Ollama server for chat functionality
 */

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

/**
 * Check if Ollama server is accessible
 * @returns {Promise<boolean>}
 */
export async function checkOllamaConnection() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    console.error('Ollama connection check failed:', error);
    return false;
  }
}

/**
 * Get list of available Ollama models
 * @returns {Promise<Array<{name: string, size: number, modified_at: string}>>}
 */
export async function listModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    throw error;
  }
}

/**
 * Stream chat completion from Ollama
 * @param {string} model - Model name (e.g., "llama3.2", "qwen2.5")
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Function} onChunk - Callback for each content chunk
 * @param {Function} onError - Callback for errors
 * @param {Function} onDone - Callback when streaming completes
 * @param {Object} options - Additional options (temperature, etc.)
 * @returns {Promise<void>}
 */
export async function streamChat(model, messages, onChunk, onError, onDone, options = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (onDone) onDone();
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);

          // Extract content from message
          if (data.message?.content) {
            onChunk(data.message.content);
          }

          // Check if streaming is done
          if (data.done) {
            if (onDone) onDone();
            return;
          }
        } catch (parseError) {
          console.error('Failed to parse JSON line:', line, parseError);
        }
      }
    }
  } catch (error) {
    console.error('Streaming chat error:', error);
    if (onError) {
      onError(error);
    }
  }
}

/**
 * Generate a non-streaming chat response
 * @param {string} model - Model name
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Complete response content
 */
export async function generateChat(model, messages, options = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error('Generate chat error:', error);
    throw error;
  }
}

/**
 * Pull/download a model from Ollama
 * @param {string} modelName - Name of the model to pull
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<void>}
 */
export async function pullModel(modelName, onProgress) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (onProgress) {
            onProgress(data);
          }
        } catch (parseError) {
          console.error('Failed to parse progress:', parseError);
        }
      }
    }
  } catch (error) {
    console.error('Pull model error:', error);
    throw error;
  }
}

export default {
  checkOllamaConnection,
  listModels,
  streamChat,
  generateChat,
  pullModel
};
