import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, FileText, Code, AlignLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportDialogProps {
  conversationId: number;
  title: string;
}

type Format = "markdown" | "json" | "txt";

const FORMATS: { id: Format; label: string; desc: string; icon: React.ReactNode; ext: string }[] = [
  { id: "markdown", label: "Markdown", desc: "Great for notes & docs", icon: <FileText className="size-5" />, ext: ".md" },
  { id: "txt", label: "Plain Text", desc: "Simple text export", icon: <AlignLeft className="size-5" />, ext: ".txt" },
  { id: "json", label: "JSON", desc: "Raw data export", icon: <Code className="size-5" />, ext: ".json" },
];

export function ExportDialog({ conversationId, title }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<Format>("markdown");
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await utils.chat.exportConversation.fetch({ id: conversationId, format: selectedFormat });
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${selectedFormat.toUpperCase()}`);
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
          <Download className="size-3" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground truncate">"{title}"</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFormat(f.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors",
                  selectedFormat === f.id ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"
                )}
              >
                {f.icon}
                <span className="text-xs font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.desc}</span>
              </button>
            ))}
          </div>
          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Exporting…</> : <><Download className="size-4 mr-2" /> Download {FORMATS.find(f => f.id === selectedFormat)?.ext}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
