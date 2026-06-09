import { useEffect, useState } from "react";
import { Quote, Star, type LucideIcon } from "lucide-react";
import TribooLogo from "@/components/brand/TribooLogo";
import { ATHLETE_LOGIN_VIDEO_URL } from "@/constants/tribooBrand";

const DEFAULT_VIDEO_URL =
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
  videoUrl?: string;
}

export default function AuthBrandPanel({
  badge,
  headline,
  subheadline,
  stats,
  testimonials,
  footerNote,
  videoUrl = DEFAULT_VIDEO_URL,
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
        className="absolute inset-0 bg-gradient-to-br from-triboo-black via-[#0c1019] to-triboo-black"
        style={{ zIndex: 0 }}
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 1, filter: "brightness(0.42) saturate(1.15)" }}
      >
        <source src={videoUrl} type="video/mp4" />
      </video>
      <div
        className="absolute inset-0 bg-gradient-to-t from-triboo-black/95 via-triboo-black/35 to-primary/10"
        style={{ zIndex: 2 }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-triboo-black/70 to-transparent"
        style={{ zIndex: 2 }}
      />

      <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
        <div className="space-y-4">
          {/* <TribooLogo
            surface="dark"
            href="/"
            className="h-10 xl:h-11 w-[min(240px,80%)]"
          /> */}
          {badge ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full backdrop-blur-sm border border-primary/30 bg-primary/10 text-[11px] font-semibold uppercase tracking-wider text-primary w-fit">
              {badge}
            </span>
          ) : null}
        </div>

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
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-4 text-center hover:border-primary/35 transition-colors"
              >
                <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
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
            <Quote className="w-6 h-6 text-primary mb-3 opacity-80" />
            <p className="text-sm text-white/85 leading-relaxed italic">
              "{testimonial.quote}"
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-9 h-9 rounded-full bg-triboo-gradient flex items-center justify-center text-sm font-bold text-primary-foreground">
                {testimonial.initial}
              </div>
              <div>
                <div className="text-sm font-semibold">{testimonial.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3 fill-primary text-primary"
                    />
                  ))}
                  <span className="text-[10px] text-white/45 ml-1">
                    {testimonial.detail}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {footerNote ? (
          <p className="text-[11px] text-white/35">{footerNote}</p>
        ) : null}
      </div>
    </div>
  );
}
