import { getTranslations, setRequestLocale } from "next-intl/server";

import { formatPlain } from "@/lib/datetime";

import { container } from "./ui";

type Section = { title: string; body: string };

/** Content-only page (About, Terms, Privacy) driven by `messages/*.json`. */
export async function ContentPage({
  locale,
  namespace,
  children,
}: {
  locale: string;
  namespace: "About" | "Terms" | "Privacy";
  children?: React.ReactNode;
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace });
  const sections = t.raw("sections") as Section[];
  const hasUpdated = namespace !== "About";

  return (
    <main className={`${container} max-w-3xl py-12`}>
      <h1 className="mb-2 text-4xl font-extrabold">{t("title")}</h1>
      {hasUpdated ? <p className="mb-6 text-sm text-muted">{t("updated")}</p> : null}
      <p className="mb-10 text-lg text-muted">{t("intro")}</p>
      <div className="space-y-8">
        {sections.map((section, index) => (
          <section key={section.title}>
            <h2 className="mb-2 text-xl font-bold">
              {hasUpdated ? `${formatPlain(index + 1, locale)}. ` : ""}
              {section.title}
            </h2>
            <p className="text-muted">{section.body}</p>
          </section>
        ))}
      </div>
      {children}
    </main>
  );
}
