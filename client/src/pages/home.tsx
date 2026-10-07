import React, { useState } from "react";
import { fetchAvailableModels, GenerateError, testModelConnection, useGenerateGamePlan } from "@/lib/api";
import { AI_PROVIDERS, isProviderId, type AvailableModel, type ProviderId } from "@/lib/ai-models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GamePlanView } from "@/components/game-plan-view";
import { LangSwitcher } from "@/components/lang-switcher";
import { LoadingScreen } from "@/components/loading-screen";
import { useToast } from "@/hooks/use-toast";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { downloadMarkdown, downloadPNG } from "@/lib/export";
import { Loader2, Sparkles, RefreshCw, FileDown, Image, Eye, EyeOff, Settings2, ChevronDown } from "lucide-react";

const STORAGE_PREFIX = "game-plan-generator";
const keyStorageName = (provider: ProviderId) => `${STORAGE_PREFIX}:api-key:${provider}`;
const modelStorageName = (provider: ProviderId) => `${STORAGE_PREFIX}:model:${provider}`;

function readSavedKey(provider: ProviderId): string {
  try {
    return window.localStorage.getItem(keyStorageName(provider)) ?? "";
  } catch {
    return "";
  }
}

function readSavedModel(provider: ProviderId): string {
  try {
    return window.localStorage.getItem(modelStorageName(provider)) ?? "";
  } catch {
    return "";
  }
}

const errorMessages: Record<string, TranslationKey> = {
  API_KEY_REJECTED: "apiKeyRejected",
  MODEL_UNAVAILABLE: "modelUnavailable",
  INVALID_REQUEST: "invalidModelId",
  RATE_LIMITED: "rateLimited",
  PROVIDER_UNAVAILABLE: "providerUnavailable",
  TIMEOUT: "providerTimeout",
  INVALID_RESPONSE: "invalidResponse",
  UPSTREAM_ERROR: "providerRejected",
};

function errorMessage(error: unknown): TranslationKey {
  const code = error instanceof GenerateError ? error.code : "";
  return errorMessages[code] ?? "toastErrorDesc";
}

type ConnectionStatus = {
  kind: "success" | "error";
  message: TranslationKey;
  detail?: TranslationKey;
};

