# Local Model Setup Guide (Hermes & Others)

This guide helps you set up local AI models like **Hermes**, **LLaMA**, **Mistral**, and others with your WhatsApp assistant.

## Why Use Local Models?

✅ **Zero API Costs** - No OpenAI/Anthropic fees
✅ **Complete Privacy** - All data stays on your machine
✅ **No Rate Limits** - Use as much as you need
✅ **Offline Capable** - Works without internet
✅ **Full Control** - Choose and customize any model

## Recommended: Ollama (Easiest)

### 1️⃣ Install Ollama

**Windows:**
Download from: https://ollama.com/download/windows

**Linux/macOS:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2️⃣ Pull Hermes Model

```bash
# Hermes 3 (8B) - Excellent for chat & function calling
ollama pull hermes3:latest

# Or other variants:
ollama pull hermes3:8b-llama3.1-q8_0   # High quality
ollama pull hermes3:8b-llama3.1-q4_K_M  # Faster, less memory

# Other great models:
ollama pull llama3.2:latest            # Meta's LLaMA 3.2
ollama pull mistral:latest             # Mistral 7B
ollama pull phi3:latest                # Microsoft Phi-3 (small, fast)
ollama pull qwen2.5:latest             # Alibaba Qwen 2.5
```

### 3️⃣ Start Ollama Server

```bash
ollama serve
```

### 4️⃣ Configure Your Assistant

Edit `.env`:
```env
# Use local model as default
DEFAULT_AI_PROVIDER=local

# Ollama configuration
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434
LOCAL_MODEL_NAME=hermes3:latest
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_MAX_TOKENS=2000
```

### 5️⃣ Start Your Assistant

```bash
npm run dev
```

That's it! Your assistant now runs 100% locally with **zero API costs**! 🎉

## Alternative: LM Studio (GUI Option)

### 1️⃣ Install LM Studio

Download from: https://lmstudio.ai/

### 2️⃣ Download a Model

In LM Studio:
1. Click **Search** tab
2. Search for "Hermes" or "LLaMA"
3. Download: `NousResearch/Hermes-3-Llama-3.1-8B-GGUF`
4. Or: `meta-llama/Llama-3.2-3B-Instruct-GGUF`

### 3️⃣ Start Local Server

1. Click **Local Server** tab
2. Select your model
3. Click **Start Server**
4. Note the port (usually 1234)

### 4️⃣ Configure Your Assistant

Edit `.env`:
```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:1234
LOCAL_MODEL_NAME=hermes-3-llama-3.1-8b
```

## Alternative: vLLM (For Advanced Users)

### 1️⃣ Install vLLM

```bash
pip install vllm
```

### 2️⃣ Start vLLM Server

```bash
python -m vllm.entrypoints.openai.api_server \
  --model NousResearch/Hermes-3-Llama-3.1-8B \
  --port 8000
```

### 3️⃣ Configure Your Assistant

```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:8000
LOCAL_MODEL_NAME=NousResearch/Hermes-3-Llama-3.1-8B
```

## Model Recommendations

### For Chat & Customer Service
- **Hermes 3** (8B) - Best overall, excellent instruction following
- **LLaMA 3.2** (3B) - Fast, good for simple queries
- **Mistral** (7B) - Good balance of speed and quality

### For Low Memory (< 8GB RAM)
- **Phi-3** (3.8B) - Microsoft's efficient model
- **LLaMA 3.2** (3B) - Compact and fast
- **TinyLlama** (1.1B) - Minimal resources

### For High Quality (16GB+ RAM)
- **Hermes 3** (8B Q8_0) - Highest quality Hermes
- **LLaMA 3.1** (8B) - Meta's latest
- **Qwen 2.5** (7B) - Excellent multilingual

## Testing Your Setup

### 1. Check if Ollama is running
```bash
curl http://localhost:11434/api/tags
```

