import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { FaqItemKey } from "@/constants/faqStructure";

type FaqAccordionProps = {
  itemKeys: FaqItemKey[];
  /** Allow multiple panels open at once */
  type?: "single" | "multiple";
  className?: string;
  itemClassName?: string;
  defaultOpenFirst?: boolean;
};

function FaqItems({
  itemKeys,
  itemClassName,
}: Pick<FaqAccordionProps, "itemKeys" | "itemClassName">) {
  const { t } = useTranslation();

  return (
    <>
      {itemKeys.map((key) => (
        <AccordionItem
          key={key}
          value={key}
          className={cn(
            "border-border/80 px-1 data-[state=open]:bg-card/30 rounded-lg transition-colors",
            itemClassName,
          )}
        >
          <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline hover:text-primary py-4 gap-4">
            {t(`faq.items.${key}.question`)}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base pb-5">
            {t(`faq.items.${key}.answer`)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </>
  );
}

export default function FaqAccordion({
  itemKeys,
  type = "single",
  className,
  itemClassName,
  defaultOpenFirst = false,
}: FaqAccordionProps) {
  const defaultValue =
    defaultOpenFirst && itemKeys.length > 0 ? itemKeys[0] : undefined;

  if (type === "multiple") {
    return (
      <Accordion
        type="multiple"
        defaultValue={defaultValue ? [defaultValue] : undefined}
        className={cn("w-full", className)}
      >
        <FaqItems itemKeys={itemKeys} itemClassName={itemClassName} />
      </Accordion>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultValue}
      className={cn("w-full", className)}
    >
      <FaqItems itemKeys={itemKeys} itemClassName={itemClassName} />
    </Accordion>
  );
}
