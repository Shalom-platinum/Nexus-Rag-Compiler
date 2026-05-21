export const gemini = {
  async safeAISynthesis(url: string, bodyData: any, retries = 2) {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData),
            credentials: 'include' // Vital for AI Studio iframe
          });
          
          const contentType = res.headers.get("content-type");
          if (!res.ok) {
            if (contentType && contentType.includes("application/json")) {
              const err = await res.json();
              throw new Error(err.error || "AI Synthesis failed");
            } else {
              const text = await res.text();
              if (text.includes("Cookie check") || text.includes("Action required to load your app")) {
                throw new Error("AUTH_REQUIRED: Security block. Please refresh or open in a new tab.");
              }
              console.error(`[AI] Non-JSON error from ${url}:`, text.slice(0, 200));
              throw new Error(`AI Engine error: ${res.status}`);
            }
          }

          if (contentType && contentType.includes("application/json")) {
            return res.json();
          } else {
            const text = await res.text();
            if (text.includes("<doctype html") || text.includes("<html") || text.includes("Cookie check")) {
               throw new Error("AUTH_REQUIRED: session interrupted. Please open in a new tab.");
            }
            throw new Error("AI Engine returned unexpected response format");
          }
        } catch (err: any) {
          lastErr = err;
          if (err.message.includes("Failed to fetch") || err.message.includes("timeout") || err.message.includes("504") || err.message.includes("AUTH_REQUIRED")) {
            // If it's auth required, retrying might not help unless user acts, but we retry once just in case it was a fluke
            if (err.message.includes("AUTH_REQUIRED") && i > 0) throw err; 
            console.warn(`[AI] Retrying synthesis (${i+1}/${retries})...`);
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            continue;
          }
          throw err;
        }
    }
    throw lastErr;
  },

  // Mode 1: Wiki Synthesis
  async synthesizeWikiPage(sourceContent: string, existingIndex?: string, sourceName?: string, existingTargetContent?: string) {
    if (!sourceContent && !sourceName) {
      throw new Error("Invalid source content or name provided for synthesis.");
    }
    const data = await this.safeAISynthesis("/api/ai/synthesize-wiki", { 
      sourceContent, 
      existingIndex, 
      sourceName,
      existingTargetContent
    });
    return data.text;
  },

  // Mode 2: Artifact Synthesis
  async compileArtifact(sourceContent: string, taskSpec: string, sourceName?: string) {
    if (!sourceContent && !sourceName) {
      throw new Error("Invalid source content or name provided.");
    }
    const data = await this.safeAISynthesis("/api/ai/compile-artifact", { 
      sourceContent, 
      taskSpec, 
      sourceName 
    });
    return data.data;
  },

  // Query Resolver
  async resolveQuery(query: string, context: string, isFallback: boolean, attachments?: {data: string, mimeType: string}[]) {
    if (!query) throw new Error("Query is required");
    const data = await this.safeAISynthesis("/api/ai/resolve-query", { 
      query, 
      context, 
      isFallback,
      attachments
    });
    return data.text;
  }
};
