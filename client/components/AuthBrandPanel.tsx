import { useEffect, useState } from "react";
import { Quote, Star, type LucideIcon } from "lucide-react";

const VIDEO_URL =
  "https://disruptinglabs.com/data/optimum/assets/videos/5159096-sd_338_640_25fps.mp4";

export interface AuthStat {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface AuthTestimonial {
  quote: string;
  name: string;
  detail: string;
  initial: string;
}

interface AuthBrandPanelProps {
  badge: string;
  headline: React.ReactNode;
  subheadline: string;
  stats: AuthStat[];
  testimonials: AuthTestimonial[];
  footerNote?: string;
}

export default function AuthBrandPanel({
  badge,
  headline,
  subheadline,
  stats,
  testimonials,
  footerNote,
}: AuthBrandPanelProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % testimonials.length);
    }, 7000);
    return () => clearInterval(id);
  }, [testimonials.length]);

  const testimonial = testimonials[quoteIndex];

  return (
    <div className="hidden lg:flex flex-1 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#050816] via-[#0A0F1F] to-[#111827]"
        style={{ zIndex: 0 }}
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 1, filter: "brightness(0.45) saturate(1.2)" }}
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#050816]/90 via-[#050816]/30 to-cyan/10"
        style={{ zIndex: 2 }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#050816]/60 to-transparent"
        style={{ zIndex: 2 }}
      />

      <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-sm border text-xs font-medium text-cyan w-fit">
          {/* {badge} */}
        </span>

        <div className="space-y-8">
          <div className="space-y-4 max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight drop-shadow-lg">
              {headline}
            </h2>
            <p className="text-base text-white/70 leading-relaxed max-w-md">
              {subheadline}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {stats.map(({ value, label, icon: Icon }) => (
              <div
                key={label}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-4 text-center hover:border-cyan/30 transition-colors"
              >
                <Icon className="w-5 h-5 text-cyan mx-auto mb-2" />
                <div className="text-xl font-bold">{value}</div>
                <div className="text-[11px] text-white/55 mt-0.5 leading-tight">
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div
            key={quoteIndex}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 max-w-lg animate-slide-up"
          >
            <Quote className="w-6 h-6 text-cyan mb-3 opacity-80" />
            <p className="text-sm text-white/85 leading-relaxed italic">
              "{testimonial.quote}"
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan to-blue-electric flex items-center justify-center text-sm font-bold text-navy-deep">
                {testimonial.initial}
              </div>
              <div>
                <div className="text-sm font-semibold">{testimonial.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-cyan text-cyan" />
                  ))}
                  <span className="text-[10px] text-white/45 ml-1">
                    {testimonial.detail}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {footerNote && (
          <p className="text-[11px] text-white/35">{footerNote}</p>
        )}
      </div>
    </div>
  );
}
