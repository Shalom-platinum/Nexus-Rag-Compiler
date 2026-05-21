
/**
 * Simple text chunker for RAG applications.
 */
export interface Chunk {
  text: string;
  metadata: {
    source: string;
    index: number;
    start: number;
    end: number;
  };
}

export function chunkText(text: string, source: string, chunkSize: number = 2000, overlap: number = 200): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.substring(start, end);
    
    chunks.push({
      text: chunkText,
      metadata: {
        source,
        index: chunks.length,
        start,
        end
      }
    });

    if (end === text.length) break;
    start = end - overlap;
    
    // Ensure we don't get stuck in an infinite loop if overlap >= chunkSize
    if (start >= end) start = end;
  }

  return chunks;
}
