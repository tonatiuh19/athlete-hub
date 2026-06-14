import { useState } from "react";
import { Navigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import StaffAthleteDetailSheet from "@/components/staff/StaffAthleteDetailSheet";
import StaffPaymentDetailSheet from "@/components/staff/StaffPaymentDetailSheet";
import StaffPaymentsPanel from "@/components/staff/StaffPaymentsPanel";
import { useAppSelector } from "@/store/hooks";
import { canRefundStaffPayments, canViewStaffPayments } from "@/utils/staffNav";

export default function StaffPayments() {
  const { t } = useTranslation();
  const { role, user } = useAppSelector((s) => s.staffAuth);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(null);
  const [athleteSheetOpen, setAthleteSheetOpen] = useState(false);

  const organizerRole = user?.type === "organizer" ? user.role : undefined;
  const canAccess = canViewStaffPayments(role === "admin", organizerRole);
  const canRefund = canRefundStaffPayments(role === "admin", organizerRole);

  if (!canAccess || !role) {
    return <Navigate to="/staff" replace />;
  }

  const openPayment = (paymentId: number) => {
    setSelectedPaymentId(paymentId);
    setPaymentSheetOpen(true);
  };

  const openAthlete = (athleteId: number) => {
    setSelectedAthleteId(athleteId);
    setAthleteSheetOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 overflow-x-clip space-y-6">
      <MetaHelmet
        title={t("staffPortal.finance.title")}
        description={t("staffPortal.finance.subtitle")}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-cyan" />
          {t("staffPortal.finance.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffPortal.finance.subtitle")}</p>
      </div>

      <StaffPaymentsPanel
        role={role}
        onSelectPayment={openPayment}
        onSelectAthlete={role === "admin" ? openAthlete : undefined}
      />

      <StaffPaymentDetailSheet
        paymentId={selectedPaymentId}
        role={role}
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        onViewAthlete={role === "admin" ? openAthlete : undefined}
        allowRefund={canRefund}
      />

      {role === "admin" ? (
        <StaffAthleteDetailSheet
          athleteId={selectedAthleteId}
          open={athleteSheetOpen}
          onOpenChange={setAthleteSheetOpen}
        />
      ) : null}
    </div>
  );
}
