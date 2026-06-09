import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Loader2,
  Plus,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createTeam,
  fetchMyTeams,
  joinTeam,
} from "@/store/slices/athleteTeamsSlice";
import { toast } from "sonner";

export default function AthleteTeams() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { teams, loading, saving, error } = useAppSelector((s) => s.athleteTeams);
  const { user } = useAppSelector((s) => s.athleteAuth);
  const [showCreate, setShowCreate] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    dispatch(fetchMyTeams());
  }, [dispatch]);

  const createFormik = useFormik({
    initialValues: { name: "", description: "" },
    validationSchema: Yup.object({
      name: Yup.string().trim().min(2).max(80).required(t("common.required")),
      description: Yup.string().max(500),
    }),
    onSubmit: async (values, { resetForm }) => {
      const result = await dispatch(
        createTeam({
          name: values.name.trim(),
          description: values.description.trim() || null,
          is_public: true,
        }),
      );
      if (createTeam.fulfilled.match(result)) {
        resetForm();
        setShowCreate(false);
        toast.success(t("athletePortal.teams.create"));
      }
    },
  });

  const joinFormik = useFormik({
    initialValues: { invite_code: "" },
    validationSchema: Yup.object({
      invite_code: Yup.string().trim().min(4).required(t("common.required")),
    }),
    onSubmit: async (values, { resetForm }) => {
      setJoining(true);
      const result = await dispatch(
        joinTeam({ invite_code: values.invite_code.trim().toUpperCase() }),
      );
      setJoining(false);
      if (joinTeam.fulfilled.match(result)) {
        resetForm();
        toast.success(t("athletePortal.teams.join"));
      }
    },
  });

  const copyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("athletePortal.teams.inviteCopied"));
    } catch {
      toast.error(t("common.retry"));
    }
  };

  const isOwner = (team: (typeof teams)[0]) =>
    team.my_role === "owner" || team.owner_athlete_id === user?.id;

  return (
    <div className="max-w-3xl mx-auto w-full min-w-0 overflow-x-clip space-y-8">
      <MetaHelmet
        title={t("athletePortal.teams.title")}
        description={t("athletePortal.teams.subtitle")}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/10 via-card to-purple-accent/10 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyan/15 border border-cyan/25">
            <UsersRound className="w-7 h-7 text-cyan" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{t("athletePortal.teams.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("athletePortal.teams.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      <PortalErrorAlert error={error} onRetry={() => dispatch(fetchMyTeams())} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-sport p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan" />
              {t("athletePortal.teams.createTitle")}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-cyan"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? t("common.cancel") : t("athletePortal.teams.createTitle")}
            </Button>
          </div>
          {showCreate ? (
            <form onSubmit={createFormik.handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label>{t("athletePortal.teams.name")}</Label>
                <Input
                  placeholder={t("athletePortal.teams.name")}
                  {...createFormik.getFieldProps("name")}
                />
                {createFormik.touched.name && createFormik.errors.name ? (
                  <p className="text-xs text-destructive">{createFormik.errors.name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t("athletePortal.teams.description")}</Label>
                <Textarea
                  placeholder={t("athletePortal.teams.description")}
                  className="min-h-[72px]"
                  {...createFormik.getFieldProps("description")}
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full btn-primary rounded-xl">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("athletePortal.teams.create")
                )}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{t("athletePortal.teams.empty")}</p>
          )}
        </div>

        <div className="card-sport p-5 space-y-4">
          <h2 className="font-bold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-cyan" />
            {t("athletePortal.teams.joinTitle")}
          </h2>
          <form onSubmit={joinFormik.handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label>{t("athletePortal.teams.inviteCode")}</Label>
              <Input
                placeholder={t("athletePortal.teams.inviteCode")}
                className="font-mono uppercase tracking-wider"
                {...joinFormik.getFieldProps("invite_code")}
              />
              {joinFormik.touched.invite_code && joinFormik.errors.invite_code ? (
                <p className="text-xs text-destructive">{joinFormik.errors.invite_code}</p>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={joining}
              variant="outline"
              className="w-full border-cyan/30 hover:border-cyan"
            >
              {joining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("athletePortal.teams.join")
              )}
            </Button>
          </form>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan" />
          {t("athletePortal.teams.title")}
          <span className="text-sm font-normal text-muted-foreground">({teams.length})</span>
        </h2>

        {loading && teams.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-cyan" />
          </div>
        ) : teams.length === 0 ? (
          <div className="card-sport p-8 text-center text-muted-foreground text-sm">
            {t("athletePortal.teams.empty")}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {teams.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-sport p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{team.name}</h3>
                    {team.description ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {team.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                    {team.my_role ?? "member"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4 text-cyan" />
                    {t("athletePortal.teams.members", { count: team.member_count })}
                  </span>
                </div>
                {isOwner(team) ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan/5 border border-cyan/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("athletePortal.teams.inviteCode")}
                      </p>
                      <p className="font-mono font-bold text-cyan truncate">{team.invite_code}</p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => copyInvite(team.invite_code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
