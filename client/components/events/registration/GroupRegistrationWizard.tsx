import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import WizardAuthStep from "@/components/events/registration/WizardAuthStep";
import WizardWaiverStep from "@/components/events/registration/WizardWaiverStep";
import WizardExtrasStep from "@/components/events/registration/WizardExtrasStep";
import WizardRegistrationFieldsForm from "@/components/events/registration/WizardRegistrationFieldsForm";
import WizardGroupCheckoutStep from "@/components/events/registration/WizardGroupCheckoutStep";
import WizardGroupResultStep from "@/components/events/registration/WizardGroupResultStep";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeGroupRegistrationWizard,
  createGroupRegistrationCheckout,
  initGroupParticipants,
  openGroupRegistrationWizard,
  setCurrentParticipantIndex,
  setGroupDiscountCode,
  setGroupIncludeSelf,
  setGroupParticipantCount,
  setGroupWizardStep,
  setGroupWaiverForCurrent,
  updateCurrentParticipant,
  type GroupParticipantDraft,
} from "@/store/slices/groupRegistrationCheckoutSlice";
import { fetchPaymentConfig } from "@/store/slices/registrationCheckoutSlice";
import { fetchEventDetail } from "@/store/slices/marketplaceSlice";
import { fetchAthleteRegistrations } from "@/store/slices/athletePortalSlice";
import {
  eventRequiresWaiver,
  getRegistrationWaivers,
  isWaiverMisconfigured,
} from "@/utils/eventRegistrationWaivers";
import { filterRegistrationFieldsForCategory } from "@shared/registrationFields";
import type { EventCategory, GroupCheckoutLineItemInput } from "@shared/api";
import { cn } from "@/lib/utils";

export { openGroupRegistrationWizard };

type ParticipantSubStep = "profile" | "fields" | "waiver" | "extras";

function participantDisplayName(
  p: GroupParticipantDraft,
  youLabel: string,
): string {
  if (p.participantType === "self") return youLabel;
  if (p.participantType === "account") return p.accountEmail?.trim() || youLabel;
  return `${p.guest?.firstName ?? ""} ${p.guest?.lastName ?? ""}`.trim() || youLabel;
}

function nextAfter(
  current: ParticipantSubStep,
  available: ParticipantSubStep[],
): ParticipantSubStep | null {
  const idx = available.indexOf(current);
  if (idx < 0 || idx >= available.length - 1) return null;
  return available[idx + 1];
}

function prevBefore(
  current: ParticipantSubStep,
  available: ParticipantSubStep[],
): ParticipantSubStep | null {
  const idx = available.indexOf(current);
  if (idx <= 0) return null;
  return available[idx - 1];
}

