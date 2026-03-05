import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Eye, EyeOff, Check } from "lucide-react";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "🔑", requiresKey: true, placeholder: "sk-..." },
  { id: "claude", name: "Anthropic Claude", icon: "🧠", requiresKey: true, placeholder: "sk-ant-..." },
  { id: "gemini", name: "Google Gemini", icon: "✨", requiresKey: true, placeholder: "AIza..." },
  { id: "groq", name: "Groq (Ultra-fast)", icon: "⚡", requiresKey: true, placeholder: "gsk_..." },
  { id: "mistral", name: "Mistral AI", icon: "🌟", requiresKey: true, placeholder: "..." },
  { id: "cohere", name: "Cohere", icon: "🔷", requiresKey: true, placeholder: "..." },
  { id: "deepseek", name: "Deepseek", icon: "🔍", requiresKey: true, placeholder: "sk-..." },
  { id: "openrouter", name: "OpenRouter", icon: "🌐", requiresKey: true, placeholder: "sk-or-..." },
  { id: "ollama", name: "Ollama (Local)", icon: "🦙", requiresKey: false, placeholder: "No key needed — set Base URL" },
  { id: "huggingface", name: "Hugging Face", icon: "🤗", requiresKey: true, placeholder: "hf_..." },
  { id: "grok", name: "Grok (xAI)", icon: "🤖", requiresKey: true, placeholder: "xai-..." },
  { id: "puter", name: "Puter (Free Claude)", icon: "☁️", requiresKey: false, placeholder: "No key needed — completely free" },
];

export function SettingsPanel() {
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [keyName, setKeyName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const apiKeysQuery = trpc.apiKeys.list.useQuery();
  const preferencesQuery = trpc.preferences.get.useQuery();
  const upsertKeyMutation = trpc.apiKeys.upsert.useMutation();
  const deleteKeyMutation = trpc.apiKeys.delete.useMutation();
  const testKeyMutation = trpc.apiKeys.test.useMutation();
  const updatePrefsMutation = trpc.preferences.update.useMutation();

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const provider = PROVIDERS.find(p => p.id === selectedProvider);
    if (!keyName || (provider?.requiresKey && !apiKey)) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await upsertKeyMutation.mutateAsync({
        provider: selectedProvider,
        keyName,
        key: apiKey || "no-key-needed",
        baseUrl: baseUrl || undefined,
      });
      toast.success("Configuration saved successfully");
      setShowNewKeyDialog(false);
      setKeyName("");
      setApiKey("");
      setBaseUrl("");
      apiKeysQuery.refetch();
    } catch (error) {
      toast.error("Failed to save configuration");
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    try {
      await deleteKeyMutation.mutateAsync({ id });
      toast.success("API key deleted");
      apiKeysQuery.refetch();
    } catch (error) {
      toast.error("Failed to delete API key");
    }
  };

  const handleTestKey = async (id: number) => {
    setTestingId(id);
    try {
      const key = apiKeysQuery.data?.find(k => k.id === id);
      if (key?.provider === "puter" || key?.provider === "ollama") {
        toast.success("Provider configured successfully");
        apiKeysQuery.refetch();
        setTestingId(null);
        return;
      }
      const result = await testKeyMutation.mutateAsync({ id });
      if (result.success) {
        toast.success("API key is valid");
      } else {
        toast.error("API key test failed");
      }
    } catch (error) {
      toast.error("Failed to test API key");
    } finally {
      setTestingId(null);
    }
  };

  const handleUpdatePrefs = async (updates: Record<string, unknown>) => {
    try {
      await updatePrefsMutation.mutateAsync(updates);
      toast.success("Preferences updated");
      preferencesQuery.refetch();
    } catch (error) {
      toast.error("Failed to update preferences");
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Manage API Keys</h3>
            <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-2" />
                  Add Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add API Key</DialogTitle>
                  <DialogDescription>
                    Add a new API key for a provider
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddKey} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.icon} {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., My OpenAI Key"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      required
                    />
                  </div>
                  {PROVIDERS.find(p => p.id === selectedProvider)?.requiresKey && (
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        placeholder="Paste your API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  {(selectedProvider === "ollama" || selectedProvider === "puter") && (
                    <div className="space-y-2">
                      <Label htmlFor="base-url">Base URL {selectedProvider === "puter" ? "(Optional)" : ""}</Label>
                      <Input
                        id="base-url"
                        placeholder={selectedProvider === "ollama" ? "http://localhost:11434" : "https://api.puter.com"}
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="show-key"
                      checked={showKey}
                      onChange={(e) => setShowKey(e.target.checked)}
                    />
                    <Label htmlFor="show-key" className="cursor-pointer">
                      Show key
                    </Label>
                  </div>
                  <Button type="submit" className="w-full">
                    Add Key
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {apiKeysQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : apiKeysQuery.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No API keys configured yet
              </p>
            ) : (
              apiKeysQuery.data?.map((key) => (
                <Card key={key.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{key.keyName}</p>
                        <p className="text-sm text-muted-foreground">
                          {PROVIDERS.find((p) => p.id === key.provider)?.name}
                        </p>
                        {key.testStatus && (
                          <div className="flex items-center gap-1 mt-1 text-xs">
                            {key.testStatus === "ok" ? (
                              <>
                                <Check className="size-3 text-green-500" />
                                <span className="text-green-600">Valid</span>
                              </>
                            ) : (
                              <span className="text-red-600">Test failed</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestKey(key.id)}
                          disabled={testingId === key.id}
                        >
                          {testingId === key.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "Test"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <div className="space-y-6">
            {preferencesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="default-provider">Default Provider</Label>
                  <Select
                    value={preferencesQuery.data?.defaultProvider || "built-in"}
                    onValueChange={(value) =>
                      handleUpdatePrefs({ defaultProvider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="built-in">Built-in (Manus)</SelectItem>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.icon} {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={preferencesQuery.data?.theme || "system"}
                    onValueChange={(value) =>
                      handleUpdatePrefs({
                        theme: value as "light" | "dark" | "system",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea
                    id="system-prompt"
                    placeholder="Enter a custom system prompt..."
                    value={preferencesQuery.data?.systemPrompt || ""}
                    onChange={(e) =>
                      handleUpdatePrefs({ systemPrompt: e.target.value })
                    }
                    rows={4}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="streaming">Enable Streaming</Label>
                    <Switch
                      id="streaming"
                      checked={preferencesQuery.data?.streamingEnabled ?? true}
                      onCheckedChange={(checked) =>
                        handleUpdatePrefs({ streamingEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="cache">Enable Response Caching</Label>
                    <Switch
                      id="cache"
                      checked={preferencesQuery.data?.cacheEnabled ?? true}
                      onCheckedChange={(checked) =>
                        handleUpdatePrefs({ cacheEnabled: checked })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
