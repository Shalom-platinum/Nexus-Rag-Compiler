import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Save, Cpu, Globe, Sparkles } from 'lucide-react';
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

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  const saveSettings = async (newSettings: AppSettings) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    setSettings(newSettings);
  };

  const addAzureModel = () => {
    if (!settings) return;
    const newModel: ModelConfig = {
      id: `azure-${Date.now()}`,
      name: 'New Azure Model',
      provider: 'azure',
      modelName: '',
      endpoint: '',
      apiKey: '',
      deploymentName: ''
    };
    saveSettings({
      ...settings,
      models: [...settings.models, newModel]
    });
  };

  const removeModel = (id: string) => {
    if (!settings) return;
    if (settings.synthesisModelId === id || settings.queryModelId === id || settings.embeddingModelId === id) {
      alert("Cannot remove a model that is currently selected (Synthesis, Query, or Embedding).");
      return;
    }
    saveSettings({
      ...settings,
      models: settings.models.filter(m => m.id !== id)
    });
  };

  const updateModel = (id: string, updates: Partial<ModelConfig>) => {
    if (!settings) return;
    const newModels = settings.models.map(m => m.id === id ? { ...m, ...updates } : m);
    saveSettings({ ...settings, models: newModels });
  };

  if (loading || !settings) return <div className="p-4">Loading settings...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-6 mb-8">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">AI Orchestration</h2>
            <p className="text-sm text-slate-500">Configure model routing for synthesis, querying, and embeddings.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Cpu className="w-4 h-4 text-purple-600" /> Synthesis Model
            </label>
            <select 
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-slate-50"
              value={settings.synthesisModelId}
              onChange={(e) => saveSettings({ ...settings, synthesisModelId: e.target.value })}
            >
              {settings.models.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Globe className="w-4 h-4 text-cyan-600" /> Query Model
            </label>
            <select 
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-slate-50"
              value={settings.queryModelId}
              onChange={(e) => saveSettings({ ...settings, queryModelId: e.target.value })}
            >
              {settings.models.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sparkles className="w-4 h-4 text-red-600" /> Embedding Model
            </label>
            <select 
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-slate-50"
              value={settings.embeddingModelId}
              onChange={(e) => saveSettings({ ...settings, embeddingModelId: e.target.value })}
            >
              {settings.models.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Model Registry</h3>
          <button 
            onClick={addAzureModel}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-sm font-medium shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Azure Provider
          </button>
        </div>

        <div className="space-y-6">
          {settings.models.map((model) => (
            <div key={model.id} className="group p-6 border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-lg hover:border-blue-100 transition-all space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${model.provider === 'azure' ? 'bg-cyan-50 text-cyan-700' : 'bg-purple-50 text-purple-700'}`}>
                    {model.provider === 'azure' ? <Globe className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                  </div>
                  <input 
                    className="bg-transparent font-bold text-lg text-slate-900 border-b-2 border-transparent hover:border-slate-200 focus:border-blue-500 outline-none transition-all px-1"
                    value={model.name}
                    onChange={(e) => updateModel(model.id, { name: e.target.value })}
                  />
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {model.provider}
                  </span>
                </div>
                {model.id !== 'default-gemini' && model.id !== 'env-azure' && (
                  <button onClick={() => removeModel(model.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {model.provider === 'azure' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-400 ml-1">Deployment Name</label>
                    <input 
                      className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                      placeholder="e.g. text-embedding-3-small"
                      value={model.deploymentName}
                      onChange={(e) => updateModel(model.id, { deploymentName: e.target.value, modelName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-400 ml-1">API Key</label>
                    <input 
                      type="password"
                      className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                      placeholder="••••••••••••••••"
                      value={model.apiKey}
                      onChange={(e) => updateModel(model.id, { apiKey: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-400 ml-1">Endpoint URL</label>
                    <input 
                      className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                      placeholder="https://resource.openai.azure.com"
                      value={model.endpoint}
                      onChange={(e) => updateModel(model.id, { endpoint: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {model.provider === 'gemini' && model.id !== 'default-gemini' && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-400 ml-1">API Key Override</label>
                  <input 
                    type="password"
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                    placeholder="••••••••••••••••"
                    value={model.apiKey}
                    onChange={(e) => updateModel(model.id, { apiKey: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
