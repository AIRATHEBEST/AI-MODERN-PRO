import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Trash2, Pin, PinOff, MessageSquare, Clock, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type SearchHistoryProps = {
  onSelectConversation: (id: number) => void;
};

export function SearchHistory({ onSelectConversation }: SearchHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const conversationsQuery = trpc.chat.getConversations.useQuery();
  const deleteConvMutation = trpc.chat.deleteConversation.useMutation();
  const togglePinMutation = trpc.chat.togglePin.useMutation();

  const conversations = conversationsQuery.data || [];
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteConvMutation.mutateAsync({ id: deleteId });
      toast.success("Conversation deleted");
      await conversationsQuery.refetch();
      setDeleteId(null);
      // Force UI update
      window.location.reload();
    } catch (error) {
      toast.error("Failed to delete conversation");
    }
  };

  const handleTogglePin = async (id: number, isPinned: boolean) => {
    try {
      await togglePinMutation.mutateAsync({ id, isPinned: !isPinned });
      conversationsQuery.refetch();
    } catch (error) {
      toast.error("Failed to update conversation");
    }
  };

  const pinnedConversations = filtered.filter((c) => c.isPinned);
  const unpinnedConversations = filtered.filter((c) => !c.isPinned);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Search History</h3>
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9"
        />
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4 pr-4">
          {conversationsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No conversations found
            </p>
          ) : (
            <>
              {/* Pinned Conversations */}
              {pinnedConversations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Pinned
                  </p>
                  {pinnedConversations.map((conv) => (
                    <ConversationCard
                      key={conv.id}
                      conversation={conv}
                      onSelect={() => onSelectConversation(conv.id)}
                      onTogglePin={() => handleTogglePin(conv.id, conv.isPinned)}
                      onDelete={() => setDeleteId(conv.id)}
                    />
                  ))}
                </div>
              )}

              {/* Unpinned Conversations */}
              {unpinnedConversations.length > 0 && (
                <div className="space-y-2">
                  {pinnedConversations.length > 0 && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase mt-4">
                      Recent
                    </p>
                  )}
                  {unpinnedConversations.map((conv) => (
                    <ConversationCard
                      key={conv.id}
                      conversation={conv}
                      onSelect={() => onSelectConversation(conv.id)}
                      onTogglePin={() => handleTogglePin(conv.id, conv.isPinned)}
                      onDelete={() => setDeleteId(conv.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The conversation and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type ConversationCardProps = {
  conversation: any;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
};

function ConversationCard({
  conversation,
  onSelect,
  onTogglePin,
  onDelete,
}: ConversationCardProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onSelect}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{conversation.title}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {conversation.provider && (
                <div className="flex items-center gap-1">
                  <Zap className="size-3" />
                  <span>{conversation.provider}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="size-3" />
                <span>
                  {formatDistanceToNow(new Date(conversation.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={onTogglePin}
              className="h-7 w-7 p-0"
            >
              {conversation.isPinned ? (
                <PinOff className="size-3" />
              ) : (
                <Pin className="size-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
