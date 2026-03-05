import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Download, Wand2, AlertCircle } from "lucide-react";

const OPENAI_MODELS = ["dall-e-3", "dall-e-2"];
const SIZES = ["512x512", "1024x1024", "1024x1792", "1792x1024"];

export function ImageGenPanel() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"openai" | "stability">("openai");
  const [model, setModel] = useState("dall-e-3");
  const [size, setSize] = useState("1024x1024");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const genMut = trpc.imageGen.generate.useMutation({
    onSuccess: (r) => { setGeneratedUrl(r.imageUrl); toast.success("Image generated!"); listQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const listQuery = trpc.imageGen.list.useQuery();

  const [w, h] = size.split("x").map(Number);

  const handleGenerate = () => {
    if (!prompt.trim()) { toast.error("Please enter a prompt"); return; }
    setGeneratedUrl(null);
    genMut.mutate({ prompt, provider, model, width: w, height: h });
  };

  const handleDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = `ai-image-${Date.now()}.png`; a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><ImageIcon className="size-5" /> Image Generation</h2>
        <p className="text-sm text-muted-foreground">Generate images with DALL-E 3 or Stability AI</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Provider</Label>
          <Select value={provider} onValueChange={(v: any) => { setProvider(v); setModel(v === "openai" ? "dall-e-3" : "stable-diffusion-xl"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">🔑 OpenAI DALL-E</SelectItem>
              <SelectItem value="stability">🎨 Stability AI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Size</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Prompt</Label>
        <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A photorealistic image of..." rows={4} className="mt-1" />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={genMut.isPending || !prompt.trim()} className="gap-2">
          {genMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {genMut.isPending ? "Generating…" : "Generate Image"}
        </Button>
      </div>

      {/* Current result */}
      {genMut.isPending && (
        <div className="flex flex-col items-center justify-center h-48 rounded-lg border-2 border-dashed gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Generating your image…</p>
        </div>
      )}
      {generatedUrl && !genMut.isPending && (
        <div className="space-y-2">
          <div className="rounded-lg overflow-hidden border">
            <img src={generatedUrl} alt="Generated" className="w-full object-contain max-h-96" />
          </div>
          <Button variant="outline" size="sm" onClick={() => handleDownload(generatedUrl)} className="gap-2">
            <Download className="size-4" /> Download
          </Button>
        </div>
      )}

      {/* History */}
      {(listQuery.data?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-medium mb-3">Recent Generations</h3>
          <ScrollArea className="h-64">
            <div className="grid grid-cols-2 gap-3 pr-2">
              {listQuery.data?.slice(0, 12).map(img => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border aspect-square cursor-pointer" onClick={() => setGeneratedUrl(img.imageUrl)}>
                  <img src={img.imageUrl} alt={img.prompt} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <p className="text-white text-xs text-center line-clamp-3">{img.prompt}</p>
                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleDownload(img.imageUrl); }} className="gap-1">
                      <Download className="size-3" /> Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
