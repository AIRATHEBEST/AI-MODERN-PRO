import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ImageIcon, Download, Sparkles, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"openai" | "stability">("openai");
  const [model, setModel] = useState("dall-e-3");
  const [size, setSize] = useState<"1024x1024" | "1792x1024" | "1024x1792">("1024x1024");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [style, setStyle] = useState<"vivid" | "natural">("vivid");
  const [result, setResult] = useState<{ imageUrl: string; revisedPrompt?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");

  const generateMutation = trpc.imageGen.generate.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Image generated!"); },
    onError: (e) => toast.error(e.message),
  });
  const historyQuery = trpc.imageGen.list.useQuery(undefined, { enabled: activeTab === "history" });

  const MODEL_OPTIONS: Record<string, string[]> = {
    openai: ["dall-e-3", "dall-e-2"],
    stability: ["stable-image-core", "sd3-medium", "sd3-large"],
    flux: ["flux-pro-1.1", "flux-pro", "flux-dev"],
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const [w, h] = size.split("x").map(Number); generateMutation.mutate({ prompt, provider, model, width: w, height: h });
  };

  const handleDownload = () => {
    if (!result?.imageUrl) return;
    if (result.imageUrl.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = result.imageUrl;
      a.download = "generated-image.webp";
      a.click();
    } else {
      window.open(result.imageUrl, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant={activeTab === "generate" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("generate")}>
          <Sparkles className="size-4 mr-2" /> Generate
        </Button>
        <Button variant={activeTab === "history" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("history")}>
          <History className="size-4 mr-2" /> History
        </Button>
      </div>

      {activeTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="size-5" /> Image Generation</CardTitle>
              <CardDescription>Generate images with DALL-E 3, Stable Diffusion, or Flux</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Prompt</Label>
                <textarea
                  className="w-full mt-1 p-3 text-sm border rounded-md resize-none bg-background"
                  rows={4}
                  placeholder="A futuristic city at sunset, cyberpunk aesthetic, ultra detailed..."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={(v) => { setProvider(v as any); setModel(MODEL_OPTIONS[v][0]); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">🔑 OpenAI DALL-E</SelectItem>
                      <SelectItem value="stability">🎨 Stability AI</SelectItem>
                      <SelectItem value="flux">⚡ Flux (BFL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(MODEL_OPTIONS[provider] || []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {provider === "openai" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Size</Label>
                    <Select value={size} onValueChange={(v) => setSize(v as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024x1024">Square</SelectItem>
                        <SelectItem value="1792x1024">Landscape</SelectItem>
                        <SelectItem value="1024x1792">Portrait</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quality</Label>
                    <Select value={quality} onValueChange={(v) => setQuality(v as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="hd">HD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Style</Label>
                    <Select value={style} onValueChange={(v) => setStyle(v as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vivid">Vivid</SelectItem>
                        <SelectItem value="natural">Natural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={!prompt.trim() || generateMutation.isPending} className="w-full">
                {generateMutation.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="size-4 mr-2" /> Generate Image</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {result ? (
                <div className="space-y-3">
                  <img src={result.imageUrl} alt={prompt} className="w-full rounded-lg border object-contain max-h-96" />
                  {result.revisedPrompt && (
                    <p className="text-xs text-muted-foreground italic">Revised: {result.revisedPrompt}</p>
                  )}
                  <Button onClick={handleDownload} variant="outline" className="w-full">
                    <Download className="size-4 mr-2" /> Download
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <ImageIcon className="size-16 opacity-10 mb-4" />
                  <p className="text-sm">Your generated image will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "history" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {historyQuery.isLoading && <div className="col-span-full flex justify-center py-12"><Loader2 className="size-6 animate-spin" /></div>}
          {historyQuery.data?.map((img: any) => (
            <Card key={img.id} className="overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                {img.imageUrl ? (
                  <img src={img.imageUrl} alt={img.prompt} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="size-8 opacity-20" />
                )}
              </div>
              <CardContent className="pt-3 pb-3">
                <p className="text-xs truncate" title={img.prompt}>{img.prompt}</p>
                <p className="text-xs text-muted-foreground mt-1">{img.provider} · {img.model}</p>
              </CardContent>
            </Card>
          ))}
          {historyQuery.data?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No images generated yet</div>
          )}
        </div>
      )}
    </div>
  );
}
