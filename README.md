# 🌌 Nexus Knowledge Compiler

A high-performance **build-time synthesis engine** designed to transform disjointed raw operational feeds, reports, and legacy documents into a unified, high-density structured-knowledge layer. By compiling unstructured resources into multi-layered semantic assets, Nexus solves critical failure modes in standard Retrieval-Augmented Generation (RAG) pipelines.

---

## 💡 The Core Philosophy: "Build-Time Compilation"

Traditional RAG approaches operate on a **"search-and-stuff"** paradigm, retrieving raw text chunks dynamically during query execution. While simple, this creates massive inefficiencies:
* **Token Exhaustion:** Flooding LLM contexts with redundant raw text from multi-page PDFs on every conversational turn.
* **Semantic Fragmentation:** Standard sliding-window vector segmentation breaks documents into local contexts, destroying long-range trends, comparative relationships, and global document narrative.

**The Nexus Way:** Treat raw documents like source code. Before a user queries the model, the **Nexus Knowledge Compiler** compiles the raw corpus into two distinct, high-density synthetic knowledge layers:
1. **The Wiki Layer (Markdown Node Graph):** Multi-file, cross-referenced semantic summaries of high-level topics, trends, and qualitative histories.
2. **The Artifacts Layer (Typed JSON Databank):** Ultra-dense, machine-readable, schema-valid data objects mapping structural metrics (e.g., multi-year financial progression sheets, tabular KPIs, category comparative charts).

---

## 🔎 Key Challenges Solved in Agentic RAG

The Nexus design addresses four fundamental bottlenecks that hinder state-of-the-art Agentic RAG architectures:

### 1. The Multi-Year / Global Trend Synthesis Blindspot
* **The Problem:** If a user asks, *"What is the 5-year trend for SaaS Subscription Revenue?"*, a vector search might fetch localized blocks from "Year 1" and "Year 3", but struggle to synthesize the trajectory or execute comparative arithmetic across all files simultaneously.
* **The Nexus Solution:** By parsing all inputs to extract a global, unified JSON artifact spanning all operational years, the LLM reasons with structured context arrays already aligned temporally.

### 2. High Context-Window Noise (Prompt Fatigue)
* **The Problem:** Standard vector search feeds messy OCR tables, redundant header/footer artifacts, and verbose phrasing into the prompt, reducing model reasoning accuracy and inflating inference costs.
* **The Nexus Solution:** Pre-compiled markdown files and JSON schemas contain strictly relevant knowledge, resulting in crystal-clear, focused context with minimal token overhead.

### 3. Untyped Structural Data Handling
* **The Problem:** RAG agents are bad at compiling tabular data on the fly, leading to alignment issues and numerical hallucinations.
* **The Nexus Solution:** By validating knowledge artifacts in standard JSON schemas, the neural layer can inspect, query, and cleanly output precise structural information without hallucinations.

### 4. Multimodal Context Merging
* **The Problem:** Most RAG interfaces keep local document queries and system files completely separate.
* **The Nexus Solution:** The compiled index features a **Multimodal Nexus Resolver** that merges pre-cached corporate wiki datasets with raw, on-the-fly local user attachments (base64 documents, images, schemas) for unified reasoning.

---

## 🛠️ System Architecture

### 1. Ingestion Pipeline
* **Source Tracking:** Real-time synchronization of imported PDFs, operational spreadsheets, and documentation.
* **Compiling Engine:** Parallelized synthesis utilizing Gemini models to build high-contrast Wiki narratives.
* **Artifact Extraction:** Schema-driven extraction that groups multi-year tables and aggregates operational metrics into highly visual structured JSON nodes.

### 2. The Neural Query Resolver
* **Active Selection Logic:** Toggle input context focus dynamically between Compiled Wiki Knowledge or Schema-Validated Artifacts to control target databanks.
* **Multimodal Channel:** Inject live-attached evidence inline alongside queries for hybrid context evaluation.
* **Double-Bypass Fallback:** Uses highly optimized, cached JSON indices as a primary context stream, falling back safely to raw source ingestion only when uncompiled queries are requested.
* **Persistent Sessions:** Full LocalStorage-cached caching of historical query nodes to preserve research across reloads.

---

## ⚙️ Technology Stack

* **Front-End:** React 18, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
* **Back-End Server:** Node.js, Express, TypeScript (`tsx` compilation bundle).
* **Intelligence Layer:** Google Gen AI SDK (`@google/genai`), supporting multimodal models.

---

## 🚀 Impact

Nexus Knowledge Compiler transforms standard search repositories from passive text-retrieval systems into active, high-utility intelligence centers. Users can skip reading hundreds of pages across multiple years and instead retrieve clear, validated, and structural tabular facts with extreme precision.
