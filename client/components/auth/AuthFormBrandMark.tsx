import TribooLogo from "@/components/brand/TribooLogo";

/** Centered Triboo mark above login form title */
export default function AuthFormBrandMark() {
  return (
    <div className="flex justify-center mb-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-glow-triboo">
        <TribooLogo
          surface="dark"
          mark="symbol"
          href={undefined}
          className="h-14 w-14 sm:h-16 sm:w-16"
          imgClassName="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}
