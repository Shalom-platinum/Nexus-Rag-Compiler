import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import fs from "fs-extra";
import { fileURLToPath } from "url";
import { createRequire } from 'module';
import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { chunkText } from "./server/chunker.js";

const _require = createRequire(import.meta.url);
const pdf = _require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const WIKI_DIR = path.join(DATA_DIR, "wiki");
const ARTIFACT_DIR = path.join(DATA_DIR, "artifacts");
const ARTIFACTS_DIR = ARTIFACT_DIR;
const EMBEDDINGS_DIR = path.join(DATA_DIR, "embeddings");

const dirs = [RAW_DIR, WIKI_DIR, ARTIFACTS_DIR, EMBEDDINGS_DIR];
dirs.forEach(dir => fs.ensureDirSync(dir));

const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

interface ModelConfig {
  id: string;
  name: string;
  provider: 'gemini' | 'azure';
  modelName: string; 
  apiKey?: string;
  endpoint?: string;
  deploymentName?: string;
}

interface AppSettings {
  synthesisModelId: string; 
  queryModelId: string;
  embeddingModelId: string;
  models: ModelConfig[];
}

const DEFAULT_SETTINGS: AppSettings = {
  synthesisModelId: 'default-gemini',
  queryModelId: 'default-gemini',
  embeddingModelId: 'default-gemini',
  models: [
    {
      id: 'default-gemini',
      name: 'Default Gemini (Environment)',
      provider: 'gemini',
      modelName: 'gemini-3-flash-preview'
    }
  ]
};

// Add environment Azure if exists
if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
  DEFAULT_SETTINGS.models.push({
    id: 'env-azure',
    name: 'Azure OpenAI (Environment)',
    provider: 'azure',
    modelName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  });
}

function getSettings(): AppSettings {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      return fs.readJsonSync(SETTINGS_PATH);
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings) {
  fs.writeJsonSync(SETTINGS_PATH, settings, { spaces: 2 });
}

