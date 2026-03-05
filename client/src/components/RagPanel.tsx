import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, Trash2, Search, FileText, Loader2, Database, BookOpen } from "lucide-react";

type Props = { onInjectContext: (context: string) => void };

export function RagPanel({ onInjectContext }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const docsQuery = trpc.rag.listDocuments.useQuery();
  const uploadMut = trpc.rag.uploadDocument.useMutation({ onSuccess: (r) => { docsQuery.refetch(); toast.success(`Uploaded ${r.chunks} chunk(s)`); } });
  const deleteMut = trpc.rag.deleteDocument.useMutation({ onSuccess: () => { docsQuery.refetch(); toast.success("Document deleted"); } });
  const searchQuery2 = trpc.rag.search.useQuery({ query: searchQuery, topK: 5 }, { enabled: searchQuery.length > 2 });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const text = await file.text();
      await uploadMut.mutateAsync({ name: file.name, content: text, sourceFile: file.name });
    } catch { toast.error("Upload failed"); }
    finally { setIsUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleInjectResults = () => {
    const results = searchQuery2.data || [];
    if (!results.length) { toast.error("No search results to inject"); return; }
    const ctx = results.map((r, i) => `[Source ${i + 1}: ${r.sourceFile || r.name}]\n${r.content}`).join("\n\n---\n\n");
    onInjectContext(`Here is relevant context from your documents:\n\n${ctx}\n\nPlease use this context to answer the following question:`);
    toast.success(`Injected ${results.length} relevant chunk(s) into chat`);
  };

  const docs = docsQuery.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><Database className="size-5" /> RAG Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">Upload documents and search them to inject context into your chats</p>
      </div>

      {/* Upload */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" onChange={handleFileUpload} className="hidden" accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.xml,.yaml,.yml" />
            <Button onClick={() => fileRef.current?.click()} disabled={isUploading} variant="outline" className="gap-2">
              {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload Document
            </Button>
            <span className="text-sm text-muted-foreground">Supports: .txt .md .csv .json .js .ts .py .html .yaml</span>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search your documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          {(searchQuery2.data?.length ?? 0) > 0 && (
            <Button onClick={handleInjectResults} size="sm" className="gap-1"><BookOpen className="size-4" />Inject into Chat</Button>
          )}
        </div>
        {searchQuery.length > 2 && (
          <div className="space-y-2">
            {searchQuery2.isLoading && <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin" /></div>}
            {searchQuery2.data?.map((r, i) => (
              <Card key={r.id} className="border-primary/20">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">#{i + 1}</Badge>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{r.sourceFile || r.name} · chunk {r.chunkIndex + 1}/{r.totalChunks}</p>
                      <p className="text-sm">{r.content.substring(0, 200)}…</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Documents list */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2"><FileText className="size-4" /> Uploaded Documents ({docs.length})</h3>
        {docsQuery.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="size-4 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No documents yet. Upload some to get started.</div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.totalChunks} chunk(s)</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteMut.mutate({ sourceFile: doc.sourceFile || doc.name })}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
