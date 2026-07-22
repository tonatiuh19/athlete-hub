import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { StaffBlogCardsSkeleton } from "@/components/staff/skeletons/StaffSkeletons";
import { Badge } from "@/components/ui/badge";
import { BlogOriginBadge } from "@/components/blog/BlogOriginBadge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  deleteStaffBlogPost,
  fetchStaffBlogPosts,
} from "@/store/slices/blogsSlice";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { getBlogOrigin } from "@/utils/blogOrigin";
import { cn } from "@/lib/utils";
import type { BlogPostStaff } from "@shared/api";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-primary/15 text-primary border-primary/30",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted/80 text-muted-foreground border-border",
};

export default function BlogPosts() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((s) => s.staffAuth);
  const { staffPosts, staffLoading, staffError, deleting } = useAppSelector((s) => s.blogs);
  const [deleteTarget, setDeleteTarget] = useState<BlogPostStaff | null>(null);
  const dateLocale = getDateFnsLocale(i18n.language);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (role) dispatch(fetchStaffBlogPosts(role));
  }, [dispatch, role]);

  const handleDelete = async () => {
    if (!deleteTarget || !role) return;
    await dispatch(deleteStaffBlogPost({ role, postId: deleteTarget.id }));
    setDeleteTarget(null);
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={
          isAdmin ? t("staffPortal.blog.titleAdmin") : t("staffPortal.blog.titleOrganizer")
        }
        description={t("staffPortal.blog.subtitle")}
        noindex
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            {isAdmin ? t("staffPortal.blog.titleAdmin") : t("staffPortal.blog.titleOrganizer")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.blog.subtitle")}</p>
        </div>
        <Button asChild className="btn-primary shrink-0">
          <Link to="/staff/blog/new">
            <Plus className="w-4 h-4 mr-2" />
            {t("staffPortal.blog.newPost")}
          </Link>
        </Button>
      </div>

      {staffError ? (
        <PortalErrorAlert
          error={staffError}
          onRetry={() => role && dispatch(fetchStaffBlogPosts(role))}
        />
      ) : null}

      {staffLoading ? (
        <StaffBlogCardsSkeleton count={4} />
      ) : staffPosts.length === 0 ? (
        <div className="card-sport p-10 text-center text-muted-foreground">
          <p>{t("staffPortal.blog.empty")}</p>
          <Button asChild className="btn-primary mt-6">
            <Link to="/staff/blog/new">{t("staffPortal.blog.newPost")}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {staffPosts.map((post) => (
            <div
              key={post.id}
              className="card-sport p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {post.coverImageUrl ? (
                <img
                  src={post.coverImageUrl}
                  alt=""
                  className="w-full sm:w-28 h-20 object-cover rounded-lg shrink-0"
                />
              ) : (
                <div className="w-full sm:w-28 h-20 rounded-lg bg-triboo-gradient opacity-40 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="font-semibold text-foreground truncate">{post.title}</h2>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize font-medium",
                      STATUS_STYLES[post.status] ?? "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {t(`staffPortal.blog.status.${post.status}`)}
                  </Badge>
                  {post.featured ? (
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">
                      {t("staffPortal.blog.featuredBadge")}
                    </span>
                  ) : null}
                  <BlogOriginBadge origin={getBlogOrigin(post)} />
                </div>
                <p className="text-xs text-muted-foreground truncate">/{post.slug}</p>
                {post.updatedAt ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("staffPortal.blog.updatedAt", {
                      date: format(new Date(post.updatedAt), "PPp", { locale: dateLocale }),
                    })}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild className="border-primary/30">
                  <Link to={`/staff/blog/${post.id}/edit`}>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    {t("staffPortal.blog.actions.edit")}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(post)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("staffPortal.blog.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("staffPortal.blog.deleteConfirm", { title: deleteTarget?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("staffPortal.blog.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("staffPortal.blog.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