function getAIClient(modelConfig: ModelConfig) {
  if (modelConfig.provider === 'gemini') {
    return new GoogleGenAI({ 
      apiKey: modelConfig.apiKey || process.env.GEMINI_API_KEY || "",
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  } else {
    const endpoint = modelConfig.endpoint || process.env.AZURE_OPENAI_ENDPOINT || "";
    const deployment = modelConfig.deploymentName || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "";
    const apiKey = modelConfig.apiKey || process.env.AZURE_OPENAI_API_KEY || "";
    
    return new OpenAI({
      apiKey: apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': '2024-05-01-preview' },
      defaultHeaders: { 'api-key': apiKey },
    });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // --- Settings Endpoints ---
  app.get("/api/settings", (req, res) => {
    res.json(getSettings());
  });

  app.post("/api/settings", (req, res) => {
    saveSettings(req.body);
    res.json({ success: true });
  });

  // --- Embeddings Endpoints ---
  app.post("/api/embeddings/process", async (req, res) => {
    const { sourceName, content } = req.body;
    if (!sourceName || !content) return res.status(400).json({ error: "Missing sourceName or content" });

    try {
      console.log(`[Backend] Processing embeddings for: ${sourceName}`);
      const chunks = chunkText(content, sourceName, 1500, 150);
      
      const settings = getSettings();
      const modelConfig = settings.models.find(m => m.id === settings.embeddingModelId) || settings.models[0];
      const client = getAIClient(modelConfig);

      let embeddings: any[] = [];
      
      if (modelConfig.provider === 'azure') {
        console.log(`[Backend] Using Azure OpenAI for embeddings: ${modelConfig.deploymentName}`);
        const response = await (client as OpenAI).embeddings.create({
          model: modelConfig.deploymentName || "text-embedding-3-small",
          input: chunks.map(c => c.text.replace(/\n/g, ' ')),
        });
        embeddings = chunks.map((chunk, i) => ({
          ...chunk,
          embedding: response.data[i].embedding
        }));
      } else {
        console.log(`[Backend] Using Gemini for embeddings: ${modelConfig.modelName}`);
        const geminiClient = client as GoogleGenAI;
        embeddings = await Promise.all(chunks.map(async (chunk) => {
          const result = await geminiClient.models.embedContent({
            model: modelConfig.modelName || 'gemini-embedding-2-preview',
            contents: [{ parts: [{ text: chunk.text }] }],
          });
          return {
            ...chunk,
            embedding: result.embeddings[0].values
          };
        }));
      }

      const safeName = path.basename(sourceName).replace(/\.[^/.]+$/, "") + ".json";
      await fs.writeJson(path.join(EMBEDDINGS_DIR, safeName), embeddings, { spaces: 2 });
      
      res.json({ success: true, chunkCount: chunks.length, file: safeName });
    } catch (err: any) {
      console.error("[AI Server] Embedding Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/embeddings", async (req, res) => {
    try {
      const files = await fs.readdir(EMBEDDINGS_DIR);
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: "Failed to list embeddings" });
    }
  });

  app.get("/api/embeddings/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    try {
      const data = await fs.readJson(path.join(EMBEDDINGS_DIR, safeName));
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: "Embeddings not found" });
    }
  });

  // Multer setup for raw sources
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, RAW_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  // --- Gemini API Proxy Routes ---

  app.get("/api/ai/health", async (req, res) => {
    try {
      const settings = getSettings();
      const synthesisModel = settings.models.find(m => m.id === settings.synthesisModelId) || settings.models[0];
      const queryModel = settings.models.find(m => m.id === settings.queryModelId) || settings.models[0];
      const embeddingModel = settings.models.find(m => m.id === settings.embeddingModelId) || settings.models[0];
      
      res.json({ 
        status: "ok", 
        synthesis: { provider: synthesisModel.provider, model: synthesisModel.modelName },
        query: { provider: queryModel.provider, model: queryModel.modelName },
        embedding: { provider: embeddingModel.provider, model: embeddingModel.modelName }
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.post("/api/ai/synthesize-wiki", async (req, res) => {
    const { sourceContent, existingIndex, sourceName, existingTargetContent } = req.body;
    if (!sourceContent && !sourceName) return res.status(400).json({ error: "Missing source content or name" });

    try {
      const settings = getSettings();
      let contentToUse = sourceContent;

      if (sourceName) {
        const safeName = path.basename(sourceName).replace(/\.[^/.]+$/, "") + ".json";
        const embeddingPath = path.join(EMBEDDINGS_DIR, safeName);
        if (await fs.pathExists(embeddingPath)) {
          console.log(`[Backend] Using VECTORIZED embeddings for wiki synthesis: ${safeName}`);
          const chunks = await fs.readJson(embeddingPath);
          contentToUse = chunks.map((c: any) => c.text).join("\n\n---\n\n");
        } else {
          console.log(`[Backend] No cached embeddings found for: ${safeName}, using raw content.`);
        }
      }

      console.log(`[Backend] Calling synthesis (model: ${settings.synthesisModelId}) for: ${sourceName || 'inline-content'} (Update: ${!!existingTargetContent})`);

      const modelConfig = settings.models.find(m => m.id === settings.synthesisModelId) || settings.models[0];
      const client = getAIClient(modelConfig);
      let text = "";

      const prompt = `
        You are a Senior Knowledge Architect and Truth Discovery Engine at the Nexus. 
        Your task is to synthesize or EVOLVE a high-quality markdown wiki page from new source material.

        CORE BEHAVIORS:
        - EVOLUTIONARY UPDATING: If "PREVIOUS STATE" is provided, do NOT just throw it away. Interrogate it. What has changed? What remains true? What is debunked by the new data?
        - COUNTER-DATA ANALYSIS: Explicitly note any contradictions or "Conflicting Claims" between this new data and the previous synthesis or global context.
        - ENTITY STRENGTHENING: Refine definitions of entities (companies, people, dates) based on the most granular data found in the current source.
        - DYNAMIC LINKING: Ensure [[Internal Links]] are placed around ANY key concept that might exist in the Nexus.

        ${existingTargetContent ? `
        PREVIOUS STATE OF THIS WIKI PAGE:
        ${existingTargetContent}
        (Strategy: REVISE this page. Do not regenerate from scratch. Maintain useful history but prioritize new, granular truths.)
        ` : ""}

        SOURCE MATERIAL FOR THIS UPDATE:
        ${contentToUse}

        ${existingIndex ? `
        GLOBAL NEXUS CONTEXT (Existing Entities/Pages):
        ${existingIndex}
        (Action: Use these for cross-referencing and alignment.)
        ` : ""}

        OUTPUT FORMAT:
        - Pure Markdown.
        - Start with a # Title.
        - Include a "Nexus Revision History" section at the bottom.
        - Include "Contradiction Alerts" if new data differs from known global context.
      `;

      if (modelConfig.provider === 'azure') {
        const response = await (client as OpenAI).chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: modelConfig.modelName,
        });
        text = response.choices[0].message.content || "";
      } else {
        const parts: any[] = [{ text: prompt }];

        // Multimodal PDF support
        if (sourceName && sourceName.toLowerCase().endsWith(".pdf")) {
          const filePath = path.join(RAW_DIR, path.basename(sourceName));
          if (await fs.pathExists(filePath)) {
            console.log(`[Backend] Attaching PDF to Gemini request: ${sourceName}`);
            const data = await fs.readFile(filePath);
            parts.push({
              inlineData: {
                data: data.toString("base64"),
                mimeType: "application/pdf"
              }
            });
          }
        }

        const result = await (client as GoogleGenAI).models.generateContent({
          model: modelConfig.modelName,
          contents: [{ role: "user", parts }]
        });
        text = result.text;
      }
      res.json({ text });
    } catch (err: any) {
      console.error("[AI Server] Wiki Synthesis Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/compile-artifact", async (req, res) => {
    const { sourceContent, taskSpec, sourceName } = req.body;
    if (!sourceContent && !sourceName) return res.status(400).json({ error: "Missing content or source name" });

    try {
      const settings = getSettings();
      let contentToUse = sourceContent;

      if (sourceName) {
        const safeName = path.basename(sourceName).replace(/\.[^/.]+$/, "") + ".json";
        const embeddingPath = path.join(EMBEDDINGS_DIR, safeName);
        if (await fs.pathExists(embeddingPath)) {
          console.log(`[Backend] Using VECTORIZED embeddings for artifact compilation: ${safeName}`);
          const chunks = await fs.readJson(embeddingPath);
          contentToUse = chunks.map((c: any) => c.text).join("\n\n---\n\n");
        }
      }

      const prompt = `
        You are an Artifact Compiler. Your task is to produce a typed JSON artifact with provenance from raw financial records.
        
        TASK SPEC:
        ${taskSpec}

        RAW DATA:
        ${contentToUse}

        REQUIREMENTS:
        - Output valid JSON.
        - Include a "provenance" field for each major data point explaining where it came from in the source.
        - Focus on accuracy and speed.
        - Primary domain: Multi-year financial records.

        OUTPUT: Valid JSON artifact.
      `;

      const modelConfig = settings.models.find(m => m.id === settings.synthesisModelId) || settings.models[0];
      const client = getAIClient(modelConfig);
      let data: any = null;

      if (modelConfig.provider === 'azure') {
        const response = await (client as OpenAI).chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: modelConfig.modelName,
          response_format: { type: "json_object" }
        });
        data = JSON.parse(response.choices[0].message.content || "{}");
      } else {
        const parts: any[] = [{ text: prompt }];

        // Multimodal PDF support
        if (sourceName && sourceName.toLowerCase().endsWith(".pdf")) {
          const filePath = path.join(RAW_DIR, path.basename(sourceName));
          if (await fs.pathExists(filePath)) {
            console.log(`[Backend] Attaching PDF to Artifact Compiler: ${sourceName}`);
            const dataBuffer = await fs.readFile(filePath);
            parts.push({
              inlineData: {
                data: dataBuffer.toString("base64"),
                mimeType: "application/pdf"
              }
            });
          }
        }

        const result = await (client as GoogleGenAI).models.generateContent({
          model: modelConfig.modelName,
          contents: [{ role: "user", parts }],
          config: { responseMimeType: "application/json" }
        });
        data = JSON.parse(result.text || "{}");
      }
      
      res.json({ data });
    } catch (err: any) {
      console.error("[AI Server] Artifact Build Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/resolve-query", async (req, res) => {
    const { query, context, isFallback, attachments } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query" });

    try {
      const settings = getSettings();
      const modelConfig = settings.models.find(m => m.id === settings.queryModelId) || settings.models[0];
      console.log(`[Backend] Resolving multimodal query (model: ${modelConfig.id}) - Context length: ${context?.length}, Attachments: ${attachments?.length || 0}`);
      
      const prompt = `
        You are the Nexus Resolver. Answer the user's query using the provided context and any attached media.
        
        CONTEXT TYPE: ${isFallback ? "RAW SOURCES (FALLBACK)" : "COMPILED KNOWLEDGE (WIKI/ARTIFACT)"}
        
        CONTEXT DATABANK:
        ${context}

        QUERY/TASK:
        ${query}

        INSTRUCTIONS:
        - If using FALLBACK context, start your response with "[NOTICE: Fallback to raw sources used]".
        - Be concise and precise.
        - Cite sources from the context databank at the bottom of your response, separated by a horizontal rule (---).
        - If attachments (images/docs) are provided, treat them as high-priority primary evidence.
      `;

      const client = getAIClient(modelConfig);
      let text = "";
      if (modelConfig.provider === 'azure') {
        const response = await (client as OpenAI).chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: modelConfig.modelName,
        });
        text = response.choices[0].message.content || "";
      } else {
        const parts: any[] = [{ text: prompt }];

        if (attachments && Array.isArray(attachments)) {
          for (const att of attachments) {
            parts.push({
              inlineData: {
                data: att.data, // Base64
                mimeType: att.mimeType
              }
            });
          }
        }

        const result = await (client as GoogleGenAI).models.generateContent({
          model: modelConfig.modelName,
          contents: [{ role: "user", parts }]
        });
        text = result.text;
      }
      res.json({ text });
    } catch (err: any) {
      console.error("[AI Server] Query Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- API ROUTES ---

  // Get list of raw sources
  app.get("/api/sources", async (req, res) => {
    try {
      if (!fs.existsSync(RAW_DIR)) {
        await fs.ensureDir(RAW_DIR);
      }
      const files = await fs.readdir(RAW_DIR);
      const stats = await Promise.all(
        files.map(async f => {
          try {
            const s = await fs.stat(path.join(RAW_DIR, f));
            return { name: f, size: s.size, mtime: s.mtime.toISOString() };
          } catch (e) {
            return null;
          }
        })
      );
      res.json(stats.filter(Boolean));
    } catch (err) {
      console.error("[Backend] Failed to list sources:", err);
      res.status(500).json({ error: "Failed to list sources" });
    }
  });

  // Upload a source
  app.post("/api/sources/upload", (req, res, next) => {
    console.log("[Backend] Upload request started...");
    upload.array("files", 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error(`[Backend] Multer Error: ${err.message}`, err.code);
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        console.error(`[Backend] Unknown Upload Error: ${err.message}`);
        return res.status(500).json({ error: `Server upload error: ${err.message}` });
      }
      next();
    });
  }, (req, res) => {
    const files = (req as any).files;
    console.log(`[Backend] Upload received: ${files?.length || 0} files`);
    if (files && files.length > 0) {
      files.forEach((f: any) => console.log(` - Saved: ${f.filename}`));
    }
    res.json({ message: "Files uploaded successfully", files: files });
  });

  // Get content of a raw source
  app.get("/api/sources/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    const filePath = path.join(RAW_DIR, safeName);
    console.log(`[Backend] Reading source: ${safeName}`);
    
    try {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const extension = path.extname(safeName).toLowerCase();
      
      if (extension === ".pdf") {
        console.log(`[Backend] PDF Extraction: ${safeName}`);
        const dataBuffer = await fs.readFile(filePath);
        try {
          // Robust PDF parser resolution for mehmet-kozan/pdf-parse fork and original pdf-parse
          let data: any = null;
          
          if (pdf && typeof pdf.PDFParse === "function") {
            // This matches the mehmet-kozan/pdf-parse fork structure seen in CLI
            console.log("[Backend] Detected modern PDFParse class");
            const parser = new pdf.PDFParse({ data: dataBuffer });
            try {
              const result = await parser.getText();
              data = result;
            } finally {
              if (parser.destroy) await parser.destroy();
            }
          } else {
            // Original pdf-parse fallback
            let parsePdf: any = null;
            if (typeof pdf === "function") {
              parsePdf = pdf;
            } else if (pdf && typeof (pdf as any).default === "function") {
              parsePdf = (pdf as any).default;
            } else {
              const possible = [pdf, (pdf as any)?.default, (pdf as any)?.pdf];
              parsePdf = possible.find(p => typeof p === "function");
            }

            if (typeof parsePdf !== "function") {
              console.error(`[Backend] PDF parser failed to resolve. Raw type: ${typeof pdf}. Keys: ${Object.keys(pdf || {})}`);
              throw new Error("Invalid PDF parser configuration - no function found");
            }
            data = await parsePdf(dataBuffer);
          }

          return res.json({ content: data.text || "No text content found in PDF." });
        } catch (pdfErr: any) {
          console.error(`[Backend] PDF Extraction Error [${safeName}]:`, pdfErr);
          return res.status(500).json({ error: "Failed to parse PDF: " + pdfErr.message });
        }
      }
      
      const content = await fs.readFile(filePath, "utf-8");
      res.json({ content });
    } catch (err) {
      console.error(`[Backend] Error reading source [${safeName}]:`, err);
      res.status(500).json({ error: "Internal error reading file" });
    }
  });

  // Save compiled wiki page
  app.post("/api/wiki/save", async (req, res) => {
    const { filename, content } = req.body;
    if (!filename || !content) return res.status(400).json({ error: "Missing filename or content" });
    
    const safeName = path.basename(filename);
    console.log(`[Backend] Saving wiki: ${safeName}`);
    try {
      await fs.writeFile(path.join(WIKI_DIR, safeName), content);
      res.json({ success: true });
    } catch (err) {
      console.error(`[Backend] Failed to save wiki [${safeName}]:`, err);
      res.status(500).json({ error: "Failed to save wiki" });
    }
  });

  // Get wiki files
  app.get("/api/wiki", async (req, res) => {
    try {
      if (!fs.existsSync(WIKI_DIR)) await fs.ensureDir(WIKI_DIR);
      const files = await fs.readdir(WIKI_DIR);
      res.json(files);
    } catch (err) {
      console.error("[Backend] Failed to list wiki:", err);
      res.status(500).json({ error: "Failed to list wiki" });
    }
  });

  app.get("/api/wiki/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    try {
      const content = await fs.readFile(path.join(WIKI_DIR, safeName), "utf-8");
      res.json({ content });
    } catch (err) {
      res.status(404).json({ error: "Wiki page not found" });
    }
  });

  // Save artifact
  app.post("/api/artifacts/save", async (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data) return res.status(400).json({ error: "Missing filename or data" });
    
    const safeName = path.basename(filename);
    console.log(`[Backend] Saving artifact: ${safeName}`);
    try {
      await fs.writeJson(path.join(ARTIFACTS_DIR, safeName), data, { spaces: 2 });
      res.json({ success: true });
    } catch (err) {
      console.error(`[Backend] Failed to save artifact [${safeName}]:`, err);
      res.status(500).json({ error: "Failed to save artifact" });
    }
  });

  // Get artifacts
  app.get("/api/artifacts", async (req, res) => {
    try {
      if (!fs.existsSync(ARTIFACTS_DIR)) await fs.ensureDir(ARTIFACTS_DIR);
      const files = await fs.readdir(ARTIFACTS_DIR);
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: "Failed to list artifacts" });
    }
  });

  app.get("/api/artifacts/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    try {
      const data = await fs.readJson(path.join(ARTIFACTS_DIR, safeName));
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: "Artifact not found" });
    }
  });

  // Delete an artifact
  app.delete("/api/artifacts/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    console.log(`[Backend] Purging artifact: ${safeName}`);
    try {
      const target = path.join(ARTIFACTS_DIR, safeName);
      if (await fs.pathExists(target)) {
        await fs.remove(target);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Artifact not found" });
      }
    } catch (err) {
      console.error(`[Backend] Purge failed [${safeName}]:`, err);
      res.status(500).json({ error: "Failed to delete artifact" });
    }
  });

  // Delete a wiki page
  app.delete("/api/wiki/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    console.log(`[Backend] Purging wiki: ${safeName}`);
    try {
      const target = path.join(WIKI_DIR, safeName);
      if (await fs.pathExists(target)) {
        await fs.remove(target);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Wiki not found" });
      }
    } catch (err) {
      console.error(`[Backend] Purge failed [${safeName}]:`, err);
      res.status(500).json({ error: "Failed to delete wiki" });
    }
  });

  // Delete a raw source
  app.delete("/api/sources/:name", async (req, res) => {
    const safeName = path.basename(req.params.name);
    console.log(`[Backend] Purging source: ${safeName}`);
    try {
      const target = path.join(RAW_DIR, safeName);
      if (await fs.pathExists(target)) {
        await fs.remove(target);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Source not found" });
      }
    } catch (err) {
      console.error(`[Backend] Purge failed [${safeName}]:`, err);
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.log(`[Backend] Attempting to listen on 0.0.0.0:${PORT}`);
  // Clear all data (Master Reset)
  app.post("/api/system/reset", async (req, res) => {
    try {
      console.log("[Backend] Requesting full Nexus reset...");
      
      // We explicitly leave settings.json alone
      const targets = [RAW_DIR, WIKI_DIR, EMBEDDINGS_DIR, ARTIFACTS_DIR];
      
      for (const dir of targets) {
        if (await fs.pathExists(dir)) {
          const files = await fs.readdir(dir);
          for (const file of files) {
            await fs.remove(path.join(dir, file));
          }
        }
      }
      
      console.log("[Backend] Reset complete.");
      res.json({ message: "All Nexus data cleared successfully." });
    } catch (err: any) {
      console.error("[Backend] Reset failed:", err);
      res.status(500).json({ error: "Failed to reset system data." });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexus Server running on http://localhost:${PORT}`);
  }).timeout = 600000; // 10 minute timeout for long AI tasks
}

startServer().catch(err => {
  console.error("[Backend] CRITICAL STARTUP ERROR:", err);
});
