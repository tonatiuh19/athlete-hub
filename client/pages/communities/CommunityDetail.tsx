import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Crown,
  Loader2,
  LogIn,
  UserPlus,
  Users,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { communityCoverUrl } from "@/constants/communityAssets";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearPublicTeamDetail,
  fetchPublicTeamDetail,
} from "@/store/slices/publicTeamsSlice";

function memberInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

export default function CommunityDetail() {
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const dispatch = useAppDispatch();
  const { detail, loadingDetail, detailError } = useAppSelector((s) => s.publicTeams);
  const { token } = useAppSelector((s) => s.athleteAuth);

  useEffect(() => {
    if (!slug) return;
    void dispatch(fetchPublicTeamDetail(slug));
    return () => {
      dispatch(clearPublicTeamDetail());
    };
  }, [dispatch, slug]);

  const team = detail?.team;
  const members = detail?.members_preview ?? [];
  const cover = communityCoverUrl(team?.avatar_url);
  const joinHref = token ? "/portal/teams" : `/login?returnTo=${encodeURIComponent("/portal/teams")}`;

  return (
    <>
      <MetaHelmet
        title={team ? `${team.name} — Triboo Sport` : t("communities.detail.loadingTitle")}
        description={team?.description ?? t("communities.meta.description")}
        path={slug ? `/communities/${slug}` : "/communities"}
      />

      {loadingDetail && !team ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : detailError && !team ? (
        <div className="max-w-lg mx-auto px-4 py-20">
          <PortalErrorAlert
            error={detailError}
            onRetry={() => slug && dispatch(fetchPublicTeamDetail(slug))}
          />
          <Button asChild variant="ghost" className="mt-4">
            <Link to="/communities">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("communities.detail.back")}
            </Link>
          </Button>
        </div>
      ) : team ? (
        <>
          <section className="relative overflow-hidden border-b border-border/60">
            <div className="absolute inset-0">
              <img src={cover} alt="" className="w-full h-full object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/70" />
            </div>

            <div className="relative max-w-5xl mx-auto px-4 md:px-6 pt-8 pb-12 md:pb-16 w-full min-w-0">
              <Link
                to="/communities"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("communities.detail.back")}
              </Link>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end gap-6"
              >
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-glow-triboo shrink-0">
                  <img src={cover} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight break-words">
                    {team.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" />
                      {t("communities.card.members", {
                        count: team.member_count.toLocaleString(),
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-accent" />
                      {t("communities.detail.captain", {
                        name: `${team.owner_first_name} ${team.owner_last_name}`.trim(),
                      })}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <section className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14 w-full min-w-0">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="card-sport p-6 md:p-8">
                  <h2 className="text-lg font-bold text-foreground mb-3">
                    {t("communities.detail.about")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {team.description?.trim() || t("communities.detail.defaultAbout")}
                  </p>
                </div>

                <div className="card-sport p-6 md:p-8">
                  <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    {t("communities.detail.roster")}
                  </h2>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("communities.detail.noMembers")}</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {members.map((member, i) => (
                        <motion.div
                          key={`${member.first_name}-${member.last_name}-${i}`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20"
                        >
                          <Avatar className="h-10 w-10 border border-primary/20">
                            {member.avatar_url ? (
                              <AvatarImage src={member.avatar_url} alt="" />
                            ) : null}
                            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                              {memberInitials(member.first_name, member.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {member.role === "owner"
                                ? t("communities.detail.roleOwner")
                                : t("communities.detail.roleMember")}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="card-sport p-6 space-y-4 sticky top-24">
                  <h2 className="font-bold text-foreground">{t("communities.detail.joinTitle")}</h2>
                  <p className="text-sm text-muted-foreground">{t("communities.detail.joinHint")}</p>
                  <Button asChild className="w-full btn-primary rounded-xl h-11 gap-2">
                    <Link to={joinHref}>
                      {token ? (
                        <>
                          <UserPlus className="w-4 h-4" />
                          {t("communities.detail.joinPortal")}
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          {t("communities.detail.signInToJoin")}
                        </>
                      )}
                    </Link>
                  </Button>
                  {!token ? (
                    <p className="text-xs text-muted-foreground text-center">
                      {t("communities.detail.signInHint")}
                    </p>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
