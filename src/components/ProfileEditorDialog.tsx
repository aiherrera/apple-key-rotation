import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppleProfile } from "@/hooks/useProfiles";
import { normalizeProfile } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

export type ProfileEditorMode = "create" | "edit";

/** Comma-separated list → badge labels (commas removed; trimmed segments only). */
export function parseCommaSeparatedTags(raw: string): string[] {
  return raw
    .split(",")
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function dedupePreserveOrder(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function mergeSubmittedTagsCommittedAndDraft(tags: string[], draft: string): string[] {
  return dedupePreserveOrder([...tags, ...parseCommaSeparatedTags(draft)]);
}

type TagChipsFieldProps = {
  id?: string;
  tags: string[];
  draft: string;
  onTagsChange: (tags: string[]) => void;
  onDraftChange: (draft: string) => void;
};

/** Inline chips: comma commits (parses comma-delimited segment); paste with commas splits into badges; Enter commits same parse. Spaces stay inside one tag until a comma. */
function TagChipsField({ id, tags, draft, onTagsChange, onDraftChange }: TagChipsFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  /** Turn current draft into badges via comma-split; comma never appears in badges. */
  const commitCommaDelimitedDraft = (): void => {
    const pieces = parseCommaSeparatedTags(draft);
    if (pieces.length === 0) return;
    onDraftChange("");
    onTagsChange(dedupePreserveOrder([...tags, ...pieces]));
  };

  const ingestPastedCommaList = (pastedPlain: string): void => {
    const chunk = `${draft}${pastedPlain}`;
    const pieces = parseCommaSeparatedTags(chunk);
    if (pieces.length === 0) {
      onDraftChange("");
      return;
    }
    onTagsChange(dedupePreserveOrder([...tags, ...pieces]));
    onDraftChange("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeTagAt = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div
      role="group"
      aria-labelledby={id ? `${id}-label` : undefined}
      className={cn(
        "flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm ring-offset-background",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      {tags.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant="secondary"
          className="gap-1 pl-2.5 pr-1 font-normal"
        >
          <span>{tag}</span>
          <button
            type="button"
            className="rounded-full p-0.5 hover:bg-muted-foreground/15 focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={`Remove tag ${tag}`}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              removeTagAt(index);
            }}
          >
            <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        id={id ? `${id}-input` : undefined}
        aria-label={id === "profile-tags" ? "Tag input" : "Tags"}
        className={cn(
          "min-h-7 flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground",
          "min-w-[6rem]",
        )}
        value={draft}
        placeholder={
          tags.length === 0
            ? "Tags separated by commas — or paste a comma-separated list…"
            : "Add tag…"
        }
        autoComplete="off"
        spellCheck={false}
        onChange={(ev) => onDraftChange(ev.target.value)}
        onPaste={(ev) => {
          const text = ev.clipboardData.getData("text/plain");
          if (text.length > 0 && text.includes(",")) {
            ev.preventDefault();
            ingestPastedCommaList(text);
          }
        }}
        onKeyDown={(ev) => {
          if (ev.key === ",") {
            ev.preventDefault();
            commitCommaDelimitedDraft();
            return;
          }
          if (ev.key === "Enter") {
            ev.preventDefault();
            commitCommaDelimitedDraft();
            return;
          }
          if (ev.key === "Backspace" && draft === "" && tags.length > 0) {
            ev.preventDefault();
            onTagsChange(tags.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

export type ProfileEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ProfileEditorMode;
  /** When mode is create: seed from active profile identifiers + suggested name. */
  createSeed: {
    name: string;
    keyId: string;
    teamId: string;
    servicesId: string;
    tags: string[];
    notes: string;
  };
  /** When mode is edit: profile to populate the form. */
  editProfile: AppleProfile | null;
  onCreate: (payload: Omit<AppleProfile, "id">) => void;
  onSave: (profile: AppleProfile) => void;
};

export function ProfileEditorDialog({
  open,
  onOpenChange,
  mode,
  createSeed,
  editProfile,
  onCreate,
  onSave,
}: ProfileEditorDialogProps) {
  const [name, setName] = useState("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [keyId, setKeyId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [servicesId, setServicesId] = useState("");

  const prevOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || !justOpened) return;

    if (mode === "create") {
      setName(createSeed.name);
      setTagList(dedupePreserveOrder([...createSeed.tags]));
      setTagDraft("");
      setNotes(createSeed.notes);
      setKeyId(createSeed.keyId);
      setTeamId(createSeed.teamId);
      setServicesId(createSeed.servicesId);
      return;
    }
    if (editProfile) {
      const p = normalizeProfile(editProfile);
      setName(p.name);
      setTagList(dedupePreserveOrder([...p.tags]));
      setTagDraft("");
      setNotes(p.notes);
      setKeyId(p.keyId);
      setTeamId(p.teamId);
      setServicesId(p.servicesId);
    }
  }, [open, mode, createSeed, editProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const tags = mergeSubmittedTagsCommittedAndDraft(tagList, tagDraft);
    const nk = keyId.trim();
    const tk = teamId.trim();
    const sk = servicesId.trim();

    if (mode === "create") {
      onCreate({
        name: trimmedName,
        tags,
        notes: notes.trim(),
        keyId: nk,
        teamId: tk,
        servicesId: sk,
      });
      onOpenChange(false);
      return;
    }

    if (editProfile) {
      onSave(
        normalizeProfile({
          ...editProfile,
          name: trimmedName,
          tags,
          notes: notes.trim(),
          keyId: nk,
          teamId: tk,
          servicesId: sk,
        }),
      );
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New profile" : "Edit profile"}</DialogTitle>
            <DialogDescription>
              Labels and notes stay on this device only—they are{" "}
              <span className="font-medium text-foreground">never</span> sent to Apple or included in
              the JWT.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="e.g. Production backend"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="space-y-2">
              <Label id="profile-tags-label" htmlFor="profile-tags-input">
                Tags
              </Label>
              <TagChipsField
                id="profile-tags"
                tags={tagList}
                draft={tagDraft}
                onTagsChange={setTagList}
                onDraftChange={setTagDraft}
              />
              <p className="text-[10px] text-muted-foreground">
                Use commas between tags (or paste comma-separated values). Press Enter to add what is
                in the box. Spaces are allowed inside a tag until the next comma. Backspace deletes
                the last tag when the field is empty.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-notes">Notes</Label>
              <Textarea
                id="profile-notes"
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="Optional context — team owner, dashboards, reminders…"
                className="min-h-[72px]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="profile-key-id">Key ID</Label>
                <Input
                  id="profile-key-id"
                  value={keyId}
                  onChange={(ev) => setKeyId(ev.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-team-id">Team ID</Label>
                <Input
                  id="profile-team-id"
                  value={teamId}
                  onChange={(ev) => setTeamId(ev.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-services-id">Services ID</Label>
                <Input
                  id="profile-services-id"
                  value={servicesId}
                  onChange={(ev) => setServicesId(ev.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
