import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ImageIcon,
  Undo2,
  Redo2,
  Loader2,
  Minus,
  Highlighter,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RichHtmlEditorHandle {
  getHtml: () => string;
}

export interface RichHtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Returns a local preview URL; CDN upload happens on post save */
  onStageImage?: (file: File) => string | null;
  className?: string;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors disabled:opacity-40",
        active
          ? "bg-primary/20 text-primary border border-primary/40"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent",
      )}
    >
      {children}
    </button>
  );
}

const RichHtmlEditor = forwardRef<RichHtmlEditorHandle, RichHtmlEditorProps>(
  function RichHtmlEditor(
    { value, onChange, placeholder, onStageImage, className },
    ref,
  ) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Custom Link / Underline configs are registered below
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-4" } }),
      Placeholder.configure({
        placeholder: placeholder || t("staffPortal.blog.editor.bodyPlaceholder"),
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] px-4 py-3 focus:outline-none prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary max-w-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (syncingRef.current) return;
      onChange(ed.getHTML());
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => editor?.getHTML() ?? value,
    }),
    [editor, value],
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      syncingRef.current = true;
      editor.commands.setContent(value || "", { emitUpdate: false });
      syncingRef.current = false;
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("staffPortal.blog.editor.linkPrompt"), prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, t]);

  const stageImage = useCallback(
    (file: File) => {
      if (!editor || !onStageImage) return;
      const previewUrl = onStageImage(file);
      if (!previewUrl) return;
      editor.chain().focus().setImage({ src: previewUrl }).run();
    },
    [editor, onStageImage],
  );

  useEffect(() => {
    if (!editor || !onStageImage) return;

    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            stageImage(file);
          }
          break;
        }
      }
    };

    const el = editor.view.dom;
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [editor, onStageImage, stageImage]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) stageImage(file);
      e.target.value = "";
    },
    [stageImage],
  );

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card min-h-[320px] flex items-center justify-center text-muted-foreground gap-2",
          className,
        )}
      >
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm">{t("staffPortal.blog.editor.loading")}</span>
      </div>
    );
  }

  const wordCount = editor.getText().split(/\s+/).filter(Boolean).length;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden focus-within:border-primary/50 focus-within:shadow-glow-triboo transition-all",
        className,
      )}
      onDragOver={(e) => {
        if (onStageImage) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!onStageImage) return;
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) stageImage(file);
      }}
    >
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-secondary/40">
        <ToolbarButton
          title={t("staffPortal.blog.editor.undo")}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t("staffPortal.blog.editor.redo")}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>

        <span className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          title={t("staffPortal.blog.editor.heading2")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          title={t("staffPortal.blog.editor.heading3")}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <span className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          active={editor.isActive("bold")}
          title={t("staffPortal.blog.editor.bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          title={t("staffPortal.blog.editor.italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          title={t("staffPortal.blog.editor.underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          title={t("staffPortal.blog.editor.strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("highlight")}
          title={t("staffPortal.blog.editor.highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>

        <span className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          title={t("staffPortal.blog.editor.bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          title={t("staffPortal.blog.editor.orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          title={t("staffPortal.blog.editor.quote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t("staffPortal.blog.editor.horizontalRule")}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <span className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          title={t("staffPortal.blog.editor.alignLeft")}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          title={t("staffPortal.blog.editor.alignCenter")}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          title={t("staffPortal.blog.editor.alignRight")}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <span className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          active={editor.isActive("link")}
          title={t("staffPortal.blog.editor.link")}
          onClick={setLink}
        >
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
        {onStageImage ? (
          <>
            <ToolbarButton
              title={t("staffPortal.blog.editor.image")}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4" />
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onFileChange}
            />
          </>
        ) : null}
      </div>

      <EditorContent editor={editor} />

      <div className="px-4 py-2 border-t border-border bg-secondary/30 text-xs text-muted-foreground flex justify-between">
        <span>{t("staffPortal.blog.editor.wordCount", { count: wordCount })}</span>
        {onStageImage ? (
          <span>{t("staffPortal.blog.editor.imagesUploadOnSave")}</span>
        ) : null}
      </div>
    </div>
  );
  },
);

export default RichHtmlEditor;
