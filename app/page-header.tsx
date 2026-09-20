import Image from "next/image";
import Link from "next/link";

const NAV = [
  { href: "/", label: "Draft" },
  { href: "/profile", label: "Profile" },
  { href: "/applications", label: "Applications" },
  { href: "/learn", label: "Learning" },
];

/**
 * One header for every page: wordmark, section links, a hairline, and a line of
 * description. Nothing is boxed and nothing is coloured — the rule does the
 * separating and the current section is marked by weight.
 */
export default function PageHeader({
  title,
  description,
  current,
}: {
  title: string;
  description: string;
  current: string;
}) {
  return (
    <header className="mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-stone-900 pb-2">
        <Link href="/" className="flex items-center gap-2.5">
          {/* The square artwork carries white space under the hat, so the frame
              crops to the mark itself and keeps it sitting on the baseline. */}
          <span className="block h-[22px] w-[30px] overflow-hidden">
            <Image
              src="/hard_hat_logo.png"
              alt=""
              width={384}
              height={384}
              priority
              className="h-auto w-full -translate-y-[13%]"
            />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.25em]">
            CV Factory
          </span>
        </Link>
        <nav className="flex flex-wrap gap-x-5 text-xs uppercase tracking-[0.15em]">
          {NAV.map((item) => {
            const active = item.href === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "font-bold text-stone-900"
                    : "text-stone-500 hover:text-stone-900"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <h1 className="mt-8 text-2xl font-bold uppercase tracking-[0.12em]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">{description}</p>
    </header>
  );
}