export default function Home() {
  const [idea, setIdea] = useState("");
  const [providerId, setProviderId] = useState<ProviderId>(() => {
    try {
      const saved = window.localStorage.getItem(`${STORAGE_PREFIX}:provider`);
      return saved && isProviderId(saved) ? saved : "openai";
    } catch {
      return "openai";
    }
  });
  const [model, setModel] = useState(() => readSavedModel(providerId));
  const [modelMode, setModelMode] = useState<"listed" | "custom">("custom");
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [apiKey, setApiKey] = useState(() => readSavedKey(providerId));
  const [showKey, setShowKey] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const { toast } = useToast();
  const { t, lang } = useI18n();

  const generateMutation = useGenerateGamePlan();

  const saveProvider = (provider: ProviderId) => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}:provider`, provider);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };

  const saveModel = (provider: ProviderId, modelId: string) => {
    try {
      if (modelId) window.localStorage.setItem(modelStorageName(provider), modelId);
      else window.localStorage.removeItem(modelStorageName(provider));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };

  const changeProvider = (value: string) => {
    if (!isProviderId(value)) return;
    setProviderId(value);
    setModel(readSavedModel(value));
    setModelMode("custom");
    setAvailableModels([]);
    setApiKey(readSavedKey(value));
    setShowKey(false);
    setConnectionStatus(null);
    saveProvider(value);
  };

  const changeKey = (value: string) => {
    setApiKey(value);
    setAvailableModels([]);
    setModelMode("custom");
    setConnectionStatus(null);
    try {
      if (value) window.localStorage.setItem(keyStorageName(providerId), value);
      else window.localStorage.removeItem(keyStorageName(providerId));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };

  const changeModel = (value: string) => {
    setModel(value);
    setConnectionStatus(null);
    saveModel(providerId, value);
  };

  const handleTestConnection = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setIsTesting(true);
    setConnectionStatus(null);

    try {
      const result = await fetchAvailableModels(providerId, key);
      if (!Array.isArray(result.models) ||
          result.models.some((item) => typeof item?.id !== "string" || typeof item?.name !== "string")) {
        throw new GenerateError("INVALID_RESPONSE");
      }
      setAvailableModels(result.models);
      const selectedModel = model.trim() || result.models[0]?.id || "";
      if (!model.trim() && selectedModel) {
        setModel(selectedModel);
        saveModel(providerId, selectedModel);
      }
      setModelMode(result.models.some((item) => item.id === selectedModel) ? "listed" : "custom");

      if (!selectedModel) {
        setConnectionStatus({ kind: "success", message: "connectionNoModels" });
        return;
      }
      try {
        await testModelConnection(providerId, selectedModel, key);
        setConnectionStatus({ kind: "success", message: "connectionSuccess" });
      } catch (error) {
        setConnectionStatus({
          kind: "error", message: "connectionModelFailed", detail: errorMessage(error),
        });
      }
    } catch (error) {
      setConnectionStatus({ kind: "error", message: "connectionFailed", detail: errorMessage(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleGenerate = () => {
    if (!idea.trim()) {
      toast({
        title: t("toastRequiredTitle"),
        description: t("toastRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      setSettingsOpen(true);
      toast({
        title: t("toastRequiredTitle"),
        description: t("apiKeyRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!model.trim() || model.trim().length > 200 ||
        !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(model.trim())) {
      setSettingsOpen(true);
      toast({
        title: t("toastRequiredTitle"),
        description: t(model.trim() ? "invalidModelId" : "modelRequired"),
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate(
      { idea, language: lang, provider: providerId, model: model.trim(), apiKey: apiKey.trim() },
      {
        onError: (error) => {
          toast({
            title: t("toastErrorTitle"),
            description: t(errorMessage(error)),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleExportMd = () => {
    if (generateMutation.data) {
      downloadMarkdown(generateMutation.data, idea);
    }
  };

  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      const slug = (generateMutation.data?.designDoc.title || "game-plan")
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
        .slice(0, 40);
      await downloadPNG("game-plan-export", `${slug}.png`);
    } catch {
      toast({
        title: t("toastErrorTitle"),
        description: "PNG export failed.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPng(false);
    }
  };

  const isGenerating = generateMutation.isPending;
  const isBusy = isGenerating || isTesting;
  const gamePlan = generateMutation.data;

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans selection:bg-primary selection:text-white">
      {isGenerating && <LoadingScreen />}

      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <header className="space-y-4 text-center animate-fade-in-up relative">
          <div className="absolute right-0 top-0">
            <LangSwitcher />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-mono text-sm font-bold tracking-wider mb-4 border border-primary/20">
            {t("systemOnline")}
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            {t("subtitle")}
          </p>
        </header>

        {/* Input Section */}
        {!gamePlan && (
          <div className="bg-card border-2 border-border shadow-[8px_8px_0px_0px_hsl(var(--primary)/0.2)] rounded-xl p-6 md:p-8 space-y-6 animate-fade-in transition-all duration-300 hover:shadow-[12px_12px_0px_0px_hsl(var(--primary)/0.3)] hover:-translate-y-1">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                {t("inputLabel")}
              </label>
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={t("inputPlaceholder")}
                className="min-h-[160px] text-lg font-medium resize-none border-2 border-muted focus-visible:ring-primary focus-visible:border-primary p-4 rounded-lg bg-background"
                disabled={isGenerating}
              />
            </div>

            <section className="overflow-hidden rounded-lg border-2 border-muted">
              <button
                id="ai-settings-toggle"
                type="button"
                aria-expanded={settingsOpen}
                aria-controls="ai-settings-panel"
                disabled={isBusy}
                onClick={() => {
                  setSettingsOpen((open) => !open);
                  setShowKey(false);
                }}
                className="flex w-full items-center gap-3 bg-background p-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-50"
              >
                <Settings2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{t("aiSettings")}</span>
                  <span className="block break-all text-xs text-muted-foreground">
                    {AI_PROVIDERS.find((provider) => provider.id === providerId)?.name}
                    {" · "}{model.trim() || t("modelNotSelected")}
                    {(!apiKey.trim() || !model.trim()) && (
                      <span className="ml-2 text-primary">{t("settingsIncomplete")}</span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                  {t(settingsOpen ? "hideSettings" : "showSettings")}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                id="ai-settings-panel"
                role="region"
                aria-labelledby="ai-settings-toggle"
                hidden={!settingsOpen}
                className="space-y-6 border-t-2 border-muted p-4 md:p-6"
              >
            <div className="space-y-2">
              <label htmlFor="ai-provider" className="block text-sm font-bold text-foreground uppercase tracking-wide">
                {t("providerLabel")}
              </label>
              <select
                id="ai-provider"
                value={providerId}
                onChange={(event) => changeProvider(event.target.value)}
                disabled={isBusy}
                className="w-full h-12 rounded-lg border-2 border-muted bg-background px-3 text-foreground font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                {AI_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="api-key" className="block text-sm font-bold text-foreground uppercase tracking-wide">
                {AI_PROVIDERS.find((provider) => provider.id === providerId)?.name} {t("apiKeyLabel")}
              </label>
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => changeKey(event.target.value)}
                  placeholder={t("apiKeyPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isBusy}
                  className="min-w-0 flex-1 h-12 rounded-lg border-2 border-muted bg-background px-3 text-foreground font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? t("hideKey") : t("showKey")}
                  title={showKey ? t("hideKey") : t("showKey")}
                  className="h-12 w-12 shrink-0 rounded-lg border-2 border-muted bg-background hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showKey ? <EyeOff className="mx-auto h-5 w-5" /> : <Eye className="mx-auto h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => { changeKey(""); setShowKey(false); }}
                  disabled={!apiKey || isBusy}
                  className="h-12 shrink-0 rounded-lg border-2 border-muted bg-background px-3 text-sm font-bold hover:border-destructive disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("clearKey")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t("apiKeyNotice")}</p>
              {storageError && <p role="alert" className="text-xs text-destructive">{t("storageUnavailable")}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isBusy || !apiKey.trim()}
                  className="h-11 border-2 font-bold"
                >
                  {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t(isTesting ? "testingConnection" : "testConnection")}
                </Button>
                <p className="text-xs text-muted-foreground flex-1 min-w-[180px]">
                  {t("testConnectionNotice")}
                </p>
              </div>
              {connectionStatus && (
                <p
                  role={connectionStatus.kind === "error" ? "alert" : "status"}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    connectionStatus.kind === "error"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-primary/30 bg-primary/5 text-foreground"
                  }`}
                >
                  {t(connectionStatus.message)} {connectionStatus.detail && t(connectionStatus.detail)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {availableModels.length > 0 && (
                <>
                  <label htmlFor="ai-model-choice" className="block text-sm font-bold text-foreground uppercase tracking-wide">
                    {t("modelLabel")}
                  </label>
                  <select
                    id="ai-model-choice"
                    value={modelMode === "listed" ? model : "__custom__"}
                    onChange={(event) => {
                      if (event.target.value === "__custom__") {
                        setModelMode("custom");
                        changeModel("");
                      } else {
                        setModelMode("listed");
                        changeModel(event.target.value);
                      }
                    }}
                    disabled={isBusy}
                    className="w-full h-12 rounded-lg border-2 border-muted bg-background px-3 text-foreground font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  >
                    {availableModels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name === option.id ? option.id : `${option.name} · ${option.id}`}
                      </option>
                    ))}
                    <option value="__custom__">{t("customModelOption")}</option>
                  </select>
                </>
              )}
              {(modelMode === "custom" || availableModels.length === 0) && (
                <div className="space-y-2">
                  <label htmlFor="custom-model" className="block text-sm font-bold text-foreground uppercase tracking-wide">
                    {t("customModelLabel")}
                  </label>
                  <input
                    id="custom-model"
                    type="text"
                    value={model}
                    onChange={(event) => changeModel(event.target.value)}
                    placeholder={t("modelPlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isBusy}
                    className="w-full h-12 rounded-lg border-2 border-muted bg-background px-3 text-foreground font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t("modelListHint")}</p>
            </div>
              </div>
            </section>

            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isBusy || !idea.trim()}
              className="w-full text-lg font-bold uppercase tracking-wider h-14 bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-transparent shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  {t("generating")}
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 mr-2" />
                  {t("generateBtn")}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results Section */}
        {gamePlan && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-wrap justify-between items-center gap-3 bg-card p-4 rounded-lg border-2 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
              <div className="font-mono text-sm font-bold text-muted-foreground">
                {t("statusSuccess")}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMd}
                  className="font-bold border-2 gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  {t("exportMd")}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPng}
                  disabled={isExportingPng}
                  className="font-bold border-2 gap-2"
                >
                  {isExportingPng ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Image className="w-4 h-4" />
                  )}
                  {isExportingPng ? t("exporting") : t("exportPng")}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    generateMutation.reset();
                    setIdea("");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="font-bold border-2 gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("regenerate")}
                </Button>
              </div>
            </div>

            <GamePlanView plan={gamePlan} />
          </div>
        )}

      </div>
    </div>
  );
}
