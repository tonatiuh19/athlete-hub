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
import WizardAuthStep from "@/components/events/registration/WizardAuthStep";
import WizardWaiverStep from "@/components/events/registration/WizardWaiverStep";
import WizardExtrasStep from "@/components/events/registration/WizardExtrasStep";
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
} from "@/store/slices/groupRegistrationCheckoutSlice";
import { fetchPaymentConfig } from "@/store/slices/registrationCheckoutSlice";
import { fetchEventDetail } from "@/store/slices/marketplaceSlice";
import { fetchAthleteRegistrations } from "@/store/slices/athletePortalSlice";
import {
  eventRequiresWaiver,
  getRegistrationWaivers,
  isWaiverMisconfigured,
} from "@/utils/eventRegistrationWaivers";
import type { EventCategory, GroupCheckoutLineItemInput } from "@shared/api";

export { openGroupRegistrationWizard };

export default function GroupRegistrationWizard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { eventDetail } = useAppSelector((s) => s.marketplace);
  const { token, user } = useAppSelector((s) => s.athleteAuth);
  const {
    open,
    step,
    eventSlug,
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
  const [subStep, setSubStep] = useState<"profile" | "waiver" | "extras">("profile");

  const categories = eventDetail?.categories ?? [];
  const registrationWaivers = useMemo(
    () => getRegistrationWaivers(eventDetail),
    [eventDetail],
  );
  const needsWaiver = eventRequiresWaiver(eventDetail) && registrationWaivers.length > 0;
  const waiverMisconfigured = isWaiverMisconfigured(eventDetail);
  const current = participants[currentParticipantIndex];
  const currentCategory = categories.find((c) => c.id === current?.categoryId);

  const registrationExtras = useMemo(() => {
    const all = eventDetail?.extras ?? [];
    if (!currentCategory?.id) return all;
    return all.filter((extra) => {
      const scope = extra.scope_type ?? "all_categories";
      if (scope === "all_categories") return true;
      return (extra.category_ids ?? []).includes(currentCategory.id);
    });
  }, [eventDetail?.extras, currentCategory?.id]);

  const hasExtras = registrationExtras.length > 0;
  const maxPerOrder = eventDetail?.event?.max_registrations_per_order ?? 10;
  const buyerRegistered = eventDetail?.myRegistration?.status === "confirmed";

  useEffect(() => {
    if (open && eventSlug) {
      if (!eventDetail?.event || eventDetail.event.slug !== eventSlug) {
        dispatch(fetchEventDetail(eventSlug));
      }
      dispatch(fetchPaymentConfig());
    }
  }, [open, eventSlug, eventDetail?.event, eventDetail?.event?.slug, dispatch]);

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

  const lineItemsForCheckout = useMemo((): GroupCheckoutLineItemInput[] => {
    return participants
      .filter((p) => p.categoryId > 0)
      .map((p) => ({
        lineId: p.lineId,
        participantType: p.participantType,
        accountEmail: p.accountEmail,
        guest: p.guest,
        guardianRelationship: p.guardianRelationship,
        categoryId: p.categoryId,
        fieldValues: p.fieldValues ?? {},
        waiverSignatures: p.waiverSignatures,
        selectedExtras: p.selectedExtras,
        extraFieldAnswers: p.extraFieldAnswers,
        waitlistEntryId: p.waitlistEntryId,
      }));
  }, [participants]);

  const goNextParticipantSubStep = () => {
    if (subStep === "profile") {
      if (needsWaiver) setSubStep("waiver");
      else if (hasExtras) setSubStep("extras");
      else advanceParticipant();
      return;
    }
    if (subStep === "waiver") {
      if (hasExtras) setSubStep("extras");
      else advanceParticipant();
      return;
    }
    advanceParticipant();
  };

  const advanceParticipant = () => {
    setSubStep("profile");
    if (currentParticipantIndex < participants.length - 1) {
      dispatch(setCurrentParticipantIndex(currentParticipantIndex + 1));
    } else {
      dispatch(setGroupWizardStep("review"));
    }
  };

  const handleStartCheckout = () => {
    if (!eventSlug) return;
    dispatch(
      createGroupRegistrationCheckout({
        slug: eventSlug,
        lineItems: lineItemsForCheckout,
        idempotencyKey,
        discountCode: discountCode.trim() || undefined,
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
                                accountEmail: "",
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
                            type="email"
                            className="mt-1.5"
                            value={current.accountEmail ?? ""}
                            onChange={(e) =>
                              dispatch(
                                updateCurrentParticipant({ accountEmail: e.target.value }),
                              )
                            }
                            placeholder="atleta@email.com"
                          />
                        </div>
                      )}

                      {current.participantType === "guest" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
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
                              type="email"
                              className="mt-1"
                              value={current.guest?.email ?? ""}
                              onChange={(e) =>
                                dispatch(
                                  updateCurrentParticipant({
                                    guest: {
                                      ...(current.guest ?? {
                                        firstName: "",
                                        lastName: "",
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
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>{t("groupRegistration.dateOfBirth")}</Label>
                              <Input
                                type="date"
                                className="mt-1"
                                value={current.guest?.dateOfBirth ?? ""}
                                onChange={(e) =>
                                  dispatch(
                                    updateCurrentParticipant({
                                      guest: {
                                        ...(current.guest ?? {
                                          firstName: "",
                                          lastName: "",
                                          email: "",
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
                                className="mt-1 w-full h-10 rounded-xl border border-input bg-card px-2 text-sm"
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
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

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

              {subStep === "profile" && (
                <div className="flex gap-2 pt-2">
                  {currentParticipantIndex > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSubStep("profile");
                        dispatch(setCurrentParticipantIndex(currentParticipantIndex - 1));
                      }}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      {t("common.back")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="flex-1 btn-primary"
                    disabled={!current.categoryId}
                    onClick={goNextParticipantSubStep}
                  >
                    {currentParticipantIndex < participants.length - 1
                      ? t("groupRegistration.nextParticipant")
                      : t("groupRegistration.reviewOrder")}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {!waiverMisconfigured && step === "review" && (
            <div className="space-y-4">
              <ul className="space-y-2">
                {participants.map((p, i) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const label =
                    p.participantType === "self"
                      ? t("groupRegistration.you")
                      : p.participantType === "account"
                        ? p.accountEmail
                        : `${p.guest?.firstName ?? ""} ${p.guest?.lastName ?? ""}`.trim();
                  return (
                    <li
                      key={p.lineId}
                      className="rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm"
                    >
                      <span className="font-medium text-foreground">
                        {i + 1}. {label}
                      </span>
                      <span className="text-muted-foreground"> · {cat?.name}</span>
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
              <Button
                className="w-full btn-primary"
                disabled={loadingCheckout}
                onClick={handleStartCheckout}
              >
                {loadingCheckout
                  ? t("groupRegistration.preparingCheckout")
                  : t("groupRegistration.continueToPayment")}
              </Button>
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
