import { useTranslation } from "react-i18next";
import MetaHelmet from "@/components/MetaHelmet";
import { LucideIcon } from "lucide-react";

interface StaffPlaceholderProps {
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
}

export default function StaffPlaceholder({
  titleKey,
  descKey,
  icon: Icon,
}: StaffPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <MetaHelmet title={t(titleKey)} description={t(descKey)} />
      <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-cyan" />
      </div>
      <h1 className="text-2xl font-bold mb-2">{t(titleKey)}</h1>
      <p className="text-muted-foreground text-sm">{t(descKey)}</p>
    </div>
  );
}
