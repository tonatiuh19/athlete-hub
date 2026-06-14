import { motion } from "framer-motion";
import { ArrowRight, Flame, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicTeamListItem } from "@shared/api";
import { communityCoverUrl } from "@/constants/communityAssets";

interface CommunityCardProps {
  team: Pick<
    PublicTeamListItem,
    "name" | "slug" | "member_count" | "avatar_url" | "description"
  >;
  featured?: boolean;
  rank?: number;
}

export default function CommunityCard({ team, featured = false, rank }: CommunityCardProps) {
  const { t } = useTranslation();
  const cover = communityCoverUrl(team.avatar_url);

  return (
    <motion.article
      className={`card-sport group overflow-hidden h-full flex flex-col ${
        featured ? "md:col-span-2 md:flex-row" : ""
      }`}
      whileHover={{ y: featured ? -4 : -8 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        to={`/communities/${team.slug}`}
        className={`relative overflow-hidden shrink-0 ${
          featured ? "md:w-[42%] h-52 md:h-auto min-h-[13rem]" : "h-44"
        }`}
      >
        <img
          src={cover}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
        {rank != null && rank <= 3 ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-triboo-gradient text-primary-foreground text-xs font-bold shadow-glow-triboo">
            #{rank}
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/40 bg-background/70 backdrop-blur-sm text-xs font-semibold text-primary">
          <Flame className="w-3.5 h-3.5" />
          {t("communities.card.active")}
        </span>
      </Link>

      <div className={`p-5 flex flex-col flex-1 ${featured ? "md:justify-center md:p-7" : ""}`}>
        <h3
          className={`font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 ${
            featured ? "text-xl md:text-2xl mb-2" : "text-lg mb-2"
          }`}
        >
          <Link to={`/communities/${team.slug}`}>{team.name}</Link>
        </h3>

        {team.description ? (
          <p
            className={`text-sm text-muted-foreground mb-4 ${
              featured ? "line-clamp-3" : "line-clamp-2"
            }`}
          >
            {team.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {t("communities.card.defaultBlurb")}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto mb-4">
          <Users className="w-4 h-4 text-primary shrink-0" />
          <span>
            {t("communities.card.members", { count: team.member_count.toLocaleString() })}
          </span>
        </div>

        <Link
          to={`/communities/${team.slug}`}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-center bg-primary/10 border border-primary/40 text-primary font-semibold rounded-lg hover:bg-triboo-gradient hover:text-primary-foreground hover:border-transparent transition-all duration-300 group/link"
        >
          {t("communities.card.viewTribe")}
          <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.article>
  );
}
