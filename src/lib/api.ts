export const api = {
  async safeFetch(url: string, options?: RequestInit) {
    const fetchOptions: RequestInit = {
      ...options,
      credentials: 'include',
    };

    try {
      const res = await fetch(url, fetchOptions);
      const contentType = res.headers.get("content-type");
      
      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
          const err = await res.json();
          throw new Error(err.error || `Request failed with status ${res.status}`);
        } else {
          const text = await res.text();
          if (text.includes("Cookie check") || text.includes("Action required to load your app")) {
            throw new Error("AUTH_REQUIRED");
          }
          throw new Error(`Server error: ${res.status}`);
        }
      }

      if (contentType && contentType.includes("application/json")) {
        return res.json();
      } else {
        const text = await res.text();
        if (text.includes("Cookie check") || text.includes("<html")) {
           throw new Error("AUTH_REQUIRED");
        }
        return text;
      }
    } catch (err: any) {
      if (err.message === "AUTH_REQUIRED") throw err;
      if (err.message.includes("Failed to fetch")) throw new Error("CONNECTION_LOST");
      throw err;
    }
  },

  async checkSession() {
    try {
      await this.getSources();
      return true;
    } catch (e) {
      return false;
    }
  },

  async getSources() {
    return this.safeFetch("/api/sources");
  },

  async uploadSources(files: FileList, onProgress?: (current: number, total: number) => void) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
        if (onProgress) onProgress(i + 1, files.length);
        const formData = new FormData();
        formData.append("files", files[i]);
        
        try {
          console.log(`[API] Uploading file ${i+1}/${files.length}: ${files[i].name}...`);
          const res = await this.safeFetch("/api/sources/upload", {
            method: "POST",
            body: formData
          });
          results.push(res);
        } catch (err: any) {
          console.error(`[API] Failed to upload ${files[i].name}:`, err.message);
          errors.push({ name: files[i].name, error: err.message });
          if (err.message === "AUTH_REQUIRED") throw err; // Stop if it's a global auth issue
        }
    }
    return { results, errors };
  },

  async getSourceContent(name: string) {
    return this.safeFetch(`/api/sources/${encodeURIComponent(name)}`);
  },

  async saveWiki(filename: string, content: string) {
    return this.safeFetch("/api/wiki/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content })
    });
  },

  async getWikiPages() {
    return this.safeFetch("/api/wiki");
  },

  async getWikiContent(name: string) {
    return this.safeFetch(`/api/wiki/${encodeURIComponent(name)}`);
  },

  async saveArtifact(filename: string, data: any) {
    return this.safeFetch("/api/artifacts/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, data })
    });
  },

  async getArtifacts() {
    return this.safeFetch("/api/artifacts");
  },

  async getArtifactContent(name: string) {
    return this.safeFetch(`/api/artifacts/${encodeURIComponent(name)}`);
  },

  async deleteArtifact(name: string) {
    return this.safeFetch(`/api/artifacts/${encodeURIComponent(name)}`, { method: "DELETE" });
  },

  async deleteWiki(name: string) {
    return this.safeFetch(`/api/wiki/${encodeURIComponent(name)}`, { method: "DELETE" });
  },

  async deleteSource(name: string) {
    return this.safeFetch(`/api/sources/${encodeURIComponent(name)}`, { method: "DELETE" });
  },

  async processEmbeddings(sourceName: string, content: string) {
    return this.safeFetch("/api/embeddings/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceName, content })
    });
  },

  async getEmbeddings() {
    return this.safeFetch("/api/embeddings");
  },

  async resetSystem() {
    return this.safeFetch("/api/system/reset", { method: "POST" });
  }
};