export default function GroupRegistrationWizard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventDetail } = useAppSelector((s) => s.marketplace);
  const { token, user } = useAppSelector((s) => s.athleteAuth);
  const {
    open,
    step,
    eventSlug,
    simulationToken,
    participantCount,
    includeSelf,
    currentParticipantIndex,
    participants,
    checkout,
    confirmResult,
    discountCode,
    loadingCheckout,
    paymentFailed,
    failureMessage,
    error,
  } = useAppSelector((s) => s.groupRegistration);

  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [subStep, setSubStep] = useState<ParticipantSubStep>("profile");

  const categories = eventDetail?.categories ?? [];
  const registrationWaivers = useMemo(
    () => getRegistrationWaivers(eventDetail),
    [eventDetail],
  );
  const needsWaiver = eventRequiresWaiver(eventDetail) && registrationWaivers.length > 0;
  const waiverMisconfigured = isWaiverMisconfigured(eventDetail);
  const current = participants[currentParticipantIndex];
  const currentCategory = categories.find((c) => c.id === current?.categoryId);

  const registrationFields = useMemo(() => {
    const all = eventDetail?.registrationFields ?? [];
    if (!currentCategory?.id) return [];
    return filterRegistrationFieldsForCategory(all, currentCategory.id);
  }, [eventDetail?.registrationFields, currentCategory?.id]);

  const registrationExtras = useMemo(() => {
    const all = eventDetail?.extras ?? [];
    if (!currentCategory?.id) return all;
    return all.filter((extra) => {
      const scope = extra.scope_type ?? "all_categories";
      if (scope === "all_categories") return true;
      return (extra.category_ids ?? []).includes(currentCategory.id);
    });
  }, [eventDetail?.extras, currentCategory?.id]);

  const hasFields = registrationFields.length > 0;
  const hasExtras = registrationExtras.length > 0;
  const maxPerOrder = eventDetail?.event?.max_registrations_per_order ?? 10;
  const buyerRegistered = eventDetail?.myRegistration?.status === "confirmed";

  const availableSubSteps = useMemo((): ParticipantSubStep[] => {
    const steps: ParticipantSubStep[] = ["profile"];
    if (hasFields) steps.push("fields");
    if (needsWaiver) steps.push("waiver");
    if (hasExtras) steps.push("extras");
    return steps;
  }, [hasFields, needsWaiver, hasExtras]);

  const currentParticipantLabel = current
    ? participantDisplayName(current, t("groupRegistration.you"))
    : "";

  useEffect(() => {
    if (open && eventSlug) {
      if (!simulationToken) {
        if (!eventDetail?.event || eventDetail.event.slug !== eventSlug) {
          dispatch(fetchEventDetail(eventSlug));
        }
      }
      dispatch(fetchPaymentConfig({ simulationToken }));
    }
  }, [
    open,
    eventSlug,
    simulationToken,
    eventDetail?.event,
    eventDetail?.event?.slug,
    dispatch,
  ]);

  useEffect(() => {
    if (!open) setSubStep("profile");
  }, [open, currentParticipantIndex]);

  useEffect(() => {
    if (!open || !token || step !== "auth") return;
    if (buyerRegistered) dispatch(setGroupIncludeSelf(false));
    dispatch(setGroupWizardStep("quantity"));
  }, [open, token, step, buyerRegistered, dispatch]);

  useEffect(() => {
    if (!open || !confirmResult?.success) return;
    dispatch(fetchAthleteRegistrations());
  }, [open, confirmResult?.success, dispatch]);

  /** If a step disappears (e.g. category loses scoped fields), snap back to a valid step. */
  useEffect(() => {
    if (step !== "participant") return;
    if (!availableSubSteps.includes(subStep)) {
      setSubStep(availableSubSteps[0] ?? "profile");
    }
  }, [step, subStep, availableSubSteps]);

  const lineItemsForCheckout = useMemo((): GroupCheckoutLineItemInput[] => {
    return participants
      .filter((p) => p.categoryId > 0)
      .map((p) => ({
        lineId: p.lineId,
        participantType: p.participantType,
        accountEmail: p.accountEmail,
        guest: p.guest,
        guardianRelationship: p.guardianRelationship,
        managedByPurchaser: p.managedByPurchaser,
        categoryId: p.categoryId,
        fieldValues: p.fieldValues ?? {},
        waiverSignatures: p.waiverSignatures,
        selectedExtras: p.selectedExtras,
        extraFieldAnswers: p.extraFieldAnswers,
        waitlistEntryId: p.waitlistEntryId,
      }));
  }, [participants]);

  const advanceParticipant = () => {
    setSubStep("profile");
    if (currentParticipantIndex < participants.length - 1) {
      dispatch(setCurrentParticipantIndex(currentParticipantIndex + 1));
    } else {
      dispatch(setGroupWizardStep("review"));
    }
  };

  const goNextParticipantSubStep = () => {
    const nxt = nextAfter(subStep, availableSubSteps);
    if (nxt) {
      setSubStep(nxt);
      return;
    }
    advanceParticipant();
  };

  const goPrevParticipantSubStep = () => {
    const prev = prevBefore(subStep, availableSubSteps);
    if (prev) {
      setSubStep(prev);
      return;
    }
    if (currentParticipantIndex > 0) {
      setSubStep("profile");
      dispatch(setCurrentParticipantIndex(currentParticipantIndex - 1));
    }
  };

  const profileContinueLabel = (() => {
    const nxt = nextAfter("profile", availableSubSteps);
    if (nxt === "fields") return t("groupRegistration.continueToFields");
    if (nxt === "waiver") return t("groupRegistration.continueToWaiver");
    if (nxt === "extras") return t("groupRegistration.continueToExtras");
    return currentParticipantIndex < participants.length - 1
      ? t("groupRegistration.nextParticipant")
      : t("groupRegistration.reviewOrder");
  })();

  const fieldsContinueLabel = (() => {
    const nxt = nextAfter("fields", availableSubSteps);
    if (nxt === "waiver") return t("groupRegistration.continueToWaiver");
    if (nxt === "extras") return t("groupRegistration.continueToExtras");
    return currentParticipantIndex < participants.length - 1
      ? t("groupRegistration.nextParticipant")
      : t("groupRegistration.reviewOrder");
  })();

  const handleStartCheckout = () => {
    if (!eventSlug) return;
    dispatch(
      createGroupRegistrationCheckout({
        slug: eventSlug,
        lineItems: lineItemsForCheckout,
        idempotencyKey,
        discountCode: discountCode.trim() || undefined,
        simulationToken: simulationToken || undefined,
      }),
    );
  };

  const handleRetry = () => {
    setIdempotencyKey(crypto.randomUUID());
    dispatch(setGroupWizardStep("review"));
  };

  if (!open || !eventSlug) return null;

  if (!eventDetail || eventDetail.event.slug !== eventSlug) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && dispatch(closeGroupRegistrationWizard())}>
        <DialogContent className="max-w-sm bg-background border-border">
          <div className="py-8 text-center text-muted-foreground text-sm">
            {t("common.loading")}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const subStepLabels: Record<ParticipantSubStep, string> = {
    profile: t("groupRegistration.subStepProfile"),
    fields: t("groupRegistration.subStepFields"),
    waiver: t("groupRegistration.subStepWaiver"),
    extras: t("groupRegistration.subStepExtras"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && dispatch(closeGroupRegistrationWizard())}
    >
      <DialogContent className="max-w-lg w-[calc(100%-1rem)] max-h-[min(92vh,720px)] overflow-y-auto p-0 gap-0 bg-background border-border">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            {t("groupRegistration.title")}
          </DialogTitle>
          {step === "participant" && (
            <p className="text-xs text-muted-foreground">
              {t("groupRegistration.participantProgress", {
                current: currentParticipantIndex + 1,
                total: participants.length,
              })}
              {currentParticipantLabel ? ` · ${currentParticipantLabel}` : ""}
            </p>
          )}
        </DialogHeader>

        <div className="p-5">
          {waiverMisconfigured && step !== "result" ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-destructive">{t("eventDetail.waiverNotConfigured")}</p>
              <p className="text-xs text-muted-foreground">
                {t("eventDetail.waiverNotConfiguredHint")}
              </p>
            </div>
          ) : null}

          {!waiverMisconfigured && step === "auth" && (
            <WizardAuthStep
              onAuthed={() => {
                if (buyerRegistered) dispatch(setGroupIncludeSelf(false));
                dispatch(setGroupWizardStep("quantity"));
              }}
            />
          )}

          {!waiverMisconfigured && step === "quantity" && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="group-count">{t("groupRegistration.howMany")}</Label>
                <Input
                  id="group-count"
                  type="number"
                  min={1}
                  max={maxPerOrder}
                  value={participantCount}
                  onChange={(e) => {
                    const n = Number(e.target.value) || 1;
                    dispatch(
                      setGroupParticipantCount(Math.min(maxPerOrder, Math.max(1, n))),
                    );
                  }}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("groupRegistration.maxPerOrder", { max: maxPerOrder })}
                </p>
              </div>
              {!buyerRegistered && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSelf}
                    onChange={(e) => dispatch(setGroupIncludeSelf(e.target.checked))}
                    className="rounded border-border"
                  />
                  {t("groupRegistration.includeMe")}
                </label>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full btn-primary"
                onClick={() => {
                  dispatch(initGroupParticipants());
                  dispatch(setGroupWizardStep("participant"));
                }}
              >
                {t("groupRegistration.continue")}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {!waiverMisconfigured && step === "participant" && current && (
            <div className="space-y-4">
              {availableSubSteps.length > 1 ? (
                <nav
                  aria-label={t("groupRegistration.participantSteps")}
                  className="flex flex-wrap gap-1.5"
                >
                  {availableSubSteps.map((s) => {
                    const active = s === subStep;
                    const reached =
                      availableSubSteps.indexOf(s) <= availableSubSteps.indexOf(subStep);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!reached}
                        onClick={() => reached && setSubStep(s)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                          active
                            ? "border-primary/40 bg-primary/15 text-foreground"
                            : reached
                              ? "border-border bg-card text-muted-foreground hover:border-primary/30"
                              : "border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed",
                        )}
                      >
                        {subStepLabels[s]}
                      </button>
                    );
                  })}
                </nav>
              ) : null}

              {subStep === "profile" && (
                <>
                  <div>
                    <Label>{t("groupRegistration.category")}</Label>
                    <select
                      className="mt-1.5 w-full h-11 rounded-xl border border-input bg-card px-3 text-sm"
                      value={current.categoryId || ""}
                      onChange={(e) =>
                        dispatch(
                          updateCurrentParticipant({
                            categoryId: Number(e.target.value),
                            fieldValues: {},
                          }),
                        )
                      }
                    >
                      <option value="">{t("groupRegistration.selectCategory")}</option>
                      {categories.map((cat: EventCategory) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {current.participantType === "self" ? (
                    <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card/50 px-3 py-2">
                      {t("groupRegistration.registeringAsYou", {
                        email: user?.email ?? "",
                      })}
                    </p>
                  ) : (
                    <>
                      <div>
                        <Label>{t("groupRegistration.participantType")}</Label>
                        <select
                          className="mt-1.5 w-full h-11 rounded-xl border border-input bg-card px-3 text-sm"
                          value={current.participantType}
                          onChange={(e) =>
                            dispatch(
                              updateCurrentParticipant({
                                participantType: e.target.value as "account" | "guest",
                                accountEmail: undefined,
                                guest: undefined,
                              }),
                            )
                          }
                        >
                          <option value="account">{t("groupRegistration.hasAccount")}</option>
                          <option value="guest">{t("groupRegistration.guest")}</option>
                        </select>
                      </div>

                      {current.participantType === "account" && (
                        <div>
                          <Label>{t("common.email")}</Label>
                          <Input
                            className="mt-1"
                            type="email"
                            value={current.accountEmail ?? ""}
                            onChange={(e) =>
                              dispatch(
                                updateCurrentParticipant({ accountEmail: e.target.value }),
                              )
                            }
                          />
                        </div>
                      )}

                      {current.participantType === "guest" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>{t("groupRegistration.firstName")}</Label>
                              <Input
                                className="mt-1"
                                value={current.guest?.firstName ?? ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateCurrentParticipant({
                                      guest: {
                                        ...(current.guest ?? {
                                          firstName: "",
                                          lastName: "",
                                          email: "",
                                          dateOfBirth: "",
                                          gender: "prefer_not_to_say",
                                        }),
                                        firstName: e.target.value,
                                      },
                                    }),
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label>{t("groupRegistration.lastName")}</Label>
                              <Input
                                className="mt-1"
                                value={current.guest?.lastName ?? ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateCurrentParticipant({
                                      guest: {
                                        ...(current.guest ?? {
                                          firstName: "",
                                          lastName: "",
                                          email: "",
                                          dateOfBirth: "",
                                          gender: "prefer_not_to_say",
                                        }),
                                        lastName: e.target.value,
                                      },
                                    }),
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label>{t("common.email")}</Label>
                            <Input
                              className="mt-1"
                              type="email"
                              value={current.guest?.email ?? ""}
                              onChange={(e) =>
                                dispatch(
                                  updateCurrentParticipant({
                                    guest: {
                                      ...(current.guest ?? {
                                        firstName: "",
                                        lastName: "",
                                        email: "",
                                        dateOfBirth: "",
                                        gender: "prefer_not_to_say",
                                      }),
                                      email: e.target.value,
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label>{t("groupRegistration.dateOfBirth")}</Label>
                              <Input
                                className="mt-1"
                                type="date"
                                value={current.guest?.dateOfBirth ?? ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateCurrentParticipant({
                                      guest: {
                                        ...(current.guest ?? {
                                          firstName: "",
                                          lastName: "",
                                          email: "",
                                          dateOfBirth: "",
                                          gender: "prefer_not_to_say",
                                        }),
                                        dateOfBirth: e.target.value,
                                      },
                                    }),
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label>{t("groupRegistration.gender")}</Label>
                              <select
                                className="mt-1 w-full h-11 rounded-xl border border-input bg-card px-3 text-sm"
                                value={current.guest?.gender ?? "prefer_not_to_say"}
                                onChange={(e) =>
                                  dispatch(
                                    updateCurrentParticipant({
                                      guest: {
                                        ...(current.guest ?? {
                                          firstName: "",
                                          lastName: "",
                                          email: "",
                                          dateOfBirth: "",
                                        }),
                                        gender: e.target.value as
                                          | "male"
                                          | "female"
                                          | "other"
                                          | "prefer_not_to_say",
                                      },
                                    }),
                                  )
                                }
                              >
                                <option value="male">{t("groupRegistration.genderMale")}</option>
                                <option value="female">
                                  {t("groupRegistration.genderFemale")}
                                </option>
                                <option value="other">{t("groupRegistration.genderOther")}</option>
                                <option value="prefer_not_to_say">
                                  {t("groupRegistration.genderPreferNot")}
                                </option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <Label>{t("groupRegistration.guardianRelationship")}</Label>
                            <Input
                              className="mt-1"
                              value={current.guardianRelationship ?? ""}
                              onChange={(e) =>
                                dispatch(
                                  updateCurrentParticipant({
                                    guardianRelationship: e.target.value,
                                  }),
                                )
                              }
                              placeholder={t("groupRegistration.guardianPlaceholder")}
                            />
                          </div>
                          <label className="flex items-start gap-2 text-sm pt-1">
                            <Checkbox
                              checked={Boolean(current.managedByPurchaser)}
                              onCheckedChange={(v) =>
                                dispatch(
                                  updateCurrentParticipant({
                                    managedByPurchaser: Boolean(v),
                                  }),
                                )
                              }
                            />
                            <span className="leading-snug">
                              <span className="font-medium text-foreground">
                                {t("groupRegistration.managedByPurchaser")}
                              </span>
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                {t("groupRegistration.managedByPurchaserHint")}
                              </span>
                            </span>
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    {currentParticipantIndex > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={goPrevParticipantSubStep}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        {t("common.back")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="flex-1 btn-primary"
                      disabled={!current.categoryId}
                      onClick={goNextParticipantSubStep}
                    >
                      {profileContinueLabel}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}

              {subStep === "fields" && hasFields ? (
                <WizardRegistrationFieldsForm
                  fields={registrationFields}
                  initialValues={current.fieldValues}
                  participantLabel={t("groupRegistration.fieldsForPerson", {
                    name: currentParticipantLabel,
                  })}
                  submitLabel={fieldsContinueLabel}
                  onBack={goPrevParticipantSubStep}
                  onSubmit={(fieldValues) => {
                    dispatch(updateCurrentParticipant({ fieldValues }));
                    goNextParticipantSubStep();
                  }}
                />
              ) : null}

              {subStep === "waiver" && registrationWaivers.length > 0 && (
                <WizardWaiverStep
                  waivers={registrationWaivers}
                  onAccepted={(signatures) => {
                    dispatch(setGroupWaiverForCurrent(signatures));
                    goNextParticipantSubStep();
                  }}
                />
              )}

              {subStep === "extras" && currentCategory && (
                <WizardExtrasStep
                  extras={registrationExtras}
                  serviceFeePercent={eventDetail.serviceFeePercent}
                  feePresentation={eventDetail.feePresentation ?? "pass_through"}
                  initialSelection={Object.fromEntries(
                    (current.selectedExtras ?? []).map((row) => [
                      row.extraId,
                      row.quantity,
                    ]),
                  )}
                  profilePrefill={
                    user
                      ? {
                          shirt_size: user.shirtSize ?? null,
                          city: user.city ?? null,
                        }
                      : undefined
                  }
                  onComplete={({ selectedExtras, extraFieldAnswers }) => {
                    dispatch(
                      updateCurrentParticipant({
                        selectedExtras,
                        extraFieldAnswers,
                      }),
                    );
                    goNextParticipantSubStep();
                  }}
                />
              )}
            </div>
          )}

          {!waiverMisconfigured && step === "review" && (
            <div className="space-y-4">
              <ul className="space-y-2">
                {participants.map((p, i) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const label = participantDisplayName(p, t("groupRegistration.you"));
                  const answeredCount = Object.values(p.fieldValues ?? {}).filter((v) =>
                    typeof v === "boolean" ? v : String(v ?? "").trim(),
                  ).length;
                  return (
                    <li
                      key={p.lineId}
                      className="rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <span className="font-medium text-foreground">
                            {i + 1}. {label}
                          </span>
                          <span className="text-muted-foreground"> · {cat?.name}</span>
                        </div>
                        {answeredCount > 0 ? (
                          <span className="text-[11px] font-semibold text-primary">
                            {t("groupRegistration.fieldsAnswered", { count: answeredCount })}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div>
                <Label>{t("groupRegistration.discountCode")}</Label>
                <Input
                  className="mt-1"
                  value={discountCode}
                  onChange={(e) => dispatch(setGroupDiscountCode(e.target.value))}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSubStep("profile");
                    dispatch(setCurrentParticipantIndex(Math.max(0, participants.length - 1)));
                    dispatch(setGroupWizardStep("participant"));
                  }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {t("common.back")}
                </Button>
                <Button
                  className="flex-1 btn-primary"
                  disabled={loadingCheckout}
                  onClick={handleStartCheckout}
                >
                  {loadingCheckout
                    ? t("groupRegistration.preparingCheckout")
                    : t("groupRegistration.continueToPayment")}
                </Button>
              </div>
            </div>
          )}

          {!waiverMisconfigured && step === "checkout" && checkout && (
            <WizardGroupCheckoutStep
              slug={eventSlug}
              eventTitle={eventDetail.event.title}
            />
          )}

          {step === "result" && (
            <WizardGroupResultStep
              success={!paymentFailed && Boolean(confirmResult?.success)}
              failureMessage={failureMessage}
              confirmationEmail={confirmResult?.confirmationEmail ?? user?.email ?? null}
              eventTitle={eventDetail.event.title}
              eventSlug={eventSlug}
              order={confirmResult?.order}
              onRetry={handleRetry}
              onClose={() => dispatch(closeGroupRegistrationWizard())}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