### 2. Test generation
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "hermes3",
  "prompt": "Say hello!"
}'
```

### 3. Check available models
```bash
ollama list
```

## Performance Tips

### Speed Up Responses

1. **Use quantized models** (Q4, Q5 variants are faster)
   ```bash
   ollama pull hermes3:8b-llama3.1-q4_K_M
   ```

2. **Reduce max tokens** in `.env`
   ```env
   LOCAL_MODEL_MAX_TOKENS=1000
   ```

3. **Lower temperature** for more focused responses
   ```env
   LOCAL_MODEL_TEMPERATURE=0.5
   ```

### Reduce Memory Usage

1. **Use smaller models**
   ```bash
   ollama pull phi3:latest  # Only 3.8B parameters
   ```

2. **Enable GPU if available**
   - Ollama auto-detects NVIDIA GPUs
   - 10-50x faster with GPU

## Switching Between Models

You can easily switch models:

```bash
# In .env, change:
LOCAL_MODEL_NAME=hermes3:latest

# To any other model:
LOCAL_MODEL_NAME=llama3.2:latest
LOCAL_MODEL_NAME=mistral:latest
LOCAL_MODEL_NAME=phi3:latest
```

## Hybrid Mode (Best of Both Worlds)

Use local for most queries, fall back to cloud for complex tasks:

```env
# Set to auto for intelligent routing
DEFAULT_AI_PROVIDER=auto

# Enable both
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-your-key-here
```

The system will:
- Try local model first (free!)
- Fall back to OpenAI if local fails
- Save you money while maintaining reliability

## Common Issues

### "Cannot connect to Ollama"
```bash
# Make sure Ollama is running
ollama serve

# Or restart it
pkill ollama
ollama serve
```

### Model not found
```bash
# List installed models
ollama list

# Pull the model
ollama pull hermes3:latest
```

### Slow responses
- Use a quantized model (Q4 or Q5)
- Reduce max_tokens
- Enable GPU acceleration
- Use a smaller model (Phi-3, TinyLlama)

### Out of memory
- Close other applications
- Use a smaller model
- Reduce max_tokens
- Try quantized versions (Q4_K_M)

## Model Size Guide

| Model | Size | RAM Needed | Quality | Speed |
|-------|------|------------|---------|-------|
| TinyLlama 1B | 0.6 GB | 2 GB | ⭐⭐ | ⚡⚡⚡ |
| Phi-3 3.8B | 2.3 GB | 4 GB | ⭐⭐⭐ | ⚡⚡⚡ |
| LLaMA 3.2 3B | 2 GB | 4 GB | ⭐⭐⭐ | ⚡⚡⚡ |
| Mistral 7B | 4.1 GB | 8 GB | ⭐⭐⭐⭐ | ⚡⚡ |
| Hermes 3 8B | 4.7 GB | 8 GB | ⭐⭐⭐⭐⭐ | ⚡⚡ |
| LLaMA 3.1 8B | 4.7 GB | 8 GB | ⭐⭐⭐⭐ | ⚡⚡ |

## Embeddings (For Knowledge Base)

For semantic search, also install an embeddings model:

```bash
# Best for embeddings
ollama pull nomic-embed-text

# Or alternatives
ollama pull mxbai-embed-large
ollama pull all-minilm
```

## Monitoring Performance

Check model stats in your assistant:

```bash
curl http://localhost:3000/api/stats
```

You'll see:
- Response times
- Token usage
- Model being used
- Cost (always $0 for local!)

## Need Help?

- **Ollama Docs**: https://ollama.com/
- **Model Library**: https://ollama.com/library
- **LM Studio**: https://lmstudio.ai/
- **Hermes Models**: https://huggingface.co/NousResearch

---

**Congratulations!** You're now running a powerful AI assistant completely locally with **zero API costs**! 🎉

Your privacy is protected, and you have unlimited usage. Perfect for businesses that need full control over their data.
