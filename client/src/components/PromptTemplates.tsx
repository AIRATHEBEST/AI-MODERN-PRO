import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Play, Edit2, Tag, Loader2, BookTemplate, Zap } from "lucide-react";

type TemplateFormProps = { onSave: (data: any) => void; initial?: any; onCancel: () => void };
function TemplateForm({ onSave, initial, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || "");
  const [userPrompt, setUserPrompt] = useState(initial?.userPrompt || "");
  const [tags, setTags] = useState((initial?.tags || []).join(", "));

  const handleSave = () => {
    if (!name.trim() || !systemPrompt.trim()) { toast.error("Name and System Prompt are required"); return; }
    onSave({ name: name.trim(), description: description.trim() || undefined, systemPrompt: systemPrompt.trim(), userPrompt: userPrompt.trim() || undefined, tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [] });
  };

  return (
    <div className="space-y-4">
      <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Code Reviewer" /></div>
      <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this template do?" /></div>
      <div><Label>System Prompt *</Label><Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="You are a helpful..." rows={5} className="font-mono text-sm" /></div>
      <div><Label>Starter User Message (optional)</Label><Textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} placeholder="Prefilled user message..." rows={3} /></div>
      <div><Label>Tags (comma-separated)</Label><Input value={tags} onChange={e => setTags(e.target.value)} placeholder="coding, review, python" /></div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save Template</Button>
      </div>
    </div>
  );
}

type Props = { onUseTemplate: (systemPrompt: string, userPrompt?: string) => void };

export function PromptTemplates({ onUseTemplate }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const query = trpc.templates.list.useQuery();
  const createMut = trpc.templates.create.useMutation({ onSuccess: () => { query.refetch(); setShowCreate(false); toast.success("Template created"); } });
  const updateMut = trpc.templates.update.useMutation({ onSuccess: () => { query.refetch(); setEditId(null); toast.success("Template updated"); } });
  const deleteMut = trpc.templates.delete.useMutation({ onSuccess: () => { query.refetch(); toast.success("Template deleted"); } });
  const useMut = trpc.templates.use.useMutation({ onSuccess: (t) => { onUseTemplate(t.systemPrompt, t.userPrompt || undefined); toast.success(`Template "${t.name}" applied`); } });

  const templates = query.data || [];
  const editTemplate = templates.find(t => t.id === editId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><BookTemplate className="size-5" /> Prompt Templates</h2>
          <p className="text-sm text-muted-foreground">Save and reuse system prompts and conversation starters</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm"><Plus className="size-4 mr-1" /> New Template</Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
          <TemplateForm onSave={d => createMut.mutate(d)} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={o => !o && setEditId(null)}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          {editTemplate && <TemplateForm initial={editTemplate} onSave={d => updateMut.mutate({ id: editId!, ...d })} onCancel={() => setEditId(null)} />}
        </DialogContent>
      </Dialog>

      {query.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookTemplate className="size-12 mx-auto mb-3 opacity-20" />
          <p>No templates yet. Create your first one!</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="grid gap-3 pr-2">
            {templates.map(t => (
              <Card key={t.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{t.name}</h3>
                        {t.useCount > 0 && <Badge variant="secondary" className="text-xs shrink-0"><Zap className="size-2.5 mr-1" />{t.useCount}x used</Badge>}
                        {(t.tags as string[] || []).map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                      </div>
                      {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2 font-mono truncate opacity-70">{t.systemPrompt.substring(0, 100)}…</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="default" onClick={() => useMut.mutate({ id: t.id })} disabled={useMut.isPending}><Play className="size-3 mr-1" />Use</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(t.id)}><Edit2 className="size-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate({ id: t.id })}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
